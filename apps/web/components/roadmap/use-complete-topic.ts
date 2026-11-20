"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoadmapDetailDto } from "@estudeai/shared-types";
import { useToggleTopic } from "@/lib/roadmaps/api";
import {
  completionMilestone,
  type CompletionMilestone,
} from "@/lib/roadmaps/completion";
import { locateTopic, studyHref } from "@/lib/roadmaps/study";

/**
 * Concluir (ou desmarcar) uma parada, com o retorno da D12:
 * - a mutation otimista de sempre (`useToggleTopic`), com rollback no erro e
 *   um toast de erro com "Tentar de novo";
 * - fechou uma estação ou a rota: o marco vai para o `CompletionDialog`;
 * - senão, com `announce`, um toast curto "X concluído" com "Ir agora" (para
 *   a próxima parada) e "Desfazer". Nada navega sozinho.
 *
 * Desmarcar nunca pede confirmação nem mostra marco.
 */
export function useCompleteTopic(
  roadmap: RoadmapDetailDto,
  { announce = false }: { announce?: boolean } = {},
) {
  const router = useRouter();
  const toggle = useToggleTopic(roadmap.id);
  const [milestone, setMilestone] = useState<CompletionMilestone | null>(null);
  /** Última parada concluída nesta tela, para animar só ela (e não as antigas). */
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  function toggleTopic(topicId: string): CompletionMilestone | null {
    const location = locateTopic(roadmap.modules, topicId);
    if (!location) return null;
    const { topic, next } = location;
    const completing = !topic.isCompleted;
    const reached = completing ? completionMilestone(roadmap.modules, topicId) : null;
    setJustCompleted(completing ? topicId : null);

    toggle.mutate(topicId, {
      onSuccess: () => {
        if (reached) {
          setMilestone(reached);
          return;
        }
        if (!completing || !announce) return;
        toast.success(`${topic.title} concluído`, {
          id: "topic-completed",
          description: next ? `Próxima parada: ${next.title}` : undefined,
          action: next
            ? {
                label: "Ir agora",
                onClick: () => router.push(studyHref(roadmap.id, next.id)),
              }
            : undefined,
          cancel: {
            label: "Desfazer",
            onClick: () => {
              setJustCompleted(null);
              toggle.mutate(topicId);
            },
          },
        });
      },
      onError: () =>
        toast.error("Não foi possível salvar seu progresso.", {
          id: "toggle-error",
          action: { label: "Tentar de novo", onClick: () => toggleTopic(topicId) },
        }),
    });

    return reached;
  }

  return {
    toggleTopic,
    milestone,
    closeMilestone: () => setMilestone(null),
    justCompleted,
  };
}
