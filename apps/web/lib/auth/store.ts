import { create } from "zustand";
import type { UserDto } from "@estudeai/shared-types";

/**
 * - idle: ainda não tentamos hidratar a sessão (bootstrap)
 * - loading: bootstrap em andamento
 * - authenticated / unauthenticated: resultado conhecido
 */
export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  /** Access token curto — vive SÓ em memória (nunca em localStorage). */
  accessToken: string | null;
  user: UserDto | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: UserDto) => void;
  clearSession: () => void;
  setStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setSession: (accessToken, user) =>
    set({ accessToken, user, status: "authenticated" }),
  clearSession: () =>
    set({ accessToken: null, user: null, status: "unauthenticated" }),
  setStatus: (status) => set({ status }),
}));
