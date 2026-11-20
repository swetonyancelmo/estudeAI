/**
 * Curadoria das videoaulas do YouTube das trilhas.
 *
 *   pnpm videos list frontend                    # tópicos para colar no prompt
 *   pnpm videos list frontend --missing          # só os com menos de 2 vídeos
 *   pnpm videos list frontend --module fundamentos-da-web
 *   pnpm videos import frontend aulas.json       # valida e grava no JSON da trilha
 *   pnpm videos import frontend aulas.json --dry-run   # só confere, não grava
 *   pnpm videos import frontend aulas.json --replace   # troca os vídeos atuais
 *
 * O arquivo de entrada é o que o Claude web devolve (docs/PROMPT-VIDEOS.md):
 *
 *   { "<slug-do-topico>": [ { "url": "https://...", "title": "..." }, ... ] }
 *
 * Nenhum link entra sem passar pelo oEmbed do YouTube (sem chave, sem cota):
 *  - 200: o vídeo existe e pode ser incorporado. Grava a URL canônica
 *    (`watch?v=<id>`), o título REAL do vídeo e o canal — não o que a IA escreveu.
 *  - 401: o vídeo existe, mas o dono bloqueou a incorporação. É mantido (a tela
 *    mostra o botão "Assistir no YouTube"), porém depois dos que tocam no site.
 *  - 400/403/404: inexistente, removido ou privado. Recusado.
 *  - qualquer outra falha (rede, 5xx): NÃO decide nada. O vídeo fica de fora e é
 *    listado como "não verificado" para rodar de novo, em vez de ser descartado
 *    por um soluço de rede.
 *
 * Só o bloco `videos` de cada tópico muda no texto do JSON: o diff mostra apenas
 * as aulas. Revise o diff antes de commitar.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_TOPIC_VIDEOS,
  TRACK_SLUGS,
  validateTrackContent,
  type TrackContent,
  type TrackSlug,
  type TrackVideoContent,
} from '../src/tracks/track-content';
import {
  canonicalYoutubeUrl,
  parseYoutubeVideoId,
} from '../src/tracks/youtube-video-url';
import { assertSameContent, setTopicField } from './track-json-docs';

const CONTENT_DIR = join(__dirname, '..', 'src', 'tracks', 'content');
const OEMBED_URL = 'https://www.youtube.com/oembed';
const FETCH_TIMEOUT_MS = 15_000;
const DELAY_MS = 300;
/** Meta do projeto: mais de um vídeo por tópico, para um sumir sem deixar buraco. */
const MIN_VIDEOS = 2;

type Verdict =
  | { ok: true; video: TrackVideoContent; embeddable: boolean }
  | { ok: false; reason: string; unverified?: boolean };

interface Suggestion {
  url: string;
  title?: string;
}

const USAGE = `Uso:
  pnpm videos list <${TRACK_SLUGS.join('|')}> [--missing] [--module <slug>]
  pnpm videos import <${TRACK_SLUGS.join('|')}> <arquivo.json> [--dry-run] [--replace]`;

function trackArg(value: string | undefined): TrackSlug {
  if (!TRACK_SLUGS.includes(value as TrackSlug)) throw new Error(USAGE);
  return value as TrackSlug;
}

function loadFile(track: TrackSlug) {
  const file = join(CONTENT_DIR, `${track}.json`);
  const content = JSON.parse(readFileSync(file, 'utf8')) as TrackContent;
  return { file, content };
}

/** Lista os tópicos no formato que o prompt pede: um por linha, com o slug. */
function list(argv: string[]) {
  const track = trackArg(argv[0]);
  const missing = argv.includes('--missing');
  const moduleIndex = argv.indexOf('--module');
  const onlyModule = moduleIndex >= 0 ? argv[moduleIndex + 1] : undefined;

  const { content } = loadFile(track);
  if (onlyModule && !content.modules.some((m) => m.slug === onlyModule)) {
    throw new Error(
      `Módulo "${onlyModule}" não existe. Módulos: ${content.modules
        .map((m) => m.slug)
        .join(', ')}`,
    );
  }

  let count = 0;
  for (const module of content.modules) {
    if (onlyModule && module.slug !== onlyModule) continue;
    const topics = module.topics.filter(
      (topic) => !missing || (topic.videos?.length ?? 0) < MIN_VIDEOS,
    );
    if (topics.length === 0) continue;
    console.log(`\n## ${module.title} (módulo: ${module.slug})`);
    for (const topic of topics) {
      count++;
      console.log(
        `- ${topic.slug} | ${topic.title} | nível: ${topic.level} | busca: ${topic.searchQuery}`,
      );
    }
  }
  console.error(
    `\n${count} tópico(s) em "${track}"${missing ? ` com menos de ${MIN_VIDEOS} vídeos` : ''}.`,
  );
}

/** Aceita `"url"` solta ou `{ url, title? }`; ignora o que não tem cara de sugestão. */
function parseSuggestions(raw: unknown): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((item): Suggestion[] => {
    if (typeof item === 'string') return [{ url: item }];
    if (typeof item !== 'object' || item === null) return [];
    const { url, title } = item as { url?: unknown; title?: unknown };
    if (typeof url !== 'string') return [];
    return [{ url, ...(typeof title === 'string' ? { title } : {}) }];
  });
}

/** Tira cercas de markdown caso o JSON tenha sido copiado com ```json … ```. */
function parseInput(text: string): Record<string, unknown> {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed: unknown = JSON.parse(unfenced);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      'O arquivo deve ser um objeto { "<slug>": [ { "url": ... } ] }.',
    );
  }
  return parsed as Record<string, unknown>;
}

async function verify(suggestion: Suggestion): Promise<Verdict> {
  const id = parseYoutubeVideoId(suggestion.url);
  if (!id) return { ok: false, reason: 'não é link de vídeo do YouTube' };
  const url = canonicalYoutubeUrl(id);

  let response: Response;
  try {
    const endpoint = new URL(OEMBED_URL);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('url', url);
    response = await fetch(endpoint, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'falha de rede', unverified: true };
  }

  if (response.status === 401) {
    // Existe, mas sem incorporação: o oEmbed não devolve título nesse caso.
    const title = suggestion.title?.trim();
    if (!title) {
      return {
        ok: false,
        reason: 'incorporação bloqueada e sem título informado',
      };
    }
    return { ok: true, video: { title, url }, embeddable: false };
  }
  if ([400, 403, 404].includes(response.status)) {
    return {
      ok: false,
      reason: `não existe, foi removido ou é privado (HTTP ${response.status})`,
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: `YouTube respondeu HTTP ${response.status}`,
      unverified: true,
    };
  }

  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
  };
  const title = data.title?.trim();
  if (!title) return { ok: false, reason: 'resposta do oEmbed sem título' };
  const channel = data.author_name?.trim();
  return {
    ok: true,
    video: { title, url, ...(channel ? { channel } : {}) },
    embeddable: true,
  };
}

/** Atuais primeiro, depois os novos (os que tocam no site antes dos bloqueados). */
function mergeVideos(
  current: TrackVideoContent[],
  added: { video: TrackVideoContent; embeddable: boolean }[],
): { videos: TrackVideoContent[]; overflow: number } {
  const sorted = [...added].sort(
    (a, b) => Number(b.embeddable) - Number(a.embeddable),
  );
  const seen = new Set<string>();
  const all: TrackVideoContent[] = [];
  for (const video of [...current, ...sorted.map((item) => item.video)]) {
    if (seen.has(video.url)) continue;
    seen.add(video.url);
    all.push(video);
  }
  return {
    videos: all.slice(0, MAX_TOPIC_VIDEOS),
    overflow: Math.max(0, all.length - MAX_TOPIC_VIDEOS),
  };
}

async function importVideos(argv: string[]) {
  const track = trackArg(argv[0]);
  const inputPath = argv[1];
  if (!inputPath || inputPath.startsWith('--')) throw new Error(USAGE);
  const dryRun = argv.includes('--dry-run');
  const replace = argv.includes('--replace');

  const input = parseInput(readFileSync(inputPath, 'utf8'));
  const { file, content } = loadFile(track);
  const topics = new Map(
    content.modules.flatMap((module) =>
      module.topics.map((topic) => [topic.slug, topic] as const),
    ),
  );

  const unknown = Object.keys(input).filter((slug) => !topics.has(slug));
  const slugs = Object.keys(input).filter((slug) => topics.has(slug));
  console.log(
    `Trilha ${track}: ${slugs.length} tópico(s) no arquivo${dryRun ? ' (dry-run: nada será gravado)' : ''}.\n`,
  );

  const totals = { accepted: 0, blocked: 0, rejected: 0, unverified: 0 };
  const unverifiedTopics: string[] = [];
  let first = true;

  for (const slug of slugs) {
    const topic = topics.get(slug)!;
    console.log(`• ${topic.title}  (${slug})`);

    const accepted: { video: TrackVideoContent; embeddable: boolean }[] = [];
    let hadUnverified = false;
    for (const suggestion of parseSuggestions(input[slug])) {
      if (!first) await new Promise((r) => setTimeout(r, DELAY_MS));
      first = false;

      const verdict = await verify(suggestion);
      if (!verdict.ok) {
        if (verdict.unverified) {
          totals.unverified++;
          hadUnverified = true;
        } else {
          totals.rejected++;
        }
        console.log(`  ✗ ${suggestion.url} (${verdict.reason})`);
      } else if (accepted.some((a) => a.video.url === verdict.video.url)) {
        console.log(`  = ${verdict.video.url} (repetido no arquivo)`);
      } else {
        accepted.push(verdict);
        if (verdict.embeddable) totals.accepted++;
        else totals.blocked++;
        console.log(
          `  ✓ ${verdict.video.title} — ${verdict.video.channel ?? 's/ canal'}` +
            (verdict.embeddable ? '' : '  [incorporação bloqueada]'),
        );
      }
    }
    if (hadUnverified) unverifiedTopics.push(slug);

    const { videos, overflow } = mergeVideos(
      replace ? [] : (topic.videos ?? []),
      accepted,
    );
    if (overflow > 0) {
      console.log(
        `  ! ${overflow} vídeo(s) além do limite de ${MAX_TOPIC_VIDEOS}.`,
      );
    }
    // Nada válido e nada a perder: não mexe no tópico (nem apaga o que havia).
    if (accepted.length === 0) continue;

    topic.videos = videos;
    if (dryRun) continue;

    // Grava a cada tópico: interromper no meio não perde o que já foi checado.
    validateTrackContent(content, track);
    const text = setTopicField(
      readFileSync(file, 'utf8'),
      slug,
      'videos',
      topic.videos,
    );
    assertSameContent(text, content);
    writeFileSync(file, text);
  }

  const thin = [...topics.values()].filter(
    (topic) => (topic.videos?.length ?? 0) < MIN_VIDEOS,
  );
  console.log(
    `\nAceitos: ${totals.accepted} · incorporação bloqueada (mantidos): ${totals.blocked} · recusados: ${totals.rejected} · não verificados: ${totals.unverified}`,
  );
  if (unknown.length > 0) {
    console.log(
      `\nSlugs que não existem na trilha (ignorados, confira o prompt):\n- ${unknown.join('\n- ')}`,
    );
  }
  if (unverifiedTopics.length > 0) {
    console.log(
      `\nTópicos com links não verificados por falha de rede — rode de novo:\n- ${unverifiedTopics.join('\n- ')}`,
    );
  }
  console.log(
    `\nTópicos da trilha com menos de ${MIN_VIDEOS} vídeos: ${thin.length} de ${topics.size}` +
      ` (veja com: pnpm videos list ${track} --missing)`,
  );
  if (!dryRun) {
    console.log(
      `Revise o diff de src/tracks/content/${track}.json antes de commitar.`,
    );
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'list') return list(rest);
  if (command === 'import') return importVideos(rest);
  throw new Error(USAGE);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
