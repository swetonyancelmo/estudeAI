import { useEffect } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepDirection } from "@/lib/wizard/store";

interface WizardStepProps {
  direction: StepDirection;
  title: string;
  subtitle: string;
  options: ReadonlyArray<{ value: string; label: string; hint: string }>;
  selected: string | undefined;
  onSelect: (value: string) => void;
}

/**
 * Uma pergunta grande por tela (FR-01.1), com as opções como cards
 * selecionáveis. Cada opção tem um atalho numérico (1, 2, 3) mostrado na
 * própria tecla desenhada à esquerda. A transição suave (NFR-03) vem das
 * classes do tw-animate-css; o pai remonta este componente via `key` a cada
 * step, o que redispara a animação de entrada.
 */
export function WizardStep({
  direction,
  title,
  subtitle,
  options,
  selected,
  onSelect,
}: WizardStepProps) {
  // Atalhos 1..n. Ignora quando há modificador ou foco em campo de texto.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const option = options[Number(event.key) - 1];
      if (option) onSelect(option.value);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [options, onSelect]);

  return (
    <div
      className={cn(
        "flex flex-col gap-8 duration-300 animate-in fade-in-0",
        direction === "forward"
          ? "slide-in-from-right-8"
          : "slide-in-from-left-8",
      )}
    >
      <div className="flex flex-col gap-3">
        <h1>{title}</h1>
        <p className="text-muted-foreground text-lg">{subtitle}</p>
      </div>

      <div role="radiogroup" aria-label={title} className="flex flex-col gap-3">
        {options.map((option, index) => {
          const isSelected = selected === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-keyshortcuts={String(index + 1)}
              onClick={() => onSelect(option.value)}
              className={cn(
                "group bg-card flex items-center gap-4 rounded-lg border p-4 text-left transition-[border-color,box-shadow,transform,background-color] duration-150 sm:p-5",
                isSelected
                  ? "border-brand bg-brand-soft shadow-[0_3px_0_var(--brand)]"
                  : "border-input shadow-[0_3px_0_var(--border)] hover:border-foreground/40 hover:-translate-y-0.5",
              )}
            >
              <span
                className={cn(
                  "data-label flex size-9 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                  isSelected
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-input text-ink-faint group-hover:border-foreground/40",
                )}
                aria-hidden="true"
              >
                {isSelected ? (
                  <Check className="size-4" strokeWidth={3.5} />
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-heading text-xl font-bold">
                  {option.label}
                </span>
                <span className="text-muted-foreground text-sm">
                  {option.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
