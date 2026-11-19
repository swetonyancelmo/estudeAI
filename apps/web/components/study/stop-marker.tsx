import { Check } from "lucide-react";
import type { StopState } from "@/lib/roadmaps/study";
import { cn } from "@/lib/utils";

/**
 * Marcador de uma parada (BASE §3.4), desenhado à mão como o resto do trilho:
 * o shadcn não tem marcador de metrô.
 * - concluída: preenchida em `bg-line`, com check;
 * - atual: anel de 3px `border-line` sobre `bg-line-soft`;
 * - em andamento: anel de 2px tracejado `border-line`;
 * - não iniciada: anel de 2px `border-input`;
 * - checkpoint (projeto): mesma lógica num quadrado de 6px de raio.
 *
 * O check é branco no claro e tinta no escuro: branco sobre as cores claras
 * das trilhas no tema escuro fica abaixo de 3:1.
 */
export function StopMarker({
  state,
  current = false,
  project = false,
  className,
}: {
  state: StopState;
  current?: boolean;
  project?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-card flex size-5 shrink-0 items-center justify-center",
        project ? "rounded-sm" : "rounded-full",
        state === "done" &&
          "bg-line border-line text-white dark:text-primary-foreground border-2",
        state === "done" && current && "ring-line ring-offset-card ring-2 ring-offset-2",
        state !== "done" && current && "border-line bg-line-soft border-[3px]",
        state === "in_progress" && !current && "border-line border-2 border-dashed",
        state === "not_started" && !current && "border-input border-2",
        className,
      )}
    >
      {state === "done" && <Check className="size-3" strokeWidth={4} />}
    </span>
  );
}

const STATE_LABELS: Record<StopState, string> = {
  done: "concluída",
  in_progress: "em andamento",
  not_started: "não iniciada",
};

/** Texto do estado para leitor de tela ("Parada concluída"). */
export function stopStateLabel(state: StopState, project = false): string {
  return `${project ? "Checkpoint" : "Parada"} ${STATE_LABELS[state]}`;
}
