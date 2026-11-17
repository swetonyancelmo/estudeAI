import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepDirection } from "@/lib/wizard/store";

interface WizardMultiStepProps {
  direction: StepDirection;
  title: string;
  subtitle: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  none: { label: string; hint: string };
  /** `undefined` = pergunta ainda não respondida; `[]` = "nenhuma". */
  selected: ReadonlyArray<string> | undefined;
  onToggle: (value: string) => void;
  onNone: () => void;
}

/**
 * Pergunta de múltipla escolha do diagnóstico ("o que você já sabe?").
 *
 * Irmã do `WizardStep`, com a mesma entrada animada, mas outra interação: nada
 * avança sozinho (a pessoa pode marcar várias) e há uma saída explícita para
 * quem não marca nenhuma — sem ela, "não sei nada ainda" e "ainda não respondi"
 * seriam a mesma tela, e o botão de avançar não teria como distinguir.
 */
export function WizardMultiStep({
  direction,
  title,
  subtitle,
  options,
  none,
  selected,
  onToggle,
  onNone,
}: WizardMultiStepProps) {
  const noneSelected = selected !== undefined && selected.length === 0;

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

      <div role="group" aria-label={title} className="flex flex-col gap-4">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {options.map((option) => {
            const isSelected = selected?.includes(option.value) ?? false;

            return (
              <li key={option.value}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onToggle(option.value)}
                  className={cn(
                    "bg-card flex min-h-12 w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left font-medium transition-[border-color,box-shadow,background-color] duration-150",
                    isSelected
                      ? "border-brand bg-brand-soft shadow-[0_2px_0_var(--brand)]"
                      : "border-input hover:border-foreground/40 shadow-[0_2px_0_var(--border)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors",
                      isSelected
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-input",
                    )}
                    aria-hidden="true"
                  >
                    {isSelected && <Check className="size-3.5" strokeWidth={3.5} />}
                  </span>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          aria-pressed={noneSelected}
          onClick={onNone}
          className={cn(
            "bg-card flex flex-col gap-0.5 rounded-lg border border-dashed px-4 py-3 text-left transition-[border-color,background-color] duration-150",
            noneSelected
              ? "border-brand bg-brand-soft border-solid"
              : "border-input hover:border-foreground/40",
          )}
        >
          <span className="font-heading text-lg font-bold">{none.label}</span>
          <span className="text-muted-foreground text-sm">{none.hint}</span>
        </button>
      </div>
    </div>
  );
}
