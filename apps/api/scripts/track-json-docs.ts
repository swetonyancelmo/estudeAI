import { isDeepStrictEqual } from 'node:util';
import type { TrackDocContent } from '../src/tracks/track-content';

/**
 * Grava o campo `docs` de UM tópico direto no texto do JSON da trilha, sem
 * reformatar o resto do arquivo: o diff mostra só as docs, e é ele que a
 * pessoa revisa antes do commit.
 *
 * O tópico é achado pelo `"slug"` (único na trilha). Se já tem `"docs"`, o
 * bloco é substituído; senão, é acrescentado depois do `"searchQuery"`, que é
 * o último campo do tópico nos arquivos versionados.
 */
export function setTopicDocs(
  text: string,
  slug: string,
  docs: TrackDocContent[],
): string {
  const slugMatch = new RegExp(
    `\\n([ \\t]+)"slug": ${escapeRegExp(JSON.stringify(slug))},\\n`,
  ).exec(text);
  if (!slugMatch) throw new Error(`tópico "${slug}" não encontrado no texto`);
  const indent = slugMatch[1];

  const queryLine = new RegExp(
    `\\n${indent}"searchQuery": "(?:[^"\\\\]|\\\\.)*"`,
    'g',
  );
  queryLine.lastIndex = slugMatch.index + slugMatch[0].length;
  const query = queryLine.exec(text);
  if (!query) throw new Error(`tópico "${slug}" sem searchQuery`);
  const afterQuery = query.index + query[0].length;

  const block = renderDocs(docs, indent);
  const existing = new RegExp(`^,\\n${indent}"docs": \\[`).exec(
    text.slice(afterQuery),
  );
  if (!existing) {
    return `${text.slice(0, afterQuery)},\n${indent}${block}${text.slice(afterQuery)}`;
  }

  // Fim do bloco atual: o `]` que fecha `"docs"` na mesma indentação, ou o
  // `[]` vazio na própria linha.
  const start = afterQuery + 2 + indent.length;
  const rest = text.slice(start);
  const emptyEnd = /^"docs": \[\]/.exec(rest);
  const end = emptyEnd
    ? start + emptyEnd[0].length
    : start + rest.indexOf(`\n${indent}]`) + 1 + indent.length + 1;
  return `${text.slice(0, start)}${block}${text.slice(end)}`;
}

function renderDocs(docs: TrackDocContent[], indent: string): string {
  if (docs.length === 0) return '"docs": []';
  const pad = (extra: number) => indent + ' '.repeat(extra);
  const items = docs
    .map(
      (doc) =>
        `${pad(2)}{\n${pad(4)}"title": ${JSON.stringify(doc.title)},\n` +
        `${pad(4)}"url": ${JSON.stringify(doc.url)}\n${pad(2)}}`,
    )
    .join(',\n');
  return `"docs": [\n${items}\n${indent}]`;
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
