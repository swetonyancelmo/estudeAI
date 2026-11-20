const VIDEO_ID = /^[\w-]{11}$/;

/**
 * Extrai o id de um VÍDEO do YouTube de qualquer formato comum de URL
 * (`watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`). Playlist sem
 * vídeo, canal e qualquer outro host devolvem `null`: as aulas curadas são
 * vídeos avulsos.
 */
export function parseYoutubeVideoId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  let id: string | undefined;

  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [first, second] = url.pathname.split('/').filter(Boolean);
    if (first === 'watch') id = url.searchParams.get('v') ?? undefined;
    else if (first === 'embed' || first === 'shorts' || first === 'live') {
      id = second;
    }
  }

  return id && VIDEO_ID.test(id) ? id : null;
}

/** Forma única gravada no JSON: o mesmo vídeo nunca entra duas vezes. */
export function canonicalYoutubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** true se a URL já está na forma canônica gravada pelo script de importação. */
export function isCanonicalYoutubeUrl(value: string): boolean {
  const id = parseYoutubeVideoId(value);
  return id !== null && value === canonicalYoutubeUrl(id);
}

/**
 * Miniatura padrão do vídeo. O host `i.ytimg.com/vi/**` é o único remoto que o
 * `next.config.ts` do web libera, então a URL só pode ter esta forma.
 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
