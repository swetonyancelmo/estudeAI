/**
 * O que tocar no player embutido, extraído da URL já validada que o backend
 * salvou. Vídeo tem `videoId`; playlist tem `listId` (e às vezes um vídeo
 * inicial). Nulo = não é um link do YouTube que o player saiba abrir.
 */
export interface YoutubeTarget {
  videoId?: string;
  listId?: string;
}

const VIDEO_ID = /^[\w-]{11}$/;
const LIST_ID = /^[\w-]{10,}$/;

export function parseYoutubeUrl(url: string): YoutubeTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^(www\.|m\.)/, "");
  let videoId: string | undefined;

  if (host === "youtu.be") {
    videoId = parsed.pathname.slice(1).split("/")[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [first, second] = parsed.pathname.split("/").filter(Boolean);
    if (first === "watch") videoId = parsed.searchParams.get("v") ?? undefined;
    else if (first === "embed" || first === "shorts" || first === "live")
      videoId = second;
    else if (first !== "playlist") return null;
  } else {
    return null;
  }

  const list = parsed.searchParams.get("list") ?? undefined;
  const target: YoutubeTarget = {
    ...(videoId && VIDEO_ID.test(videoId) ? { videoId } : {}),
    ...(list && LIST_ID.test(list) ? { listId: list } : {}),
  };

  return target.videoId || target.listId ? target : null;
}

/** Fração assistida a partir da qual o vídeo conta como concluído. */
export const VIDEO_COMPLETION_RATIO = 0.9;
