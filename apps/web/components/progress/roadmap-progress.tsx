"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import {
  QUIZ_PASS_RATIO,
  type ModuleQuizStatsDto,
  RoadmapDetailDto,
  RoadmapStatsDto,
} from "@estudeai/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useReviewQueue } from "@/lib/review/api";
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
 *
 * Redesign v2: breadcrumb e a faixa de cor da trilha do detalhe, quatro
 * números em `Card`, tooltips no heatmap e nas barras, e o "Vale revisar"
 * com a estação de menor acerto (D14).
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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href="/dashboard" />}
              className="flex min-h-11 items-center font-medium"
            >
              Meus roadmaps
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href={`/roadmaps/${roadmap.id}`} />}
              className="flex min-h-11 items-center font-medium"
            >
              Trilha {AREA_LABELS[roadmap.targetArea]}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">Sua evolução</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Mesma faixa de cor do detalhe: deixa claro de qual linha é. */}
      <header className="border-border bg-card -mt-4 overflow-hidden rounded-lg border">
        <div className="bg-line h-2" aria-hidden="true" />
        <div className="flex flex-col gap-2 p-5 sm:p-8">
          <h1>Sua evolução</h1>
          <p className="text-muted-foreground max-w-2xl">
            {hasAnyStudy
              ? `Tempo de estudo, constância e o que você já domina na Trilha ${AREA_LABELS[roadmap.targetArea]}.`
              : "O tempo de estudo começa a contar quando você estuda um tópico: aulas, leituras, exercícios e desafios."}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Sequência"
          value={`${stats.currentStreak} ${stats.currentStreak === 1 ? "dia" : "dias"}`}
          detail="seguidos com estudo, em todas as trilhas"
        />
        <StatTile
          label="Melhor sequência"
          value={`${stats.bestStreak} ${stats.bestStreak === 1 ? "dia" : "dias"}`}
          detail="o seu recorde até aqui"
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
          label="No seu ritmo"
          value={
            stats.weeksAtRecentPace === null
              ? "Sem dados"
              : stats.weeksAtRecentPace === 0
                ? "Concluída"
                : `≈ ${stats.weeksAtRecentPace} ${stats.weeksAtRecentPace === 1 ? "semana" : "semanas"}`
          }
          detail={
            stats.weeksAtRecentPace === null
              ? "Estude esta semana para ver quanto falta no seu ritmo real."
              : `para os ~${stats.remainingHours} h que faltam, a ${formatMinutes(stats.recentWeeklyMinutes)} por semana (média das últimas 4)`
          }
        />
      </div>

      <WorthReviewing roadmapId={roadmap.id} modules={stats.quizByModule} />

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
    <Card size="sm" className="gap-1 px-4 py-4">
      <p className="data-label text-ink-faint">{label}</p>
      <p className="font-heading text-2xl leading-tight font-extrabold">{value}</p>
      <p className="text-muted-foreground text-sm">{detail}</p>
      {children}
    </Card>
  );
}

/** Respostas mínimas para uma taxa de acerto dizer alguma coisa. */
const MIN_ANSWERS = 4;

/**
 * "Vale revisar" (D14): a estação com a menor taxa de acerto no quiz, entre as
 * que têm pelo menos 4 respostas. O link abre o detalhe com ela aberta; com
 * perguntas vencidas na revisão espaçada, também "Revisar agora". Some quando
 * nenhuma estação tem respostas suficientes ou quando até a pior está acima
 * da nota de aprovação do quiz (`QUIZ_PASS_RATIO`).
 */
function WorthReviewing({
  roadmapId,
  modules,
}: {
  roadmapId: string;
  modules: ModuleQuizStatsDto[];
}) {
  const queue = useReviewQueue();
  const candidates = modules
    .map((station, index) => ({ station, index }))
    .filter(({ station }) => station.answered >= MIN_ANSWERS);
  if (candidates.length === 0) return null;
  const rate = (item: (typeof candidates)[number]) =>
    item.station.correct / item.station.answered;
  const { station, index } = candidates.reduce((worst, item) =>
    rate(item) < rate(worst) ? item : worst,
  );
  // Acima da nota de aprovação do quiz não há o que "valer revisar".
  if (station.correct / station.answered >= QUIZ_PASS_RATIO) return null;
  const share = Math.round((station.correct / station.answered) * 100);
  const due = queue.data?.dueCount ?? 0;

  return (
    <section
      aria-labelledby="worth-reviewing"
      className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="worth-reviewing" className="text-lg">
          Vale revisar: Estação {index + 1}
        </h2>
        <p className="text-muted-foreground text-sm">
          {station.title}: {station.correct} de {station.answered} certas ({share}%), o
          menor acerto da trilha.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {due > 0 && (
          <Link href="/revisao" className={buttonVariants()}>
            <RotateCcw className="size-4" />
            Revisar agora
          </Link>
        )}
        <Link
          href={`/roadmaps/${roadmapId}?estacao=${station.moduleId}`}
          className={buttonVariants({ variant: due > 0 ? "outline" : "default" })}
        >
          Rever estação {index + 1}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
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
