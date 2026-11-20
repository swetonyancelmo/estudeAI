import { useEffect, useRef } from "react";
import { Kbd } from "@/components/ui/kbd";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { StepDirection } from "@/lib/wizard/store";

interface WizardStepProps {
  direction: StepDirection;
  title: string;
  subtitle: string;
  options: ReadonlyArray<{ value: string; label: string; hint: string }>;
  selected: string | undefined;
  /** Escolha que avança sozinha (clique, toque ou tecla 1..n). */
  onSelect: (value: string) => void;
  /** Escolha sem avançar (setas do teclado, que só percorrem as opções). */
  onPick: (value: string) => void;
  /** Enter com uma opção escolhida: segue para a próxima pergunta. */
  onConfirm: () => void;
}

/**
 * Uma pergunta grande por tela (FR-01.1), com as opções como cards
 * selecionáveis. Cada opção tem um atalho numérico (1, 2, 3) mostrado na
 * própria tecla desenhada à direita. A transição suave (NFR-03) vem das
 * classes do tw-animate-css; o pai remonta este componente via `key` a cada
 * step, o que redispara a animação de entrada.
 *
 * Redesign v2 (Fase 5): as opções são um `RadioGroup` do shadcn. Clique e
 * atalho numérico escolhem e avançam (os 250ms de sempre); as setas do
 * teclado só percorrem as opções, porque avançar a cada seta pularia a
 * pergunta. Com uma opção escolhida pelas setas, Enter avança.
 */
export function WizardStep({
  direction,
  title,
  subtitle,
  options,
  selected,
  onSelect,
  onPick,
  onConfirm,
}: WizardStepProps) {
  /**
   * A seleção que vem de uma seta não avança. O Base UI seleciona ao mover o
   * foco e dispara um clique sintético, então o tipo do evento não distingue:
   * a marca é a própria tecla, anotada no `keydown` do grupo.
   */
  const viaArrow = useRef(false);

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

      <RadioGroup
        aria-label={title}
        value={selected ?? null}
        onValueChange={(value) => {
          if (viaArrow.current) onPick(value as string);
          else onSelect(value as string);
        }}
        onKeyDownCapture={(event) => {
          viaArrow.current = event.key.startsWith("Arrow");
        }}
        onPointerDownCapture={() => {
          viaArrow.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && selected !== undefined) {
            event.preventDefault();
            onConfirm();
          }
        }}
        className="gap-3"
      >
        {options.map((option, index) => (
          <label
            key={option.value}
            className={cn(
              "group bg-card flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-[border-color,box-shadow,transform,background-color] duration-150 sm:p-5",
              "border-input shadow-[0_3px_0_var(--border)] hover:border-foreground/40 hover:-translate-y-0.5",
              "has-[[data-checked]]:border-brand has-[[data-checked]]:bg-brand-soft has-[[data-checked]]:translate-y-0 has-[[data-checked]]:shadow-[0_3px_0_var(--brand)]",
              "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-3",
            )}
          >
            <RadioGroupItem
              value={option.value}
              aria-keyshortcuts={String(index + 1)}
              className="focus-visible:ring-0"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-heading text-xl font-bold">{option.label}</span>
              <span className="text-muted-foreground text-sm">{option.hint}</span>
            </span>
            <Kbd className="hidden sm:inline-flex" aria-hidden="true">
              {index + 1}
            </Kbd>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
