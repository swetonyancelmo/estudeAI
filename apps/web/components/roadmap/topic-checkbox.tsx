"use client";

import { Checkbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import type { PersistedTopicDto } from "@estudeai/shared-types";
import { cn } from "@/lib/utils";
import { TopicResources } from "./topic-resources";

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
}

/**
 * Tópico como PARADA da linha (FR-03.3): um marcador redondo de 24px que
 * acende na cor da trilha ao concluir. A linha inteira é o alvo de toque
 * (mín. 44px de altura). `checked` vem do cache do TanStack Query, que a
 * mutation já atualizou de forma otimista — por isso não há estado local nem
 * `disabled` durante o request: o clique é instantâneo, e um erro reverte o
 * cache (rollback), fazendo o check voltar sozinho.
 *
 * `highlight` (FR-04.2) marca o que o último reajuste mexeu com um filete
 * lateral na cor da marca. Quem foi concluído nunca recebe marca: ele continua
 * com o visual de sempre, e é esse contraste que mostra que o progresso passou
 * intacto pelo recálculo.
 *
 * Etapa 8: os recursos ficam FORA do <label>, como irmãos dele. Dentro, cada
 * clique num link também alternaria o checkbox — é o comportamento nativo do
 * label, não um detalhe de estilo.
 */
export function TopicCheckbox({
  topic,
  onToggle,
  highlight,
}: TopicCheckboxProps) {
  return (
    <div
      className={cn(
        "border-border border-b last:border-b-0",
        highlight && "border-l-brand -ml-3 border-l-[3px] pl-[9px]",
      )}
    >
      <label className="group/topic flex min-h-11 cursor-pointer items-center gap-3 py-2">
        <Checkbox.Root
          checked={topic.isCompleted}
          onCheckedChange={() => onToggle(topic.id)}
          className={cn(
            "border-input bg-card flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            "group-hover/topic:border-line",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "data-[checked]:border-line data-[checked]:bg-line data-[checked]:animate-[station-pop_0.3s_ease-out]",
          )}
        >
          <Checkbox.Indicator className="flex text-white">
            <Check className="size-3.5" strokeWidth={3.5} />
          </Checkbox.Indicator>
        </Checkbox.Root>

        <span
          className={cn(
            "flex-1 transition-colors",
            topic.isCompleted && "text-muted-foreground line-through",
          )}
        >
          {topic.title}
        </span>

        {highlight && (
          <span className="text-brand-ink bg-brand-soft shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium">
            {HIGHLIGHT_LABELS[highlight]}
          </span>
        )}

        {topic.estimatedHours !== undefined && (
          <span className="data-label text-ink-faint shrink-0">
            ~{topic.estimatedHours}h
          </span>
        )}
      </label>

      <TopicResources resources={topic.resources} />
    </div>
  );
}
