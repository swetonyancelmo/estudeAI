"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Play } from "lucide-react";
import type { PersistedTopicDto } from "@estudeai/shared-types";
import { Checkbox } from "@/components/ui/checkbox";
import { stopState } from "@/lib/roadmaps/study";
import { resourceCounts } from "@/lib/roadmaps/track";
import { cn } from "@/lib/utils";

/** Marcação pós-reajuste (FR-04.2), só até o usuário sair da tela. */
export type TopicHighlight = "added" | "updated";

const HIGHLIGHT_LABELS: Record<TopicHighlight, string> = {
  added: "novo",
  updated: "ajustado",
};

interface TopicCheckboxProps {
  topic: PersistedTopicDto;
  onToggle: (topicId: string) => void;
  highlight?: TopicHighlight;
  /** Rota da sala de estudo do tópico. */
  studyHref: string;
  /** A próxima parada da rota inteira: anel de 3px sobre `bg-line-soft`. */
  current?: boolean;
}

/**
 * Tópico como PARADA da linha (FR-03.3). Redesign v2 (Fase 3): a linha inteira
 * é um link para a sala de estudo, e o marcador fica numa área de toque
 * própria, ao lado, para concluir sem entrar. Os dois não se aninham: um
 * clique no marcador nunca abre a sala, e vice-versa.
 *
 * `checked` vem do cache do TanStack Query, que a mutation já atualizou de
 * forma otimista: o clique é instantâneo, e um erro reverte o cache
 * (rollback), fazendo o check voltar sozinho.
 *
 * O marcador segue a BASE §3.4: concluída preenchida em `bg-line`, atual com
 * anel de 3px, em andamento tracejada (algum recurso já aberto), não iniciada
 * com anel neutro. O checkpoint (projeto) usa um quadrado de 6px de raio.
 *
 * `highlight` (FR-04.2) marca o que o último reajuste mexeu com um filete
 * lateral na cor da marca. Quem foi concluído nunca recebe marca: ele continua
 * com o visual de sempre, e é esse contraste que mostra que o progresso passou
 * intacto pelo recálculo.
 *
 * À direita, as horas e os materiais por tipo (D18), contados de `resources`.
 * Quiz e desafio ficam de fora: saber se existem pede uma requisição por
 * tópico (pendência P2).
 */
export function TopicCheckbox({
  topic,
  onToggle,
  highlight,
  studyHref,
  current = false,
}: TopicCheckboxProps) {
  const isProject = topic.kind === "project";
  const state = stopState(topic);
  const counts = resourceCounts(topic.resources);
  const kind = isProject ? "checkpoint" : "parada";

  return (
    <div
      className={cn(
        "border-border flex items-start gap-3 border-b last:border-b-0",
        highlight && "border-l-brand -ml-3 border-l-[3px] pl-2.25",
      )}
    >
      {/* Marcador: 24px, com área de toque de 44px pelo `after:` do Checkbox. */}
      <span className="flex min-h-11 shrink-0 items-center py-2.5">
        <Checkbox
          checked={topic.isCompleted}
          onCheckedChange={() => onToggle(topic.id)}
          aria-label={`Concluir ${kind}: ${topic.title}`}
          className={cn(
            "size-6",
            isProject ? "rounded-sm" : "rounded-full",
            "hover:border-line focus-visible:ring-offset-2",
            !topic.isCompleted && current && "border-line bg-line-soft border-[3px]",
            !topic.isCompleted && !current && state === "in_progress" && "border-line border-dashed",
            "data-checked:animate-[station-pop_0.3s_ease-out]",
          )}
        />
      </span>

      <Link
        href={studyHref}
        className="group/stop hover:bg-muted -mr-2 flex min-h-11 min-w-0 flex-1 flex-col gap-1 rounded-md py-2.5 pr-2 pl-2 transition-colors sm:flex-row sm:items-center sm:gap-3"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {isProject && (
              <span className="border-line text-foreground shrink-0 rounded-sm border px-1.5 py-0.5 text-xs font-semibold">
                Projeto
              </span>
            )}
            <span
              className={cn(
                "transition-colors",
                (isProject || current) && "font-medium",
                topic.isCompleted && "text-muted-foreground line-through",
              )}
            >
              {topic.title}
            </span>
            {topic.isCompleted && <span className="sr-only">(concluída)</span>}
            {highlight && (
              <span className="text-brand-ink bg-brand-soft shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium">
                {HIGHLIGHT_LABELS[highlight]}
              </span>
            )}
          </span>
          {/* Checkpoint: a primeira linha do que construir. */}
          {isProject && topic.description && (
            <span className="text-muted-foreground line-clamp-1 text-sm">
              {topic.description}
            </span>
          )}
        </span>

        <span className="data-label text-ink-faint flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          {topic.estimatedHours !== undefined && <span>~{topic.estimatedHours}h</span>}
          <ResourceCount icon={Play} count={counts.videos} one="vídeo" many="vídeos" />
          <ResourceCount icon={BookOpen} count={counts.docs} one="doc" many="docs" />
          <ResourceCount icon={FileText} count={counts.readings} one="leitura" many="leituras" />
          <ArrowRight className="text-brand-ink hidden size-4 transition-transform group-hover/stop:translate-x-0.5 sm:block" />
        </span>
      </Link>
    </div>
  );
}

function ResourceCount({
  icon: Icon,
  count,
  one,
  many,
}: {
  icon: typeof Play;
  count: number;
  one: string;
  many: string;
}) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden="true" />
      {count} {count === 1 ? one : many}
    </span>
  );
}
