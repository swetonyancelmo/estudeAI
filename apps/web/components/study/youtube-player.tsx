"use client";

import { useEffect, useRef } from "react";
import type { YoutubeTarget } from "@/lib/roadmaps/youtube";

/** Só a parte da IFrame Player API que usamos (não há @types no projeto). */
interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YTPlayerEvent {
  data: number;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onStateChange?: (event: YTPlayerEvent) => void;
        onError?: (event: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Carrega https://www.youtube.com/iframe_api uma vez por página. */
function loadYoutubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Não foi possível carregar o player do YouTube."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Intervalo de leitura do tempo: a API não tem evento de "seek" nem de tempo. */
const POLL_MS = 5_000;

/**
 * Códigos de erro em que o vídeo existe mas não pode tocar aqui: 100 (removido
 * ou privado), 101 e 150 (dono desativou a incorporação). Os demais são de
 * parâmetro e não deveriam acontecer com URLs já validadas.
 */
const UNAVAILABLE_ERRORS = new Set([100, 101, 150]);

interface YoutubePlayerProps {
  target: YoutubeTarget;
  title: string;
  /** Onde retomar, em segundos (o ponto mais longe já assistido). */
  startSeconds: number;
  onProgress: (currentSeconds: number, durationSeconds: number) => void;
  onEnded: () => void;
  onUnavailable: () => void;
}

/**
 * Player do YouTube embutido (youtube-nocookie: sem cookie de rastreio até a
 * pessoa dar play). Monte com `key` igual ao id do recurso: trocar de vídeo
 * recria o player, o que é mais simples que sincronizar `loadVideoById`.
 */
export function YoutubePlayer({
  target,
  title,
  startSeconds,
  onProgress,
  onEnded,
  onUnavailable,
}: YoutubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Callbacks em ref: o player é criado uma vez e precisa sempre da versão
  // mais nova deles, sem recriar o iframe a cada render do pai.
  const callbacks = useRef({ onProgress, onEnded, onUnavailable });
  useEffect(() => {
    callbacks.current = { onProgress, onEnded, onUnavailable };
  });

  // Valores iniciais: mudanças posteriores não devem recriar o player.
  const initial = useRef({ target, startSeconds });

  useEffect(() => {
    let player: YTPlayer | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const report = () => {
      if (!player) return;
      const duration = player.getDuration();
      if (duration > 0) {
        callbacks.current.onProgress(player.getCurrentTime(), duration);
      }
    };

    loadYoutubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        const { target: start, startSeconds: resumeAt } = initial.current;
        // O iframe substitui o elemento: um filho próprio evita que o React
        // perca o nó que ele mesmo renderizou.
        const mount = document.createElement("div");
        containerRef.current.appendChild(mount);

        player = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          ...(start.videoId ? { videoId: start.videoId } : {}),
          playerVars: {
            rel: 0,
            playsinline: 1,
            ...(start.listId
              ? { listType: "playlist", list: start.listId }
              : {}),
            ...(resumeAt > 0 && start.videoId
              ? { start: Math.floor(resumeAt) }
              : {}),
          },
          events: {
            onStateChange: (event) => {
              clearInterval(poll);
              if (event.data === YT.PlayerState.PLAYING) {
                report();
                poll = setInterval(report, POLL_MS);
              } else {
                // Pausa, fim ou troca: registra o ponto exato em que parou.
                report();
              }
              if (event.data === YT.PlayerState.ENDED) {
                callbacks.current.onEnded();
              }
            },
            onError: (event) => {
              if (UNAVAILABLE_ERRORS.has(event.data)) {
                callbacks.current.onUnavailable();
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onUnavailable();
      });

    return () => {
      cancelled = true;
      clearInterval(poll);
      player?.destroy();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      title={title}
      className="bg-muted aspect-video w-full overflow-hidden rounded-lg [&_iframe]:size-full"
    />
  );
}
