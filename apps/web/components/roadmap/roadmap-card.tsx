import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { RoadmapListItemDto } from "@estudeai/shared-types";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./progress-bar";
import { AREA_LABELS, STATUS_LABELS, formatCreatedAt } from "@/lib/roadmaps/labels";

/**
 * Card da lista "Meus Roadmaps" (FR-03.2): área, status, % de progresso e data.
 * O card inteiro é o link para o detalhe — alvo grande, sem CTA competindo.
 */
export function RoadmapCard({ roadmap }: { roadmap: RoadmapListItemDto }) {
  return (
    <Link
      href={`/roadmaps/${roadmap.id}`}
      className="border-border bg-card hover:border-brand-line focus-visible:ring-ring group flex flex-col gap-4 rounded-2xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-heading text-[17px] font-semibold">
            {AREA_LABELS[roadmap.targetArea]}
          </span>
          <span className="text-ink-faint text-xs">
            criado em {formatCreatedAt(roadmap.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={roadmap.status === "active" ? "default" : "outline"}>
            {STATUS_LABELS[roadmap.status]}
          </Badge>
          <ArrowUpRight className="text-ink-faint group-hover:text-foreground size-4 shrink-0 transition-colors" />
        </div>
      </div>

      <ProgressBar progress={roadmap.progress} showCount />
    </Link>
  );
}
