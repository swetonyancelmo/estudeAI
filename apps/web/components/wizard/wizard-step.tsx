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
 * Uma pergunta por tela (FR-01.1) com as opções como cards selecionáveis.
 * A transição suave (NFR-03) vem das classes do tw-animate-css; o pai remonta
 * este componente via `key` a cada step, o que redispara a animação de entrada.
 */
export function WizardStep({
  direction,
  title,
  subtitle,
  options,
  selected,
  onSelect,
}: WizardStepProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 duration-300 animate-in fade-in-0",
        direction === "forward"
          ? "slide-in-from-right-8"
          : "slide-in-from-left-8",
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>

      <div role="radiogroup" aria-label={title} className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(option.value)}
              className={cn(
                "group flex items-center justify-between gap-4 rounded-xl border p-4 text-left transition-all outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-foreground/20 hover:bg-muted/50",
              )}
            >
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{option.label}</span>
                <span className="text-muted-foreground text-sm">
                  {option.hint}
                </span>
              </span>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {isSelected && <Check className="size-3.5" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
