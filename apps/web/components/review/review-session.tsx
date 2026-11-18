"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check } from "lucide-react";
import type {
  ReviewAnswerResultDto,
  ReviewItemDto,
  ReviewQueueDto,
} from "@estudeai/shared-types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  relativeDays,
  useAnswerReview,
  useRefreshReviewQueue,
  useReviewQueue,
} from "@/lib/review/api";
import { studyHref } from "@/lib/roadmaps/study";
import { AnswerOptions } from "@/components/study/answer-options";
import { InlineText } from "@/components/study/study-text";
import { useStudyTime } from "@/components/study/use-study-time";

/**
 * Sessão de revisão espaçada (Fase 6): as perguntas vencidas, uma por vez,
 * com correção e explicação. Trabalha sobre a fila carregada ao abrir; ao sair,
 * a fila do dashboard é recarregada.
 */
export function ReviewSession() {
  const queue = useReviewQueue();
  const refresh = useRefreshReviewQueue();
  // Ao sair da tela, o card do dashboard mostra a fila atualizada.
  useEffect(() => () => void refresh(), [refresh]);

  if (queue.isPending) {
    return <div className="bg-muted h-64 w-full animate-pulse rounded-lg" aria-busy="true" />;
  }
  if (queue.isError) {
    return (
      <p className="text-destructive flex items-center gap-2" role="alert">
        <AlertCircle className="size-4" />
        Não foi possível carregar sua revisão. Recarregue a página.
      </p>
    );
  }
  if (queue.data.items.length === 0) return <NothingDue queue={queue.data} />;
  return <Session items={queue.data.items} remaining={queue.data.dueCount} />;
}

function Session({ items, remaining }: { items: ReviewItemDto[]; remaining: number }) {
  const answer = useAnswerReview();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, ReviewAnswerResultDto>>({});
  const [done, setDone] = useState(false);
  const item = items[index];
  const result = item ? results[item.cardId] : undefined;
  // Revisar também conta como tempo de estudo, na trilha da pergunta.
  useStudyTime(item.topic.roadmapId);

  const correctCount = Object.values(results).filter((r) => r.correct).length;
  const wrongCount = Object.values(results).length - correctCount;

  function choose(chosenIndex: number) {
    if (result || answer.isPending) return;
    answer.mutate(
      { cardId: item.cardId, chosenIndex },
      {
        onSuccess: (correction) =>
          setResults((previous) => ({ ...previous, [correction.cardId]: correction })),
      },
    );
  }

  if (done) {
    const left = remaining - items.length;
    return (
      <section className="border-border bg-card flex flex-col items-start gap-4 rounded-lg border p-6">
        <h2 className="text-xl">Revisão concluída</h2>
        <p className="text-2xl font-semibold">
          {correctCount} de {items.length} certas
        </p>
        <p className="text-muted-foreground">
          {correctCount === 0
            ? "Elas voltam amanhã, para você tentar de novo."
            : wrongCount > 0
              ? "As que você errou voltam amanhã; as certas, daqui a alguns dias."
              : "Todas certas. Elas voltam daqui a alguns dias, cada vez mais espaçadas."}
          {left > 0 && ` Ainda há ${left} ${left === 1 ? "pergunta vencida" : "perguntas vencidas"}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {left > 0 && (
            <Button onClick={() => window.location.reload()}>Continuar revisando</Button>
          )}
          <Link href="/dashboard" className={buttonVariants({ variant: left > 0 ? "outline" : "default" })}>
            <ArrowLeft className="size-4" />
            Voltar para meus roadmaps
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="review-question"
      className="border-border bg-card flex flex-col gap-5 rounded-lg border p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={studyHref(item.topic.roadmapId, item.topic.id)}
          className="text-ink-faint hover:text-foreground truncate text-sm underline-offset-4 hover:underline"
        >
          {item.topic.title}
        </Link>
        <p className="data-label text-ink-faint" aria-live="polite">
          {index + 1} de {items.length}
        </p>
      </header>

      <p id="review-question" className="font-medium">
        <InlineText text={item.question.question} />
      </p>

      <AnswerOptions
        options={item.question.options}
        result={result ?? null}
        disabled={answer.isPending}
        onChoose={choose}
      />

      {answer.isError && !result && (
        <p className="text-destructive flex items-center gap-2 text-sm" role="alert">
          <AlertCircle className="size-4" />
          Não foi possível enviar sua resposta. Tente de novo.
        </p>
      )}

      {result && (
        <div className="flex flex-col items-start gap-4" aria-live="polite">
          <div className={cn("border-l-[3px] pl-4", result.correct ? "border-success" : "border-destructive")}>
            <p className="font-semibold">
              {result.correct ? "Resposta certa." : "Não foi dessa vez."}{" "}
              <span className="text-muted-foreground font-normal">
                Volta {relativeDays(result.nextReviewAt)}.
              </span>
            </p>
            <p className="text-muted-foreground mt-1">
              <InlineText text={result.explanation} />
            </p>
          </div>
          <Button
            onClick={() => (index + 1 < items.length ? setIndex(index + 1) : setDone(true))}
          >
            {index + 1 < items.length ? "Próxima pergunta" : "Ver resultado"}
          </Button>
        </div>
      )}
    </section>
  );
}

function NothingDue({ queue }: { queue: ReviewQueueDto }) {
  return (
    <section className="border-border bg-card flex flex-col items-start gap-4 rounded-lg border p-6">
      <p className="text-success-ink flex items-center gap-2 font-medium">
        <Check className="size-4" strokeWidth={3} />
        Nada para revisar agora
      </p>
      <p className="text-muted-foreground">
        {queue.totalCards === 0
          ? "Sua revisão começa quando você responde os exercícios dos tópicos."
          : queue.nextDueAt
            ? `A próxima revisão é ${relativeDays(queue.nextDueAt)}.`
            : "Volte amanhã."}
      </p>
      <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
        <ArrowLeft className="size-4" />
        Voltar para meus roadmaps
      </Link>
    </section>
  );
}
