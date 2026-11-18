"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { relativeDays, useReviewQueue } from "@/lib/review/api";

/**
 * "Revisão do dia" no dashboard (Fase 6). Some enquanto a pessoa não tem
 * nenhuma pergunta na revisão: ela começa a existir quando os exercícios dos
 * tópicos são respondidos.
 */
export function ReviewTodayCard() {
  const queue = useReviewQueue();
  if (!queue.data || queue.data.totalCards === 0) return null;
  const { dueCount, nextDueAt } = queue.data;

  return (
    <section
      aria-labelledby="review-today"
      className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="bg-brand-soft text-brand-ink flex size-10 shrink-0 items-center justify-center rounded-full">
          <RotateCcw className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="review-today" className="text-lg">
            {dueCount > 0
              ? `${dueCount} ${dueCount === 1 ? "pergunta" : "perguntas"} para revisar hoje`
              : "Revisão em dia"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {dueCount > 0
              ? "Rever no momento certo é o que faz o conteúdo ficar. Leva poucos minutos."
              : nextDueAt
                ? `A próxima revisão é ${relativeDays(nextDueAt)}.`
                : "Responda os exercícios dos tópicos para montar sua revisão."}
          </p>
        </div>
      </div>
      {dueCount > 0 && (
        <Link href="/revisao" className={buttonVariants()}>
          Revisar agora
          <ArrowRight className="size-4" />
        </Link>
      )}
    </section>
  );
}
