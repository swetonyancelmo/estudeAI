/**
 * Curadoria da documentação oficial das trilhas (Fase 2).
 *
 *   pnpm docs:curate frontend            # tópicos ainda sem `docs`
 *   pnpm docs:curate frontend --force    # refaz todos
 *   pnpm docs:curate frontend --limit 5  # só os 5 primeiros pendentes
 *
 * O Gemini SUGERE links; nenhum entra sem passar por uma requisição de verdade:
 *  - MDN: a versão JSON da página precisa existir (pt-BR, senão en-US). Grava
 *    a URL canônica e o título real da página, não o que a IA escreveu.
 *  - outros sites: GET com redirect, status 200, e o destino final continua num
 *    domínio de OFFICIAL_DOC_HOSTS.
 *
 * O resultado vai direto para `src/tracks/content/<trilha>.json`. Ele NÃO é
 * confiável sem revisão humana: revise o diff antes de commitar.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  MAX_TOPIC_DOCS,
  OFFICIAL_DOC_HOSTS,
  TRACK_SLUGS,
  isOfficialDocUrl,
  validateTrackContent,
  type TrackContent,
  type TrackDocContent,
  type TrackSlug,
} from '../src/tracks/track-content';
import { mdnJsonUrl, parseMdnUrl } from '../src/docs/mdn-url';
import { generateJson, sleep } from './gemini-json';
import { assertSameContent, setTopicDocs } from './track-json-docs';

const CONTENT_DIR = join(__dirname, '..', 'src', 'tracks', 'content');
const DOCS_PER_TOPIC = 3;
const FETCH_TIMEOUT_MS = 20_000;
const DELAY_MS = 1_500;
const USER_AGENT =
  'Mozilla/5.0 (compatible; estudeAI-docs-curator/1.0; +https://github.com/)';

const SYSTEM_INSTRUCTION = `Você é curador de uma plataforma brasileira de estudos de programação.
Para cada tópico, indique de 1 a ${DOCS_PER_TOPIC} páginas da DOCUMENTAÇÃO OFICIAL da tecnologia que melhor ensinam aquele assunto.
Regras:
- Só URLs dos domínios: ${OFFICIAL_DOC_HOSTS.join(', ')} (ou subdomínios deles).
- Nada de blog, curso, vídeo ou tutorial de terceiros.
- Para HTML, CSS, JavaScript, HTTP e APIs do navegador, prefira a MDN em pt-BR (https://developer.mozilla.org/pt-BR/docs/...).
- Prefira páginas específicas do assunto a páginas iniciais genéricas.
- Só indique URLs que você tem certeza de que existem. Na dúvida, indique menos links.
- "title" é um título curto em português descrevendo a página.`;

interface Suggestion {
  title: string;
  url: string;
}

function parseArgs() {
  const [track, ...rest] = process.argv.slice(2);
  if (!TRACK_SLUGS.includes(track as TrackSlug)) {
    throw new Error(
      `Uso: pnpm docs:curate <${TRACK_SLUGS.join('|')}> [--force] [--limit N]`,
    );
  }
  const limitIndex = rest.indexOf('--limit');
  return {
    track: track as TrackSlug,
    force: rest.includes('--force'),
    limit: limitIndex >= 0 ? Number(rest[limitIndex + 1]) : Infinity,
  };
}

async function suggest(
  ai: GoogleGenAI,
  context: { track: string; module: string; topic: string },
): Promise<Suggestion[]> {
  const parsed = await generateJson<{ docs?: Suggestion[] }>(ai, {
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Trilha: ${context.track}\nMódulo: ${context.module}\nTópico: ${context.topic}`,
    schema: {
      type: Type.OBJECT,
      properties: {
        docs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              url: { type: Type.STRING },
            },
            required: ['title', 'url'],
          },
        },
      },
      required: ['docs'],
    },
  });
  return (parsed.docs ?? []).slice(0, DOCS_PER_TOPIC + 2);
}

/**
 * Links que respondem 200 mas não servem como leitura de um tópico: a página
 * inicial de um site (genérica demais) e as páginas de desambiguação e legado
 * da MDN (`/docs/conflicting/`, `/docs/orphaned/`).
 */
function weakDocReason(value: string): string | null {
  const url = new URL(value);
  if (url.pathname === '/' || url.pathname === '')
    return 'página inicial, genérica demais';
  if (/\/docs\/(conflicting|orphaned)\//.test(url.pathname))
    return 'página de legado da MDN';
  return null;
}

/** Confere a sugestão de verdade. Devolve o link final ou o motivo da recusa. */
async function verify(
  suggestion: Suggestion,
): Promise<TrackDocContent | string> {
  if (!isOfficialDocUrl(suggestion.url)) return 'domínio não oficial';
  const weak = weakDocReason(suggestion.url);
  if (weak) return weak;

  const mdnSlug = parseMdnUrl(suggestion.url);
  if (mdnSlug) {
    for (const locale of ['pt-BR', 'en-US'] as const) {
      const response = await get(mdnJsonUrl(locale, mdnSlug));
      if (!response) return 'falha de rede';
      if (response.status === 404) continue;
      if (!response.ok) return `MDN respondeu ${response.status}`;
      const json = (await response.json()) as {
        doc?: { title?: string; mdn_url?: string };
      };
      if (!json.doc?.mdn_url || !json.doc.title)
        return 'JSON da MDN inesperado';
      const canonical = `https://developer.mozilla.org${json.doc.mdn_url}`;
      return (
        weakDocReason(canonical) ?? { title: json.doc.title, url: canonical }
      );
    }
    return 'não existe na MDN';
  }

  const response = await get(suggestion.url);
  if (!response) return 'falha de rede';
  if (!response.ok) return `HTTP ${response.status}`;
  // Sem âncora e sem `hl`: o idioma fica por conta do navegador de quem abrir.
  const final = new URL(response.url);
  final.hash = '';
  final.searchParams.delete('hl');
  const finalUrl = final.toString();
  if (!isOfficialDocUrl(finalUrl))
    return `redirecionou para fora (${finalUrl})`;
  const weakFinal = weakDocReason(finalUrl);
  if (weakFinal) return `${weakFinal} (${finalUrl})`;
  return { title: suggestion.title.trim(), url: finalUrl };
}

async function get(url: string): Promise<Response | null> {
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'user-agent': USER_AGENT,
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });
  } catch {
    return null;
  }
}

async function main() {
  const { track, force, limit } = parseArgs();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY ausente no .env da API.');
  const ai = new GoogleGenAI({ apiKey });

  const file = join(CONTENT_DIR, `${track}.json`);
  const content = JSON.parse(readFileSync(file, 'utf8')) as TrackContent;

  const pending = content.modules.flatMap((module) =>
    module.topics
      .filter((topic) => force || !topic.docs || topic.docs.length === 0)
      .map((topic) => ({ module, topic })),
  );
  const batch = pending.slice(0, limit);
  console.log(
    `Trilha ${track}: ${batch.length} de ${pending.length} tópico(s) pendente(s).\n`,
  );

  let accepted = 0;
  let rejected = 0;
  const empty: string[] = [];

  for (const [index, { module, topic }] of batch.entries()) {
    if (index > 0) await sleep(DELAY_MS);
    console.log(`• ${topic.title}`);

    let suggestions: Suggestion[];
    try {
      suggestions = await suggest(ai, {
        track: content.title,
        module: module.title,
        topic: topic.title,
      });
    } catch (error) {
      console.log(
        `  ✗ Gemini falhou: ${String(error).slice(0, 160)} — parando aqui.`,
      );
      break;
    }

    const docs: TrackDocContent[] = [];
    for (const suggestion of suggestions) {
      if (docs.length >= DOCS_PER_TOPIC) break;
      const result = await verify(suggestion);
      if (typeof result === 'string') {
        rejected++;
        console.log(`  ✗ ${suggestion.url} (${result})`);
      } else if (docs.some((doc) => doc.url === result.url)) {
        console.log(`  = ${result.url} (repetido)`);
      } else {
        accepted++;
        docs.push(result);
        console.log(`  ✓ ${result.url}`);
      }
    }

    topic.docs = docs.slice(0, MAX_TOPIC_DOCS);
    if (docs.length === 0) empty.push(topic.title);

    // Grava a cada tópico: interromper no meio não perde o que já foi checado.
    validateTrackContent(content, track);
    // Só o bloco `docs` do tópico muda no texto: o diff mostra só as docs.
    const text = setTopicDocs(
      readFileSync(file, 'utf8'),
      topic.slug,
      topic.docs,
    );
    assertSameContent(text, content);
    writeFileSync(file, text);
  }

  console.log(`\nAceitos: ${accepted} · recusados: ${rejected}`);
  if (empty.length > 0) {
    console.log(
      `Sem nenhum link válido (${empty.length}):\n- ${empty.join('\n- ')}`,
    );
  }
  console.log(
    `\nRevise o diff de src/tracks/content/${track}.json antes de commitar.`,
  );
}

main()
  // Conexões abertas do SDK seguram o processo vivo: sai ao terminar.
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
