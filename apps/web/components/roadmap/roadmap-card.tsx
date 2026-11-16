import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RoadmapListItemDto } from "@estudeai/shared-types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RouteProgress } from "./progress-bar";
import {
  AREA_LABELS,
  STATUS_LABELS,
  formatCreatedAt,
} from "@/lib/roadmaps/labels";
import { TRACK_CLASS } from "@/lib/roadmaps/track";

/**
 * Card da lista "Meus Roadmaps" (FR-03.2). Cada roadmap é uma LINHA do mapa:
 * a cor da trilha aparece no marcador e no traçado do progresso. O card inteiro
 * é o link para o detalhe — alvo grande, sem CTA competindo.
 */
export function RoadmapCard({ roadmap }: { roadmap: RoadmapListItemDto }) {
  const isDone = roadmap.progress.percent === 100;

  return (
    <Link
      href={`/roadmaps/${roadmap.id}`}
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "group border-border bg-card flex flex-col gap-6 rounded-lg border p-6 transition-[border-color,box-shadow,transform] duration-150",
        "hover:border-foreground/30 hover:-translate-y-0.5 hover:shadow-[0_3px_0_var(--border)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2.5">
            <span className="bg-line size-3 shrink-0 rounded-full" aria-hidden="true" />
            <span className="font-heading text-xl font-bold">
              Trilha {AREA_LABELS[roadmap.targetArea]}
            </span>
          </span>
          <span className="data-label text-ink-faint">
            desde {formatCreatedAt(roadmap.createdAt)}
          </span>
        </div>
        {roadmap.status !== "active" && (
          <Badge variant="outline">{STATUS_LABELS[roadmap.status]}</Badge>
        )}
      </div>

      <RouteProgress progress={roadmap.progress} />

      <span className="text-muted-foreground group-hover:text-foreground flex items-center gap-1.5 text-sm font-medium transition-colors">
        {isDone ? "Rever a rota" : roadmap.progress.percent === 0 ? "Começar" : "Continuar de onde parei"}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
