"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RoadmapListItemDto } from "@estudeai/shared-types";
import { RouteLine } from "@/components/brand/route-line";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoadmap, useRoadmapStats } from "@/lib/roadmaps/api";
import { AREA_LABELS } from "@/lib/roadmaps/labels";
import { locateTopic, studyHref } from "@/lib/roadmaps/study";
import { TRACK_CLASS, moduleStates } from "@/lib/roadmaps/track";
import { formatMinutes, localTimeZone, localToday } from "@/lib/study/time";
import { cn } from "@/lib/utils";

/**
 * Próxima parada (D13): o cartão grande do dashboard, a um clique de voltar a
 * estudar. A parada vem de `RoadmapListItemDto.nextTopic`; o detalhe do
 * roadmap (o mesmo cache que a página da trilha e a sala de estudo usam)
 * completa com o número da estação, as horas e a linha com as estações reais.
 * Enquanto ele carrega, o cartão já funciona só com a lista.
 *
 * O roadmap em destaque é o primeiro ativo e incompleto; "o último estudado"
 * depende da pendência P3.
 */
export function NextStopCard({ roadmap }: { roadmap: RoadmapListItemDto }) {
  const detail = useRoadmap(roadmap.id);
  const next = roadmap.nextTopic;
  if (!next) return null;

  const location = detail.data ? locateTopic(detail.data.modules, next.id) : null;
  const states = detail.data ? moduleStates(detail.data.modules) : null;
  const area = AREA_LABELS[roadmap.targetArea];
  const started = roadmap.progress.percent > 0;

  return (
    <section
      aria-labelledby="next-stop"
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "border-border bg-card flex flex-col gap-5 rounded-lg border p-5 shadow-[0_3px_0_var(--border)] sm:p-8",
      )}
    >
      {states ? (
        <RouteLine
          stops={states.length + 1}
          reached={states.filter((state) => state === "done").length}
          size="sm"
        />
      ) : (
        <RouteLine stops={5} reached={(roadmap.progress.percent / 100) * 4} size="sm" />
      )}

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <span className="bg-line size-2.5 shrink-0 rounded-full" aria-hidden="true" />
          Trilha {area}
          {location ? ` · Estação ${location.moduleIndex + 1}: ${location.module.title}` : ` · ${next.moduleTitle}`}
        </p>
        <h2 id="next-stop" className="text-2xl">
          <span className="sr-only">Próxima parada: </span>
          {next.title}
        </h2>
        <p className="data-label text-ink-faint">
          {[
            location?.topic.estimatedHours !== undefined && `~${location?.topic.estimatedHours}h`,
            `${roadmap.progress.percent}% da rota`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <Link
        href={studyHref(roadmap.id, next.id)}
        className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}
      >
        {started ? "Continuar" : "Começar"}
        <ArrowRight className="size-5" />
      </Link>
    </section>
  );
}

/**
 * Sua semana: sequência de dias e meta semanal do roadmap em destaque. A
 * sequência é calculada em todas as trilhas pela API, mas a meta é deste
 * roadmap; o rótulo diz qual enquanto não há um resumo global (pendência P4).
 * Sem fogo, sem contagem regressiva: número e "dias seguidos".
 */
export function WeekCard({ roadmap }: { roadmap: RoadmapListItemDto }) {
  const [today] = useState(() => localToday());
  const [timeZone] = useState(() => localTimeZone());
  const stats = useRoadmapStats(roadmap.id, today, timeZone);

  if (stats.isPending) return <Skeleton className="h-32 w-full rounded-lg" />;
  // Sem estatísticas, o card some: não é o que leva de volta ao estudo.
  if (stats.isError) return null;

  const { currentStreak, weeklyGoalMinutes, weeks } = stats.data;
  const thisWeek = weeks[weeks.length - 1]?.minutes ?? 0;
  const goalShare =
    weeklyGoalMinutes && weeklyGoalMinutes > 0
      ? Math.min(Math.round((thisWeek / weeklyGoalMinutes) * 100), 100)
      : null;
  const area = AREA_LABELS[roadmap.targetArea];

  return (
    <section
      aria-labelledby="week"
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "border-border bg-card flex flex-col gap-4 rounded-lg border p-5 sm:p-6",
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="week" className="text-lg">
          Sua semana
        </h2>
        <Link
          href={`/roadmaps/${roadmap.id}/evolucao`}
          className="text-muted-foreground hover:text-foreground -mx-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium"
        >
          na Trilha {area}
          <ArrowRight className="size-3.5" />
        </Link>
      </header>
      <div className="grid gap-5 sm:grid-cols-2">
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-3xl leading-none font-extrabold">
            {currentStreak}
          </span>
          <span className="text-muted-foreground">
            {currentStreak === 1 ? "dia seguido" : "dias seguidos"}
          </span>
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            <span className="font-semibold">{formatMinutes(thisWeek)}</span>
            <span className="text-muted-foreground">
              {weeklyGoalMinutes
                ? ` de ${formatMinutes(weeklyGoalMinutes)} da sua meta`
                : " de estudo esta semana"}
            </span>
          </p>
          {goalShare !== null && (
            <Progress value={goalShare} aria-label="Meta da semana" />
          )}
        </div>
      </div>
    </section>
  );
}
