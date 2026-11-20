"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

/**
 * Alternativas ainda sem resposta, como `RadioGroup` (quiz do tópico). Setas e
 * clique só escolhem; Enter ou "Responder" confirmam. Depois da correção, o
 * quiz volta a mostrar `AnswerOptions`, com a certa e a errada marcadas.
 *
 * Com `shortcuts` (revisão espaçada), as teclas 1 a n escolhem a alternativa,
 * com a tecla desenhada em `Kbd` ao lado de cada uma, e Enter confirma.
 */
export function AnswerRadioGroup({
  options,
  pending,
  onAnswer,
  shortcuts = false,
}: {
  options: string[];
  pending: boolean;
  onAnswer: (index: number) => void;
  shortcuts?: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const group = useRef<HTMLDivElement>(null);

  // Atalhos 1..n e Enter, fora de campos de texto e sem modificador.
  const latest = useRef({ chosen, submit: () => {} });
  useEffect(() => {
    if (!shortcuts) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length) {
        event.preventDefault();
        setChosen(String(index));
        group.current
          ?.querySelectorAll<HTMLElement>("[role=radio]")
          [index]?.focus();
      } else if (event.key === "Enter" && latest.current.chosen !== null) {
        // Dentro do grupo o Enter já é tratado; aqui cobre o foco fora dele.
        if (group.current?.contains(target)) return;
        event.preventDefault();
        latest.current.submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts, options.length]);

  function submit() {
    if (chosen === null || pending) return;
    onAnswer(Number(chosen));
  }
  useEffect(() => {
    latest.current = { chosen, submit };
  });

  return (
    <form
      className="flex flex-col items-start gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <RadioGroup
        ref={group}
        aria-label="Alternativas"
        value={chosen}
        onValueChange={(value) => setChosen(value as string)}
        disabled={pending}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
      >
        {options.map((option, optionIndex) => {
          const value = String(optionIndex);
          return (
            <label
              key={optionIndex}
              className={cn(
                "border-border hover:border-line hover:bg-muted flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
                chosen === value && "border-line bg-line-soft hover:bg-line-soft",
              )}
            >
              <RadioGroupItem value={value} className="mt-0.5" />
              <span className="text-muted-foreground font-mono text-xs leading-6" aria-hidden="true">
                {LETTERS[optionIndex]}
              </span>
              <span className="min-w-0 flex-1">
                <InlineText text={option} />
              </span>
              {shortcuts && (
                <Kbd className="mt-0.5 hidden sm:inline-flex" aria-hidden="true">
                  {optionIndex + 1}
                </Kbd>
              )}
            </label>
          );
        })}
      </RadioGroup>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={chosen === null || pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Responder
        </Button>
        <span className="text-ink-faint hidden items-center gap-1.5 text-xs sm:flex">
          <Kbd>Enter</Kbd> confirma
        </span>
      </div>
    </form>
  );
}
