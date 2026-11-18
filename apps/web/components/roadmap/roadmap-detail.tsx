"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ChartColumn,
  Check,
  ChevronDown,
} from "lucide-react";
import type {
  AdjustmentChangesDto,
  PersistedModuleDto,
  RoadmapDetailDto,
} from "@estudeai/shared-types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRoadmap, useToggleTopic } from "@/lib/roadmaps/api";
import { AREA_LABELS } from "@/lib/roadmaps/labels";
import { studyHref } from "@/lib/roadmaps/study";
import {
  TRACK_CLASS,
  moduleStates,
  remainingHours,
  type ModuleState,
  estimatedWeeks,
} from "@/lib/roadmaps/track";
import { DeleteRoadmapButton } from "./delete-roadmap-button";
import { RouteProgress } from "./progress-bar";
import { RoadmapAdjustPanel } from "./roadmap-adjust-panel";
import { TopicCheckbox, type TopicHighlight } from "./topic-checkbox";

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
 */
export function RoadmapDetail({ roadmapId }: { roadmapId: string }) {
  const { data: roadmap, isPending, isError, error } = useRoadmap(roadmapId);

  if (isPending) {
    return <DetailSkeleton />;
  }

  if (isError) {
    return <DetailError error={error} />;
  }

  return <RoadmapLine roadmap={roadmap} />;
}

function RoadmapLine({ roadmap }: { roadmap: RoadmapDetailDto }) {
  const toggle = useToggleTopic(roadmap.id);
  const [changes, setChanges] = useState<AdjustmentChangesDto | null>(null);
  /** Só o que o usuário abriu/fechou na mão; o resto segue o padrão por estado. */
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

  const states = moduleStates(roadmap.modules);
  const doneModules = states.filter((state) => state === "done").length;
  const hoursLeft = remainingHours(roadmap.modules);
  const weeksLeft = estimatedWeeks(hoursLeft, roadmap.weeklyHours);
  const isFinished = roadmap.progress.percent === 100;

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

  return (
    <div
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "flex flex-col gap-8 duration-300 animate-in fade-in-0",
      )}
    >
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground -my-2 flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" />
        Meus roadmaps
      </Link>

      {/* Cabeçalho: a faixa superior carrega a cor da trilha. */}
      <header className="border-border bg-card overflow-hidden rounded-lg border">
        <div className="bg-line h-2" aria-hidden="true" />
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1>Trilha {AREA_LABELS[roadmap.targetArea]}</h1>
              <Link
                href={`/roadmaps/${roadmap.id}/evolucao`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ChartColumn className="size-4" />
                Sua evolução
              </Link>
            </div>
            <p className="data-label text-ink-faint">
              {doneModules}/{roadmap.modules.length} módulos
              {hoursLeft > 0 && ` · ~${hoursLeft}h pela frente`}
              {weeksLeft !== null &&
                ` · ≈ ${weeksLeft} ${weeksLeft === 1 ? "semana" : "semanas"} no seu ritmo`}
              {isFinished && " · rota concluída"}
            </p>
          </div>

          <RouteProgress
            progress={roadmap.progress}
            stops={roadmap.modules.length + 1}
            reached={doneModules}
          />

          <details className="group/why border-border border-t pt-4">
            <summary className="text-muted-foreground hover:text-foreground flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden">
              Por que essa trilha
              <ChevronDown className="size-4 transition-transform group-open/why:rotate-180" />
            </summary>
            <blockquote className="border-line text-muted-foreground mt-1 max-w-2xl border-l-[3px] pl-4">
              {roadmap.justification}
            </blockquote>
          </details>
        </div>
      </header>

      <RoadmapAdjustPanel
        roadmapId={roadmap.id}
        onAdjusted={(next) => {
          setChanges(next);
          setOpenOverrides({});
        }}
        preservedCount={changes?.preservedTopicIds.length ?? 0}
      />

      {toggle.isError && (
        <p className="text-destructive flex items-center gap-2 text-sm" role="alert">
          <AlertCircle className="size-4 shrink-0" />
          Não foi possível salvar essa alteração. Tente novamente.
        </p>
      )}

      {/* A linha: um <ol> em que cada item desenha sua estação e o trecho até a próxima. */}
      <ol className="flex flex-col">
        {roadmap.modules.map((module, index) => {
          const state = states[index];
          const open = isOpen(module, state);
          const completed = module.topics.filter((topic) => topic.isCompleted).length;
          const isLast = index === roadmap.modules.length - 1;
          const panelId = `module-${module.id}`;

          return (
            <li key={module.id} className="relative flex gap-4 sm:gap-6">
              {/* trilho + estação */}
              <div className="flex w-8 shrink-0 flex-col items-center" aria-hidden="true">
                <span
                  className={cn(
                    "data-label flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                    state === "done" && "bg-line text-white",
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
                {!isLast && (
                  <span
                    className={cn(
                      "my-1 w-0 flex-1 border-l-[3px]",
                      state === "done"
                        ? "border-line"
                        : "border-input border-dashed",
                    )}
                  />
                )}
              </div>

              {/* conteúdo da estação */}
              <div className={cn("min-w-0 flex-1", !isLast && "pb-6")}>
                <div
                  className={cn(
                    "rounded-lg border transition-colors",
                    state === "current"
                      ? "border-foreground/25 bg-card shadow-[0_3px_0_var(--border)]"
                      : "border-border bg-card",
                  )}
                >
                  <h2 className="text-xl">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() =>
                        setOpenOverrides((current) => ({
                          ...current,
                          [module.id]: !open,
                        }))
                      }
                      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-5 py-3 text-left"
                    >
                      <span
                        className={cn(
                          "flex flex-col gap-0.5",
                          state === "upcoming" && !open && "text-muted-foreground",
                        )}
                      >
                        {state === "current" && (
                          <span className="text-brand-ink font-sans text-xs font-semibold tracking-normal">
                            Você está aqui
                          </span>
                        )}
                        {module.title}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "data-label tracking-normal",
                            state === "done" ? "text-success-ink" : "text-ink-faint",
                          )}
                        >
                          {completed}/{module.topics.length}
                        </span>
                        <ChevronDown
                          className={cn(
                            "text-ink-faint size-4 transition-transform",
                            open && "rotate-180",
                          )}
                        />
                      </span>
                    </button>
                  </h2>

                  {open && (
                    <div
                      id={panelId}
                      className="border-border flex flex-col gap-3 border-t px-5 pt-4 pb-3 duration-200 animate-in fade-in-0"
                    >
                      <p className="text-muted-foreground text-sm">
                        {module.description}
                      </p>
                      <div className="flex flex-col">
                        {module.topics.map((topic) => (
                          <TopicCheckbox
                            key={topic.id}
                            topic={topic}
                            onToggle={toggle.mutate}
                            highlight={highlightOf(topic.id)}
                            studyHref={studyHref(roadmap.id, topic.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

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
      <div className="bg-muted h-5 w-32 animate-pulse rounded-md" />
      <div className="bg-muted h-56 w-full animate-pulse rounded-lg" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-4 sm:gap-6">
          <div className="bg-muted size-8 shrink-0 animate-pulse rounded-full" />
          <div className="bg-muted h-14 flex-1 animate-pulse rounded-lg" />
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
