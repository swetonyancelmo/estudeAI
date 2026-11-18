import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import type { AuthResponse } from "@estudeai/shared-types";
import { useAuthStore } from "@/lib/auth/store";
import { setAuthFlag, clearAuthFlag } from "@/lib/auth/flag-cookie";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/**
 * Instância central. `withCredentials` é obrigatório para enviar/receber o
 * cookie httpOnly de refresh nas rotas de auth.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Injeta o access token (em memória) em toda requisição.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Refresh single-flight: se várias requisições tomarem 401 ao mesmo tempo,
 * apenas UMA chamada a /auth/refresh acontece; as demais aguardam o resultado.
 * Usa um axios "cru" (sem interceptors) para não recorrer a si mesmo.
 */
let refreshPromise: Promise<boolean> | null = null;

/** Esperas entre tentativas quando a falha é passageira. */
const REFRESH_RETRY_DELAYS_MS = [1000, 3000];

/**
 * Só 401 (e 403) dizem que a sessão acabou. 429, 5xx e erro de rede não dizem
 * nada sobre o cookie: deslogar nesses casos jogava fora uma sessão válida.
 */
function isSessionRejected(error: unknown): boolean {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  return status === 401 || status === 403;
}

async function requestRefresh(): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await axios.post<AuthResponse>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      useAuthStore.getState().setSession(data.accessToken, data.user);
      setAuthFlag();
      return true;
    } catch (error) {
      if (isSessionRejected(error)) {
        useAuthStore.getState().clearSession();
        clearAuthFlag();
        return false;
      }
      const delay = REFRESH_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        // Mantém o cookie flag: a sessão provavelmente segue válida. Quem já
        // estava logado continua na tela (a requisição falha e pode ser
        // repetida); no carregamento, o AuthGuard oferece "tentar de novo".
        const { status, setStatus } = useAuthStore.getState();
        if (status !== "authenticated") setStatus("unavailable");
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = requestRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

// Em 401, tenta um refresh e repete a requisição original uma única vez.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isRefreshCall = original?.url?.includes("/auth/refresh");

    if (status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true;
      const ok = await refreshSession();
      if (ok) {
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
