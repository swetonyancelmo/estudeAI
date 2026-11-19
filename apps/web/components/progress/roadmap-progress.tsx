"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ChevronDown } from "lucide-react";
import type { RoadmapDetailDto, RoadmapStatsDto } from "@estudeai/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRoadmap, useRoadmapStats } from "@/lib/roadmaps/api";
import { AREA_LABELS } from "@/lib/roadmaps/labels";
import { TRACK_CLASS } from "@/lib/roadmaps/track";
import {
  formatMinutes,
  localTimeZone,
  localToday,
  shortDate,
} from "@/lib/study/time";
import { StudyHeatmap } from "./study-heatmap";
import { WeeklyChart } from "./weekly-chart";

/**
 * Painel de evolução de um roadmap (Fase 5). O "hoje" e o fuso são os do
 * navegador: os dias da pessoa são os dias locais dela.
 */
export function RoadmapProgress({ roadmapId }: { roadmapId: string }) {
  const [today] = useState(() => localToday());
  const [timeZone] = useState(() => localTimeZone());
  const roadmap = useRoadmap(roadmapId);
  const stats = useRoadmapStats(roadmapId, today, timeZone);

  if (roadmap.isPending || stats.isPending) return <ProgressSkeleton />;
  if (roadmap.isError || stats.isError) {
    return (
      <div className="flex flex-col items-start gap-5">
        <h1 className="text-2xl">Evolução indisponível</h1>
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle />
          <AlertDescription>Não foi possível carregar sua evolução agora.</AlertDescription>
        </Alert>
        <Link href={`/roadmaps/${roadmapId}`} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="size-4" />
          Voltar para a trilha
        </Link>
      </div>
    );
  }

  return <ProgressView roadmap={roadmap.data} stats={stats.data} />;
}

function ProgressView({
  roadmap,
  stats,
}: {
  roadmap: RoadmapDetailDto;
  stats: RoadmapStatsDto;
}) {
  const thisWeek = stats.weeks[stats.weeks.length - 1];
  const hasAnyStudy = stats.days.length > 0;
  const goalShare =
    stats.weeklyGoalMinutes && stats.weeklyGoalMinutes > 0
      ? Math.min(thisWeek.minutes / stats.weeklyGoalMinutes, 1)
      : null;

  return (
    <div
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "flex flex-col gap-8 duration-300 animate-in fade-in-0",
      )}
    >
      <Link
        href={`/roadmaps/${roadmap.id}`}
        className="text-muted-foreground hover:text-foreground -my-2 flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" />
        Trilha {AREA_LABELS[roadmap.targetArea]}
      </Link>

      <header className="flex flex-col gap-2">
        <h1>Sua evolução</h1>
        <p className="text-muted-foreground max-w-2xl">
          {hasAnyStudy
            ? "Tempo de estudo, constância e o que você já domina nesta trilha."
            : "O tempo de estudo começa a contar quando você estuda um tópico: aulas, leituras, exercícios e desafios."}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Sequência"
          value={`${stats.currentStreak} ${stats.currentStreak === 1 ? "dia" : "dias"}`}
          detail={`Recorde: ${stats.bestStreak} ${stats.bestStreak === 1 ? "dia" : "dias"}`}
        />
        <StatTile
          label="Esta semana"
          value={formatMinutes(thisWeek.minutes)}
          detail={
            stats.weeklyGoalMinutes
              ? `de ${formatMinutes(stats.weeklyGoalMinutes)} da sua meta`
              : `${thisWeek.topicsCompleted} ${thisWeek.topicsCompleted === 1 ? "tópico concluído" : "tópicos concluídos"}`
          }
        >
          {goalShare !== null && (
            <Progress
              className="mt-2"
              value={Math.round(goalShare * 100)}
              aria-label="Meta da semana"
            />
          )}
        </StatTile>
        <StatTile
          label="Ritmo recente"
          value={formatMinutes(stats.recentWeeklyMinutes)}
          detail="por semana, na média das últimas 4"
        />
        <StatTile
          label="Previsão"
          value={
            stats.weeksAtRecentPace === null
              ? "—"
              : stats.weeksAtRecentPace === 0
                ? "Concluída"
                : `≈ ${stats.weeksAtRecentPace} ${stats.weeksAtRecentPace === 1 ? "semana" : "semanas"}`
          }
          detail={
            stats.weeksAtRecentPace === null
              ? "Estude esta semana para ver quanto falta no seu ritmo real."
              : `para os ~${stats.remainingHours} h que faltam, no seu ritmo real`
          }
        />
      </div>

      <Panel title="Dias de estudo" description="Em todas as suas trilhas, nas últimas 26 semanas.">
        <StudyHeatmap days={stats.days} today={stats.today} />
      </Panel>

      <Panel
        title="Horas por semana"
        description={
          stats.weeklyGoalMinutes
            ? "Nesta trilha, comparado com a meta que você escolheu no início."
            : "Nesta trilha, nas últimas 8 semanas."
        }
      >
        <WeeklyChart weeks={stats.weeks} goalMinutes={stats.weeklyGoalMinutes} />
        <Collapsible className="text-sm">
          <CollapsibleTrigger className="group/table text-muted-foreground hover:text-foreground flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-md">
            Ver como tabela
            <ChevronDown className="size-4 transition-transform group-data-[panel-open]/table:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 overflow-x-auto">
            <table className="w-full text-left text-sm [font-variant-numeric:tabular-nums]">
              <thead className="text-ink-faint">
                <tr>
                  <th className="py-1 pr-4 font-medium">Semana</th>
                  <th className="py-1 pr-4 font-medium">Tempo de estudo</th>
                  <th className="py-1 font-medium">Tópicos concluídos</th>
                </tr>
              </thead>
              <tbody>
                {stats.weeks.map((week) => (
                  <tr key={week.weekStart} className="border-border border-t">
                    <td className="py-1.5 pr-4">{shortDate(week.weekStart)}</td>
                    <td className="py-1.5 pr-4">{formatMinutes(week.minutes)}</td>
                    <td className="py-1.5">{week.topicsCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleContent>
        </Collapsible>
      </Panel>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Acertos nos exercícios" description="Pela sua última resposta de cada pergunta, por módulo.">
          {stats.quizByModule.length === 0 ? (
            <p className="text-muted-foreground text-sm">Esta trilha ainda não tem exercícios.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {stats.quizByModule.map((module) => {
                const share = module.answered > 0 ? module.correct / module.answered : 0;
                return (
                  <li key={module.moduleId} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="font-medium">{module.title}</span>
                      <span className="text-muted-foreground">
                        {module.answered === 0
                          ? `${module.total} perguntas, nenhuma respondida`
                          : `${module.correct} de ${module.answered} certas · ${module.answered} de ${module.total} respondidas`}
                      </span>
                    </div>
                    {/* O texto acima já diz os números; a barra é só a leitura rápida. */}
                    <Progress value={Math.round(share * 100)} aria-hidden="true" />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Desafios de código" description="Resolvidos nesta trilha.">
          {stats.challenges.total === 0 ? (
            <p className="text-muted-foreground text-sm">Esta trilha ainda não tem desafios de código.</p>
          ) : (
            <p className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{stats.challenges.passed}</span>
              <span className="text-muted-foreground">de {stats.challenges.total} desafios</span>
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-border bg-card flex flex-col gap-1 rounded-lg border p-4">
      <p className="data-label text-ink-faint">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-sm">{detail}</p>
      {children}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card flex min-w-0 flex-col gap-4 rounded-lg border p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>
      {children}
    </section>
  );
}

function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
