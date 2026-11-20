"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChartColumn,
  Check,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import type {
  AdjustmentChangesDto,
  PersistedModuleDto,
  RoadmapDetailDto,
} from "@estudeai/shared-types";
import { RerouteIcon } from "@/components/brand/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRoadmap } from "@/lib/roadmaps/api";
import { AREA_LABELS } from "@/lib/roadmaps/labels";
import { firstPendingTopic, studyHref } from "@/lib/roadmaps/study";
import {
  TRACK_CLASS,
  estimatedWeeks,
  moduleHours,
  moduleStates,
  remainingHours,
  roadmapFacts,
  type ModuleState,
} from "@/lib/roadmaps/track";
import { CompletionDialog } from "./completion-dialog";
import { DeleteRoadmapButton } from "./delete-roadmap-button";
import { LineLegend } from "./line-legend";
import { OriginStation, RailSegment, TerminalStation } from "./line-stations";
import { RouteProgress } from "./progress-bar";
import { RoadmapAdjustPanel } from "./roadmap-adjust-panel";
import { TopicCheckbox, type TopicHighlight } from "./topic-checkbox";
import { useCompleteTopic } from "./use-complete-topic";

/**
 * Detalhe do roadmap persistido (FR-03.2 + FR-03.3), desenhado como uma LINHA
 * de mapa: cada módulo é uma estação num trilho vertical, na cor da trilha.
 * Trecho concluído preenchido, trecho pendente tracejado, módulo atual aberto.
 *
 * O progresso lê o mesmo `progress` do cache que a mutation otimista
 * recalcula, então ele sobe junto com o check — sem esperar o servidor.
 *
 * FR-04: o painel de reajuste devolve o que mudou; guardamos isso em estado
 * local (some ao sair da tela, como convém a um destaque) para diferenciar
 * visualmente o que a IA reorganizou do que continua concluído e intacto.
 *
 * Redesign v2 (Fase 3): a tela responde "onde estou, quanto falta, o que faço
 * agora". Ficha com os números da rota, botão "Continuar" para a próxima
 * parada, legenda dos marcadores, estação de origem e terminal, e cada
 * estação com a própria contagem e um `Collapsible`. Os cards ficam sempre do
 * mesmo lado do trilho, e o clique numa parada leva à sala de estudo (não
 * abre painel lateral).
 */
export function RoadmapDetail({ roadmapId }: { roadmapId: string }) {
  const { data: roadmap, isPending, isError, error } = useRoadmap(roadmapId);

  if (isPending) {
    return <DetailSkeleton />;
  }

  if (isError) {
    return <DetailError error={error} />;
  }

  // `useSearchParams` (a estação pedida na URL) pede um Suspense em volta.
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <RoadmapLine roadmap={roadmap} />
    </Suspense>
  );
}

interface Adjustment {
  changes: AdjustmentChangesDto;
  summary: string;
}

function RoadmapLine({ roadmap }: { roadmap: RoadmapDetailDto }) {
  // Concluir pelo marcador da linha também fecha estação com o resumo (D12).
  const completion = useCompleteTopic(roadmap);
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const changes = adjustment?.changes ?? null;
  /**
   * Só o que o usuário abriu/fechou na mão; o resto segue o padrão por estado.
   * `?estacao=<id>` (o "Rever estação" da evolução) já chega com ela aberta.
   */
  const requestedStation = useSearchParams().get("estacao");
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>(() =>
    requestedStation ? { [requestedStation]: true } : {},
  );
  useEffect(() => {
    if (!requestedStation) return;
    document
      .getElementById(`estacao-${requestedStation}`)
      ?.scrollIntoView({ block: "start" });
  }, [requestedStation]);

  const states = moduleStates(roadmap.modules);
  const facts = roadmapFacts(roadmap.modules);
  const hoursLeft = remainingHours(roadmap.modules);
  const weeksLeft = estimatedWeeks(hoursLeft, roadmap.weeklyHours);
  const isFinished = roadmap.progress.percent === 100;
  const nextTopic = firstPendingTopic(roadmap.modules);
  const started = roadmap.progress.completedTopics > 0;
  const area = AREA_LABELS[roadmap.targetArea];

  function highlightOf(topicId: string): TopicHighlight | undefined {
    if (!changes) return undefined;
    if (changes.addedTopicIds.includes(topicId)) return "added";
    if (changes.updatedTopicIds.includes(topicId)) return "updated";
    return undefined;
  }

  /** Aberto por padrão: o módulo atual e os que o último reajuste mexeu. */
  function isOpen(module: PersistedModuleDto, state: ModuleState): boolean {
    const override = openOverrides[module.id];
    if (override !== undefined) return override;
    return (
      state === "current" ||
      module.topics.some((topic) => highlightOf(topic.id) !== undefined)
    );
  }

  const factsLine = [
    `${facts.stations} ${facts.stations === 1 ? "estação" : "estações"}`,
    `${facts.stops} ${facts.stops === 1 ? "parada" : "paradas"}`,
    facts.checkpoints > 0 &&
      `${facts.checkpoints} ${facts.checkpoints === 1 ? "checkpoint" : "checkpoints"}`,
    hoursLeft > 0 && `~${hoursLeft}h pela frente`,
    weeksLeft !== null &&
      `≈ ${weeksLeft} ${weeksLeft === 1 ? "semana" : "semanas"} no seu ritmo`,
  ].filter(Boolean) as string[];

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
            <BreadcrumbPage className="font-medium">Trilha {area}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Cabeçalho: a faixa superior carrega a cor da trilha. */}
      <header className="border-border bg-card -mt-4 overflow-hidden rounded-lg border">
        <div className="bg-line h-2" aria-hidden="true" />
        <div className="flex flex-col gap-6 p-5 sm:p-8">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1>Trilha {area}</h1>
              <Link
                href={`/roadmaps/${roadmap.id}/evolucao`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "max-sm:h-11")}
              >
                <ChartColumn className="size-4" />
                Sua evolução
              </Link>
            </div>
            {/* Ficha (D1): quebra em mais linhas no celular, item a item. */}
            <p className="data-label text-ink-faint flex flex-wrap gap-x-2 gap-y-0.5">
              {factsLine.map((fact, index) => (
                <span key={fact} className="whitespace-nowrap">
                  {fact}
                  {index < factsLine.length - 1 && <span aria-hidden="true"> ·</span>}
                </span>
              ))}
            </p>
          </div>

          <RouteProgress
            progress={roadmap.progress}
            stops={roadmap.modules.length + 1}
            reached={states.filter((state) => state === "done").length}
          />

          {/* O que fazer agora (D2): a próxima parada, a um clique. */}
          {nextTopic ? (
            <Link
              href={studyHref(roadmap.id, nextTopic.id)}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-auto min-h-12 w-full min-w-0 justify-between py-2.5 text-left whitespace-normal sm:w-fit sm:max-w-full sm:justify-start sm:whitespace-nowrap",
              )}
            >
              <span className="line-clamp-2 sm:truncate">
                {started ? "Continuar" : "Começar por"}: {nextTopic.title}
              </span>
              <ArrowRight className="size-5 shrink-0" />
            </Link>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="flex items-center gap-2 font-semibold">
                <Check className="text-line size-5" strokeWidth={3} />
                Rota concluída
              </p>
              <Link
                href={`/roadmaps/${roadmap.id}/evolucao`}
                className="text-brand-ink hover:bg-muted -mx-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold"
              >
                Ver sua evolução
                <ArrowRight className="size-4" />
              </Link>
            </div>
          )}

          <Collapsible className="border-border border-t pt-4">
            <CollapsibleTrigger className="group/why text-muted-foreground hover:text-foreground flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium transition-colors">
              Por que essa trilha
              <ChevronDown className="size-4 transition-transform group-data-[panel-open]/why:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <blockquote className="border-line text-muted-foreground mt-1 max-w-2xl border-l-[3px] pl-4">
                {roadmap.justification}
              </blockquote>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </header>

      <RoadmapAdjustPanel
        roadmapId={roadmap.id}
        onAdjusted={(next, summary) => {
          setAdjustment({ changes: next, summary });
          setOpenOverrides({});
        }}
      />

      <div className="flex flex-col gap-5">
        {adjustment && (
          <Alert role="status" className="border-brand-line bg-brand-soft">
            <RerouteIcon className="text-brand-ink" />
            <AlertTitle>Rota reajustada</AlertTitle>
            <AlertDescription className="flex flex-col gap-1">
              <span>{adjustment.summary}</span>
              {adjustment.changes.preservedTopicIds.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="text-success-ink size-4 shrink-0" />
                  {adjustment.changes.preservedTopicIds.length}{" "}
                  {adjustment.changes.preservedTopicIds.length === 1
                    ? "tópico concluído foi preservado."
                    : "tópicos concluídos foram preservados."}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <LineLegend />
      </div>

      {/* A linha: um <ol> em que cada item desenha sua estação e o trecho até a
          próxima. Começa na origem e termina na estação terminal (D17). */}
      <ol className="flex flex-col" aria-label={`Linha ${area}`}>
        <OriginStation createdAt={roadmap.createdAt} started={started} />

        {roadmap.modules.map((module, index) => {
          const state = states[index];
          const open = isOpen(module, state);
          const completed = module.topics.filter((topic) => topic.isCompleted).length;
          const total = module.topics.length;
          const hours = moduleHours(module);

          return (
            <li
              key={module.id}
              id={`estacao-${module.id}`}
              className="relative flex scroll-mt-4 gap-4 sm:gap-6"
            >
              {/* trilho + estação */}
              <div className="flex w-8 shrink-0 flex-col items-center" aria-hidden="true">
                <span
                  className={cn(
                    "data-label flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                    state === "done" && "bg-line text-white dark:text-primary-foreground",
                    state === "current" &&
                      "border-line bg-background text-foreground border-[3px]",
                    state === "upcoming" &&
                      "border-input bg-background text-ink-faint border-2",
                  )}
                >
                  {state === "done" ? (
                    <Check className="size-4" strokeWidth={3.5} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <RailSegment travelled={state === "done"} />
              </div>

              {/* conteúdo da estação, sempre do mesmo lado do trilho */}
              <div className="min-w-0 flex-1 pb-6">
                <Collapsible
                  open={open}
                  onOpenChange={(next) =>
                    setOpenOverrides((current) => ({ ...current, [module.id]: next }))
                  }
                  className={cn(
                    "rounded-lg border transition-colors",
                    state === "current"
                      ? "border-foreground/25 bg-card shadow-[0_3px_0_var(--border)]"
                      : state === "upcoming"
                        ? "border-border bg-card/60 border-dashed"
                        : "border-border bg-card",
                  )}
                >
                  <h2 className="text-xl">
                    <CollapsibleTrigger className="group/station flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 text-left sm:px-5">
                      <span className="flex min-w-0 flex-col gap-1">
                        {state === "current" && (
                          <span className="text-brand-ink font-sans text-xs font-semibold tracking-normal">
                            Você está aqui
                          </span>
                        )}
                        <span className={cn(state === "upcoming" && "text-muted-foreground")}>
                          <span className="sr-only">Estação {index + 1}: </span>
                          {module.title}
                        </span>
                        {/* D3: contagem e horas da própria estação. */}
                        <span className="data-label text-ink-faint font-sans tracking-normal">
                          {completed}/{total} {total === 1 ? "parada" : "paradas"}
                          {hours > 0 && ` · ~${hours}h`}
                          {state === "done" && <span className="sr-only"> (concluída)</span>}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {state === "done" && (
                          <span className="data-label text-success-ink flex items-center gap-1 tracking-normal">
                            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                            {completed}/{total}
                          </span>
                        )}
                        <ChevronDown className="text-ink-faint size-4 transition-transform group-data-[panel-open]/station:rotate-180" />
                      </span>
                    </CollapsibleTrigger>
                  </h2>
                  <Progress
                    value={total > 0 ? Math.round((completed / total) * 100) : 0}
                    aria-label={`Estação ${index + 1}: ${completed} de ${total} paradas`}
                    className="px-4 pb-3 sm:px-5 [&_[data-slot=progress-track]]:h-1"
                  />

                  <CollapsibleContent>
                    <div className="border-border flex flex-col gap-3 border-t px-4 pt-4 pb-3 sm:px-5">
                      <p className="text-muted-foreground text-sm">{module.description}</p>
                      <div className="flex flex-col">
                        {module.topics.map((topic) => (
                          <TopicCheckbox
                            key={topic.id}
                            topic={topic}
                            onToggle={completion.toggleTopic}
                            highlight={highlightOf(topic.id)}
                            studyHref={studyHref(roadmap.id, topic.id)}
                            current={topic.id === nextTopic?.id}
                          />
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </li>
          );
        })}

        <TerminalStation
          roadmapId={roadmap.id}
          stations={facts.stations}
          totalHours={facts.totalHours}
          reached={isFinished}
        />
      </ol>

      <CompletionDialog
        roadmap={roadmap}
        milestone={completion.milestone}
        onClose={completion.closeMilestone}
      />

      {/* Ação destrutiva no fim da página: fora do caminho de quem só veio
          estudar, e sem competir com o reajuste lá em cima. */}
      <div className="border-border flex justify-end border-t pt-6">
        <DeleteRoadmapButton roadmapId={roadmap.id} />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-56 w-full rounded-lg" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-4 sm:gap-6">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-14 flex-1 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** 403 (roadmap de outro usuário) e 404 têm o mesmo desfecho útil: voltar. */
function DetailError({ error }: { error: unknown }) {
  const status =
    typeof error === "object" && error !== null
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

  const message =
    status === 403 || status === 404
      ? "Este roadmap não está disponível na sua conta."
      : "Não foi possível carregar este roadmap.";

  return (
    <div className="flex flex-col items-start gap-5">
      <h1 className="text-2xl">Rota não encontrada</h1>
      <p className="text-muted-foreground">{message}</p>
      <Button variant="outline" render={<Link href="/dashboard" />}>
        <ArrowLeft className="size-4" />
        Voltar para meus roadmaps
      </Button>
    </div>
  );
}
