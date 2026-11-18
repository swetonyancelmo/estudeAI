"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText } from "./study-text";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Alternativas de uma pergunta de múltipla escolha, no quiz do tópico e na
 * revisão espaçada. Antes da resposta são botões; depois, a certa fica em
 * verde e a escolhida errada em vermelho, com ícone além da cor.
 */
export function AnswerOptions({
  options,
  result,
  disabled,
  onChoose,
}: {
  options: string[];
  /** Correção da resposta; nulo enquanto não respondeu. */
  result: { chosenIndex: number; answerIndex: number } | null;
  disabled: boolean;
  onChoose: (index: number) => void;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Alternativas">
      {options.map((option, optionIndex) => {
        const isChosen = result?.chosenIndex === optionIndex;
        const isAnswer = result?.answerIndex === optionIndex;
        return (
          <li key={optionIndex}>
            <button
              type="button"
              onClick={() => onChoose(optionIndex)}
              disabled={Boolean(result) || disabled}
              aria-pressed={isChosen}
              className={cn(
                "border-border flex min-h-11 w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                !result && "hover:border-line hover:bg-muted",
                "disabled:cursor-default",
                isAnswer && "border-success bg-success-soft",
                isChosen && !isAnswer && "border-destructive bg-destructive/10",
              )}
            >
              <span
                className={cn(
                  "bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium",
                  isAnswer && "bg-success text-white",
                  isChosen && !isAnswer && "bg-destructive text-white",
                )}
                aria-hidden="true"
              >
                {isAnswer ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : isChosen ? (
                  <X className="size-3.5" strokeWidth={3} />
                ) : (
                  LETTERS[optionIndex]
                )}
              </span>
              <span className="min-w-0 flex-1">
                <InlineText text={option} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
