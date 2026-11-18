import { isDeepStrictEqual } from 'node:util';
import type {
  TrackDocContent,
  TrackQuizQuestionContent,
} from '../src/tracks/track-content';

/**
 * Grava UM campo de UM tópico direto no texto do JSON da trilha, sem
 * reformatar o resto do arquivo: o diff mostra só aquele campo, e é ele que a
 * pessoa revisa antes do commit.
 *
 * O tópico é achado pelo `"slug"` (único na trilha). Se o campo já existe, o
 * valor é substituído; senão, o campo entra como último do tópico. O valor é
 * escrito como `JSON.stringify(valor, null, 2)` na indentação do tópico.
 */
export function setTopicField(
  text: string,
  slug: string,
  field: string,
  value: unknown,
): string {
  const slugMatch = new RegExp(
    `\\n([ \\t]+)"slug": ${escapeRegExp(JSON.stringify(slug))},\\n`,
  ).exec(text);
  if (!slugMatch) throw new Error(`tópico "${slug}" não encontrado no texto`);
  const indent = slugMatch[1];
  const bodyStart = slugMatch.index + 1;
  const close = closingBrace(text, bodyStart);
  const rendered = renderValue(value, indent);

  const key = new RegExp(
    `\\n${indent}${escapeRegExp(JSON.stringify(field))}: `,
    'g',
  );
  key.lastIndex = bodyStart;
  const existing = key.exec(text);
  if (existing && existing.index < close) {
    const valueStart = existing.index + existing[0].length;
    const valueEnd = endOfValue(text, valueStart);
    return `${text.slice(0, valueStart)}${rendered}${text.slice(valueEnd)}`;
  }

  // Campo novo: depois do último valor do tópico, antes do `}` que o fecha.
  let last = close - 1;
  while (/\s/.test(text[last])) last--;
  return (
    `${text.slice(0, last + 1)},\n${indent}${JSON.stringify(field)}: ` +
    `${rendered}${text.slice(last + 1)}`
  );
}

export function setTopicDocs(
  text: string,
  slug: string,
  docs: TrackDocContent[],
): string {
  return setTopicField(text, slug, 'docs', docs);
}

export function setTopicQuiz(
  text: string,
  slug: string,
  quiz: TrackQuizQuestionContent[],
): string {
  return setTopicField(text, slug, 'quiz', quiz);
}

function renderValue(value: unknown, indent: string): string {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join('\n');
}

/** Índice do `}` que fecha o objeto aberto antes de `from` (ciente de strings). */
function closingBrace(text: string, from: number): number {
  let depth = 1;
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      i = endOfString(text, i) - 1;
    } else if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('JSON desbalanceado');
}

/** Índice logo depois do valor JSON que começa em `start`. */
function endOfValue(text: string, start: number): number {
  const char = text[start];
  if (char === '"') return endOfString(text, start);
  if (char === '{' || char === '[') return closingBrace(text, start + 1) + 1;
  const match = /^[^,\n}\]]+/.exec(text.slice(start));
  return start + (match ? match[0].trimEnd().length : 0);
}

/** Índice logo depois da string JSON que abre em `start`. */
function endOfString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === '"') return i + 1;
  }
  throw new Error('string JSON sem fim');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Garante que o texto gravado é exatamente o conteúdo esperado. */
export function assertSameContent(text: string, expected: unknown): void {
  if (!isDeepStrictEqual(JSON.parse(text), expected)) {
    throw new Error('o texto do JSON não bate com o conteúdo esperado');
  }
}
