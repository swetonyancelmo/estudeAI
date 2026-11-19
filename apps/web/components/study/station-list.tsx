"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  stopState,
  studyHref,
  type TopicLocation,
} from "@/lib/roadmaps/study";
import { cn } from "@/lib/utils";
import { StopMarker, stopStateLabel } from "./stop-marker";

/**
 * Lista lateral da estação (D6): todas as paradas do módulo, na ordem, com o
 * marcador de estado e as horas. A parada atual fica destacada em
 * `bg-line-soft` e aberta, com os materiais dela (`currentDetail`).
 *
 * É um trilho de metrô em miniatura, então é escrita à mão como o trilho do
 * detalhe; os primitivos shadcn entram por dentro (Tooltip, Button, Kbd).
 */
export function StationList({
  roadmapId,
  location,
  currentDetail,
  onNavigate,
}: {
  roadmapId: string;
  location: TopicLocation;
  currentDetail?: ReactNode;
  /** Chamado ao seguir um link (no celular, fecha o Sheet). */
  onNavigate?: () => void;
}) {
  const { module, moduleIndex, moduleTopics, topic: current } = location;
  const done = moduleTopics.filter((topic) => topic.isCompleted).length;

  return (
    <nav aria-label="Paradas da estação" className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5 px-2">
        <p className="data-label text-ink-faint">
          Estação {moduleIndex + 1} · {done}/{moduleTopics.length}
        </p>
        <p className="font-heading text-lg leading-tight font-bold">
          {module.title}
        </p>
      </header>

      <ol className="before:bg-border relative flex flex-col gap-0.5 before:absolute before:top-5 before:bottom-5 before:left-4.25 before:w-0.5">
        {moduleTopics.map((topic) => {
          const state = stopState(topic);
          const isCurrent = topic.id === current.id;
          const isProject = topic.kind === "project";
          const row = (
            <>
              <StopMarker
                state={state}
                current={isCurrent}
                project={isProject}
                className="relative mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "line-clamp-2 text-sm",
                    isCurrent ? "font-semibold" : "font-medium",
                  )}
                >
                  {topic.title}
                </span>
                <span className="sr-only">
                  , {stopStateLabel(state, isProject)}
                </span>
              </span>
              {topic.estimatedHours !== undefined && (
                <span className="data-label text-ink-faint mt-0.5 shrink-0">
                  ~{topic.estimatedHours}h
                </span>
              )}
            </>
          );

          return (
            <li key={topic.id}>
              {isCurrent ? (
                // Sobre `line-soft` no escuro, `ink-faint` fica abaixo de AA
                // (globals.css): os metadados da parada atual sobem para
                // `muted-foreground`.
                <div
                  aria-current="step"
                  className="bg-line-soft [&_.text-ink-faint]:text-muted-foreground rounded-md"
                >
                  <div className="flex min-h-11 items-start gap-3 px-2 py-2.5">
                    {row}
                  </div>
                  {currentDetail && (
                    <div className="px-2 pb-2 pl-10">{currentDetail}</div>
                  )}
                </div>
              ) : (
                <Link
                  href={studyHref(roadmapId, topic.id)}
                  onClick={onNavigate}
                  className="hover:bg-muted flex min-h-11 items-start gap-3 rounded-md px-2 py-2.5 transition-colors"
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {(location.previousModuleStart || location.nextModuleStart) && (
        <div className="border-border flex flex-wrap justify-between gap-2 border-t pt-3">
          {location.previousModuleStart ? (
            <Link
              href={studyHref(roadmapId, location.previousModuleStart.id)}
              onClick={onNavigate}
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="size-4" />
              Estação anterior
            </Link>
          ) : (
            <span />
          )}
          {location.nextModuleStart && (
            <Link
              href={studyHref(roadmapId, location.nextModuleStart.id)}
              onClick={onNavigate}
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors"
            >
              Próxima estação
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}

/**
 * Lista recolhida (D7): uma coluna estreita com o trilho e as paradas como
 * pontos. O nome de cada parada aparece no Tooltip.
 */
export function StationRail({
  roadmapId,
  location,
  onExpand,
}: {
  roadmapId: string;
  location: TopicLocation;
  onExpand: () => void;
}) {
  return (
    <nav aria-label="Paradas da estação" className="flex flex-col items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir lista de paradas"
              onClick={onExpand}
            />
          }
        >
          <PanelRightOpen className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="left">
          Abrir lista <Kbd>[</Kbd>
        </TooltipContent>
      </Tooltip>

      <p className="data-label text-ink-faint">
        {String(location.moduleIndex + 1).padStart(2, "0")}
      </p>

      <ol className="before:bg-border relative flex flex-col before:absolute before:top-5 before:bottom-5 before:left-1/2 before:w-0.5 before:-translate-x-1/2">
        {location.moduleTopics.map((topic) => {
          const state = stopState(topic);
          const isCurrent = topic.id === location.topic.id;
          const isProject = topic.kind === "project";
          return (
            <li key={topic.id} className="relative">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href={studyHref(roadmapId, topic.id)}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`${topic.title}, ${stopStateLabel(state, isProject)}`}
                      className="hover:bg-muted flex size-11 items-center justify-center rounded-md"
                    />
                  }
                >
                  <StopMarker state={state} current={isCurrent} project={isProject} />
                </TooltipTrigger>
                <TooltipContent side="left">{topic.title}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
