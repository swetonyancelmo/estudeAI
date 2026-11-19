"use client";

import { useEffect, useRef } from "react";

export interface StudyShortcuts {
  onPrevious?: () => void;
  onNext?: () => void;
  onToggleFocus?: () => void;
  onToggleList?: () => void;
  /** Esc: só quando há algo a fechar (o modo foco). */
  onEscape?: () => void;
}

/**
 * Onde o teclado é da pessoa, não da sala: campos de texto, o editor do
 * Sandpack (CodeMirror é `contenteditable`) e qualquer diálogo aberto. Teclas
 * dentro do player do YouTube nem chegam aqui: o iframe as consome.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest("input, textarea, select, [role=dialog], [role=alertdialog]"))
    return true;
  return target.closest(".sp-wrapper") !== null;
}

/**
 * Atalhos da sala de estudo: Alt+→ próxima parada, Alt+← anterior, F modo
 * foco, [ recolher a lista, Esc sai do foco.
 */
export function useStudyShortcuts(shortcuts: StudyShortcuts) {
  const latest = useRef(shortcuts);
  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      const handlers = latest.current;

      let handler: (() => void) | undefined;
      if (event.altKey && !event.shiftKey) {
        if (event.key === "ArrowLeft") handler = handlers.onPrevious;
        else if (event.key === "ArrowRight") handler = handlers.onNext;
      } else if (!event.altKey && !event.shiftKey) {
        if (event.key === "f" || event.key === "F") handler = handlers.onToggleFocus;
        else if (event.key === "[") handler = handlers.onToggleList;
        else if (event.key === "Escape") handler = handlers.onEscape;
      }

      if (!handler) return;
      event.preventDefault();
      handler();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
