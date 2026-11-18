import { create } from "zustand";
import type { UserDto } from "@estudeai/shared-types";

/**
 * - idle: ainda não tentamos hidratar a sessão (bootstrap)
 * - loading: bootstrap em andamento
 * - authenticated / unauthenticated: resultado conhecido
 * - unavailable: não deu para confirmar a sessão (limite de requisições, rede,
 *   API fora). A sessão pode estar válida, então NÃO é logout.
 */
export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

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
