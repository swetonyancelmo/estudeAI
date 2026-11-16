import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RouteLineProps {
  /** Quantidade de estações na linha (mínimo 2). */
  stops: number;
  /**
   * Quanto da linha já foi percorrido, em estações: `2` = as duas primeiras
   * concluídas e a terceira é a atual. Aceita fração (ex.: vindo de um
   * percentual), e aí o traçado para entre duas estações.
   */
  reached: number;
  /** Rótulos opcionais sob a primeira e a última estação. */
  startLabel?: string;
  endLabel?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A peça central da identidade: uma linha de mapa com estações.
 * Trecho percorrido na cor da linha (`--line`, herdada de `.track-*`; laranja
 * da marca por padrão), trecho pendente tracejado, estação atual com anel.
 * Reaparece no wizard (4 perguntas), nos cards do dashboard e no estado vazio.
 *
 * É decorativa por padrão (`aria-hidden`): quem a usa já expõe o mesmo dado em
 * texto ou num `role="progressbar"` próprio.
 */
export function RouteLine({
  stops,
  reached,
  startLabel,
  endLabel,
  size = "md",
  className,
}: RouteLineProps) {
  const last = stops - 1;
  const clamped = Math.max(0, Math.min(reached, last));
  const dot = size === "md" ? "size-5" : "size-3";

  return (
    <div aria-hidden="true" className={cn("w-full", className)}>
      <div className="relative flex items-center justify-between">
        {/* pendente: tracejado */}
        <div className="border-input absolute inset-x-1.5 top-1/2 -translate-y-1/2 border-t-2 border-dashed" />
        {/* percorrido */}
        <div className="absolute inset-x-1.5 top-1/2 -translate-y-1/2">
          <div
            className={cn(
              "bg-line rounded-full transition-[width] duration-500 ease-out",
              size === "md" ? "h-[3px]" : "h-0.5",
            )}
            style={{ width: `${(clamped / last) * 100}%` }}
          />
        </div>

        {Array.from({ length: stops }, (_, index) => {
          const done = index < clamped || clamped === last;
          const current = !done && index === clamped;
          return (
            <span
              key={index}
              className={cn(
                "relative flex shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                dot,
                done && "bg-line station-pop text-white",
                current && "border-line bg-background border-[3px]",
                !done && !current && "border-input bg-background border-2",
              )}
            >
              {done && size === "md" && (
                <Check className="size-3" strokeWidth={3.5} />
              )}
            </span>
          );
        })}
      </div>

      {(startLabel || endLabel) && (
        <div className="text-ink-faint mt-2 flex justify-between font-mono text-xs">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}
