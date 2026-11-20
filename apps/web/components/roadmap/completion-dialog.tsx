"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChartColumn, Plus } from "lucide-react";
import type { RoadmapDetailDto } from "@estudeai/shared-types";
import { RouteLine } from "@/components/brand/route-line";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRoadmapStats } from "@/lib/roadmaps/api";
import type { CompletionMilestone } from "@/lib/roadmaps/completion";
import { studyHref } from "@/lib/roadmaps/study";
import { TRACK_CLASS, moduleHours, roadmapFacts } from "@/lib/roadmaps/track";
import { localTimeZone, localToday } from "@/lib/study/time";
import { cn } from "@/lib/utils";

/**
 * Resumo sóbrio ao fechar uma estação ou a rota inteira (D12). Sem confete,
 * sem som, sem badge: a linha que se desenha até a próxima estação já é a
 * comemoração. Com `prefers-reduced-motion`, o traçado aparece pronto (o
 * bloco de movimento do globals.css zera as transições).
 *
 * Os números de quiz e desafios vêm das estatísticas do roadmap; se a
 * consulta falhar, eles somem e o resto do resumo continua.
 */
export function CompletionDialog({
  roadmap,
  milestone,
  onClose,
}: {
  roadmap: RoadmapDetailDto;
  milestone: CompletionMilestone | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={milestone !== null} onOpenChange={(open) => !open && onClose()}>
      {/* O diálogo abre num portal, fora da `.track-*` da página: a classe
          vem junto para a linha manter a cor da trilha. */}
      <DialogContent className={TRACK_CLASS[roadmap.targetArea]}>
        {milestone?.kind === "module" && (
          <ModuleSummary roadmap={roadmap} milestone={milestone} onClose={onClose} />
        )}
        {milestone?.kind === "roadmap" && (
          <RoadmapSummary roadmap={roadmap} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A linha "se desenha": começa na estação de antes e anda uma no mount. */
function DrawnLine({ stops, from }: { stops: number; from: number }) {
  const [reached, setReached] = useState(from);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReached(from + 1));
    return () => cancelAnimationFrame(frame);
  }, [from]);
  // `pr-10`: o botão de fechar do diálogo fica no canto, na altura da linha.
  return <RouteLine stops={stops} reached={reached} size="sm" className="py-1 pr-10" />;
}

function useStats(roadmapId: string) {
  const [today] = useState(() => localToday());
  const [timeZone] = useState(() => localTimeZone());
  return useRoadmapStats(roadmapId, today, timeZone);
}

function Facts({ items }: { items: (string | false | null | undefined)[] }) {
  return (
    <ul className="data-label text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
      {items.filter(Boolean).map((item) => (
        <li key={item as string}>{item}</li>
      ))}
    </ul>
  );
}

function ModuleSummary({
  roadmap,
  milestone,
  onClose,
}: {
  roadmap: RoadmapDetailDto;
  milestone: Extract<CompletionMilestone, { kind: "module" }>;
  onClose: () => void;
}) {
  const stats = useStats(roadmap.id);
  const { module, moduleIndex, pendingProject, nextModule, nextModuleStart } = milestone;
  const studyStops = module.topics.filter((topic) => topic.kind !== "project").length;
  const quiz = stats.data?.quizByModule.find((item) => item.moduleId === module.id);
  const hours = moduleHours(module);

  return (
    <>
      <DrawnLine stops={roadmap.modules.length + 1} from={moduleIndex} />
      <DialogHeader>
        <DialogTitle>
          Estação {moduleIndex + 1} concluída: {module.title}
        </DialogTitle>
        <DialogDescription render={<div />}>
          <Facts
            items={[
              `${studyStops} ${studyStops === 1 ? "parada concluída" : "paradas concluídas"}`,
              hours > 0 && `~${hours}h estimadas`,
              quiz && quiz.answered > 0 && `${quiz.correct} de ${quiz.answered} certas no quiz`,
            ]}
          />
        </DialogDescription>
      </DialogHeader>
      {pendingProject && (
        <p className="text-muted-foreground text-sm">
          Falta o checkpoint da estação: {pendingProject.title}.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
        {pendingProject ? (
          <Link
            href={studyHref(roadmap.id, pendingProject.id)}
            onClick={onClose}
            className={buttonVariants()}
          >
            Fazer o projeto
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          nextModule &&
          nextModuleStart && (
            <Link
              href={studyHref(roadmap.id, nextModuleStart.id)}
              onClick={onClose}
              className={cn(buttonVariants(), "h-auto min-h-11 py-2 whitespace-normal")}
            >
              Seguir para a Estação {moduleIndex + 2}: {nextModule.title}
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          )
        )}
        <Link
          href={`/roadmaps/${roadmap.id}/evolucao`}
          onClick={onClose}
          className={buttonVariants({ variant: "outline" })}
        >
          <ChartColumn className="size-4" />
          Ver minha evolução
        </Link>
      </div>
    </>
  );
}

function RoadmapSummary({
  roadmap,
  onClose,
}: {
  roadmap: RoadmapDetailDto;
  onClose: () => void;
}) {
  const stats = useStats(roadmap.id);
  const facts = roadmapFacts(roadmap.modules);
  const [now] = useState(() => Date.now());
  const weeks = Math.max(
    1,
    Math.ceil((now - new Date(roadmap.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );
  const challenges = stats.data?.challenges;

  return (
    <>
      <DrawnLine stops={roadmap.modules.length + 1} from={roadmap.modules.length - 1} />
      <DialogHeader>
        <DialogTitle>Rota concluída</DialogTitle>
        <DialogDescription render={<div />}>
          <Facts
            items={[
              `~${facts.totalHours}h de estudo`,
              `${weeks} ${weeks === 1 ? "semana" : "semanas"} desde o início`,
              challenges &&
                challenges.total > 0 &&
                `${challenges.passed} de ${challenges.total} desafios resolvidos`,
            ]}
          />
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
        <Link
          href={`/roadmaps/${roadmap.id}/evolucao`}
          onClick={onClose}
          className={buttonVariants()}
        >
          <ChartColumn className="size-4" />
          Ver minha evolução
        </Link>
        <Link href="/wizard" onClick={onClose} className={buttonVariants({ variant: "outline" })}>
          <Plus className="size-4" />
          Novo roadmap
        </Link>
      </div>
    </>
  );
}
