"use client";

import { Checkbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import type { PersistedTopicDto } from "@estudeai/shared-types";
import { Badge } from "@/components/ui/badge";
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
}

/**
 * Tópico com checkbox (FR-03.3). `checked` vem do cache do TanStack Query, que
 * a mutation já atualizou de forma otimista — por isso não há estado local nem
 * `disabled` durante o request: o clique é instantâneo, e um erro reverte o
 * cache (rollback), fazendo o check voltar sozinho.
 *
 * `highlight` (FR-04.2) marca o que o último reajuste mexeu. Quem foi concluído
 * nunca recebe marca: ele continua com o visual de sempre, e é justamente esse
 * contraste que mostra que o progresso passou intacto pelo recálculo.
 */
export function TopicCheckbox({
  topic,
  onToggle,
  highlight,
}: TopicCheckboxProps) {
  return (
    <label className="group/topic flex cursor-pointer items-center gap-3 border-b border-border/60 py-2.5 text-sm last:border-0">
      <Checkbox.Root
        checked={topic.isCompleted}
        onCheckedChange={() => onToggle(topic.id)}
        className={cn(
          "border-border flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "data-[checked]:border-success data-[checked]:bg-success",
        )}
      >
        <Checkbox.Indicator className="flex text-white">
          <Check className="size-3" strokeWidth={3} />
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
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {HIGHLIGHT_LABELS[highlight]}
        </Badge>
      )}

      {topic.estimatedHours !== undefined && (
        <span className="text-ink-faint shrink-0 font-mono text-xs">
          ~{topic.estimatedHours}h
        </span>
      )}
    </label>
  );
}
