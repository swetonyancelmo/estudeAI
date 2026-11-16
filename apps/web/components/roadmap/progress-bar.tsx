import type { RoadmapProgressDto } from "@estudeai/shared-types";
import { RouteLine } from "@/components/brand/route-line";
import { cn } from "@/lib/utils";

interface RouteProgressProps {
  progress: RoadmapProgressDto;
  /** Estações desenhadas na linha. No detalhe, o número real de módulos. */
  stops?: number;
  /** Estações já alcançadas; sem isso, a linha é preenchida pelo percentual. */
  reached?: number;
  className?: string;
}

/**
 * Progresso do roadmap (FR-03.3) como LINHA com estações, na cor da trilha.
 * O número grande é o dado; a linha é a leitura rápida. O `role="progressbar"`
 * fica no wrapper porque a RouteLine em si é decorativa.
 */
export function RouteProgress({
  progress,
  stops = 5,
  reached,
  className,
}: RouteProgressProps) {
  const { percent, completedTopics, totalTopics } = progress;
  const safeStops = Math.max(stops, 2);

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      role="progressbar"
      aria-label="Progresso do roadmap"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${completedTopics} de ${totalTopics} tópicos concluídos`}
    >
      <div className="flex items-end justify-between gap-3">
        <span className="font-heading text-3xl leading-none font-extrabold">
          {percent}
          <span className="text-xl">%</span>
        </span>
        <span className="data-label text-ink-faint pb-0.5">
          {completedTopics}/{totalTopics} tópicos
        </span>
      </div>
      <RouteLine
        stops={safeStops}
        reached={reached ?? (percent / 100) * (safeStops - 1)}
        size="sm"
      />
    </div>
  );
}
