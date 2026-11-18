import type { ReactNode } from "react";

/** Texto curto com `código` entre crases renderizado como código. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, index) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
          <code
            key={index}
            className="bg-muted rounded-sm px-1 py-0.5 font-mono text-sm"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Enunciado em blocos: parágrafos separados por linha em branco, e linhas que
 * começam com "- " viram lista. Sem Markdown completo de propósito: o conteúdo
 * é curado, e isto cobre o que os enunciados usam.
 */
export function StudyText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index): ReactNode => {
        const lines = block.split("\n");
        if (lines.every((line) => line.trimStart().startsWith("- "))) {
          return (
            <ul key={index} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  <InlineText text={line.trimStart().slice(2)} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            <InlineText text={lines.join(" ")} />
          </p>
        );
      })}
    </div>
  );
}
