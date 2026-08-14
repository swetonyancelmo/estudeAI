import type { RoadmapProgressDto } from "@estudeai/shared-types";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: RoadmapProgressDto;
  /** Mostra "X de Y tópicos" acima da barra (tela de detalhe). */
  showCount?: boolean;
  className?: string;
}

/**
 * Barra de progresso do roadmap (FR-03.3). Mesma linguagem visual da barra do
 * wizard; a transição de largura é o que dá a sensação de "subiu na hora"
 * quando o toggle otimista recalcula o percentual.
 */
export function ProgressBar({
  progress,
  showCount = false,
  className,
}: ProgressBarProps) {
  const { percent, completedTopics, totalTopics } = progress;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          {showCount
            ? `${completedTopics} de ${totalTopics} tópicos`
            : "Progresso"}
        </span>
        <span className="font-mono tabular-nums">{percent}%</span>
      </div>
      <div
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Progresso do roadmap"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
