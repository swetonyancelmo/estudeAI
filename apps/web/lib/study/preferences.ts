"use client";

import { useCallback, useSyncExternalStore } from "react";
import { create } from "zustand";

/**
 * Preferências de interface da sala de estudo (lista recolhida, modo foco).
 * Só preferência visual vai para o `localStorage`, e sempre em `try/catch`:
 * em aba anônima ou com o storage bloqueado, a leitura falha e a tela abre no
 * padrão (lista aberta, sem foco), sem quebrar nada.
 */
export const PREFERENCE_KEYS = {
  listCollapsed: "estudeai:study-list-collapsed",
  focusMode: "estudeai:study-focus",
} as const;

type PreferenceKey = (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

/** Avisa os hooks desta aba; o evento `storage` só cobre as outras abas. */
const CHANGE_EVENT = "estudeai:preference";

/** Fallback em memória para quando o storage não aceita escrita. */
const memory = new Map<PreferenceKey, boolean>();

function read(key: PreferenceKey): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored === "1";
  } catch {
    // storage bloqueado: segue com o que a sessão já escolheu
  }
  return memory.get(key) ?? false;
}

function write(key: PreferenceKey, value: boolean) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // storage bloqueado: a escolha vale só enquanto a página estiver aberta
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Preferência booleana persistida. No servidor (e na hidratação) vale
 * `false`; o `useSyncExternalStore` troca para o valor salvo logo depois, sem
 * erro de hidratação.
 */
export function usePreference(
  key: PreferenceKey,
): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  );
  const set = useCallback((next: boolean) => write(key, next), [key]);
  return [value, set];
}

/**
 * Pedido da sala de estudo para esconder a barra global (modo foco). Fica
 * numa store porque a `AppNav` mora no layout, fora da sala.
 */
export const useStudyChrome = create<{
  hideNav: boolean;
  setHideNav: (hide: boolean) => void;
}>((set) => ({
  hideNav: false,
  setHideNav: (hideNav) => set({ hideNav }),
}));
