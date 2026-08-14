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

export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<AuthResponse>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then(({ data }) => {
        useAuthStore.getState().setSession(data.accessToken, data.user);
        setAuthFlag();
        return true;
      })
      .catch(() => {
        useAuthStore.getState().clearSession();
        clearAuthFlag();
        return false;
      })
      .finally(() => {
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
