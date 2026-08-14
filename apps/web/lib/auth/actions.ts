import { AxiosError } from "axios";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from "@estudeai/shared-types";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/store";
import { setAuthFlag, clearAuthFlag } from "@/lib/auth/flag-cookie";

/** Extrai a mensagem padronizada do backend ({ message }) para exibir no form. */
export function extractApiError(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string | string[] })
      ?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

export async function register(payload: RegisterRequest): Promise<void> {
  const { data } = await api.post<AuthResponse>("/auth/register", payload);
  useAuthStore.getState().setSession(data.accessToken, data.user);
  setAuthFlag();
}

export async function login(payload: LoginRequest): Promise<void> {
  const { data } = await api.post<AuthResponse>("/auth/login", payload);
  useAuthStore.getState().setSession(data.accessToken, data.user);
  setAuthFlag();
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    useAuthStore.getState().clearSession();
    clearAuthFlag();
  }
}
