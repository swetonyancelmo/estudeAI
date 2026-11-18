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
import { studyHref } from "@/lib/roadmaps/study";
import { TRACK_CLASS } from "@/lib/roadmaps/track";

/**
 * Card da lista "Meus Roadmaps" (FR-03.2). Cada roadmap é uma LINHA do mapa:
 * a cor da trilha aparece no marcador e no traçado do progresso.
 *
 * O título é um link "esticado" (cobre o card inteiro) para o detalhe da
 * trilha; o "continuar" é um segundo link, por cima, que leva direto à sala de
 * estudo do próximo tópico. Link dentro de link não é HTML válido, por isso os
 * dois são irmãos.
 */
export function RoadmapCard({ roadmap }: { roadmap: RoadmapListItemDto }) {
  const isDone = roadmap.progress.percent === 100;
  const next = roadmap.nextTopic;

  return (
    <article
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "group border-border bg-card relative flex flex-col gap-6 rounded-lg border p-6 transition-[border-color,box-shadow,transform] duration-150",
        "hover:border-foreground/30 hover:-translate-y-0.5 hover:shadow-[0_3px_0_var(--border)]",
        "has-[a:focus-visible]:border-foreground/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2.5">
            <span className="bg-line size-3 shrink-0 rounded-full" aria-hidden="true" />
            <Link
              href={`/roadmaps/${roadmap.id}`}
              className="font-heading text-xl font-bold after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
            >
              Trilha {AREA_LABELS[roadmap.targetArea]}
            </Link>
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

      {next && !isDone ? (
        <Link
          href={studyHref(roadmap.id, next.id)}
          className="hover:bg-muted relative z-10 -mx-2 flex min-h-11 flex-col gap-0.5 rounded-md px-2 py-1.5 transition-colors"
        >
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
            {roadmap.progress.percent === 0 ? "Começar por" : "Continuar de onde parei"}
            <ArrowRight className="size-4" />
          </span>
          <span className="truncate font-medium">{next.title}</span>
          <span className="data-label text-ink-faint truncate">{next.moduleTitle}</span>
        </Link>
      ) : (
        <span className="text-muted-foreground group-hover:text-foreground flex items-center gap-1.5 text-sm font-medium transition-colors">
          {isDone ? "Rever a rota" : "Abrir a trilha"}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </article>
  );
}
