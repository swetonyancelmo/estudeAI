"use client";

import { useCallback, useEffect, useRef } from "react";
import { recordStudyTime } from "@/lib/roadmaps/api";
import { localToday } from "@/lib/study/time";

/** De quanto em quanto tempo a sala de estudo avisa "estou estudando". */
const BEAT_MS = 60_000;
/** Sem interação por mais que isto, a página aberta não conta como estudo. */
const IDLE_MS = 2 * 60_000;

/**
 * Conta o tempo de estudo (Fase 5): a cada minuto, se a aba está visível e a
 * pessoa interagiu nos últimos 2 minutos (ou um vídeo está tocando, via
 * `markActive`), avisa a API. A API soma o minuto ao dia e descarta avisos
 * próximos demais, então abrir duas abas não conta em dobro.
 *
 * Falha de rede é ignorada: perder um minuto da contagem não é motivo para
 * incomodar quem está estudando.
 */
export function useStudyTime(roadmapId: string): { markActive: () => void } {
  const lastActive = useRef(0);
  const markActive = useCallback(() => {
    lastActive.current = Date.now();
  }, []);

  useEffect(() => {
    markActive();
    const events = ["pointerdown", "keydown", "scroll", "wheel"] as const;
    for (const name of events) {
      window.addEventListener(name, markActive, { passive: true });
    }
    const timer = setInterval(() => {
      const visible = document.visibilityState === "visible";
      const active = Date.now() - lastActive.current < IDLE_MS;
      if (visible && active) {
        recordStudyTime(roadmapId, localToday()).catch(() => undefined);
      }
    }, BEAT_MS);
    return () => {
      clearInterval(timer);
      for (const name of events) {
        window.removeEventListener(name, markActive);
      }
    };
  }, [roadmapId, markActive]);

  return { markActive };
}
