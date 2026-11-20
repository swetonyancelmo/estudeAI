import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { StepDirection } from "@/lib/wizard/store";

interface WizardMultiStepProps {
  direction: StepDirection;
  title: string;
  subtitle: string;
  options: ReadonlyArray<{ value: string; label: string; hint: string }>;
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
 *
 * Redesign v2 (Fase 5): cada habilidade é um `Checkbox` do shadcn num card, com
 * o critério concreto de "já sei" embaixo (D22), para a pessoa não marcar o
 * que só viu de passagem.
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
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {options.map((option) => {
            const isSelected = selected?.includes(option.value) ?? false;

            return (
              <li key={option.value}>
                <label
                  className={cn(
                    "bg-card flex min-h-12 w-full cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-[border-color,box-shadow,background-color] duration-150",
                    isSelected
                      ? "border-brand bg-brand-soft shadow-[0_2px_0_var(--brand)]"
                      : "border-input hover:border-foreground/40 shadow-[0_2px_0_var(--border)]",
                    "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-3",
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(option.value)}
                    className="mt-0.5 after:hidden focus-visible:ring-0"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-muted-foreground text-sm">{option.hint}</span>
                  </span>
                </label>
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
