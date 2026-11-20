"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import type {
  ReviewAnswerResultDto,
  ReviewItemDto,
  ReviewQueueDto,
} from "@estudeai/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  relativeDays,
  useAnswerReview,
  useRefreshReviewQueue,
  useReviewQueue,
} from "@/lib/review/api";
import { studyHref } from "@/lib/roadmaps/study";
import { AnswerOptions, AnswerRadioGroup } from "@/components/study/answer-options";
import { InlineText } from "@/components/study/study-text";
import { useStudyTime } from "@/components/study/use-study-time";

/**
 * Sessão de revisão espaçada (Fase 6): as perguntas vencidas, uma por vez,
 * com correção e explicação. Trabalha sobre a fila carregada ao abrir; ao sair,
 * a fila do dashboard é recarregada.
 *
 * Redesign v2: contador com `Progress`, alternativas em `RadioGroup` com os
 * atalhos 1 a 4 (Enter confirma e, depois da correção, avança), link para a
 * sala de estudo do tópico e um resumo sóbrio no fim.
 */
export function ReviewSession() {
  const queue = useReviewQueue();
  const refresh = useRefreshReviewQueue();
  // Ao sair da tela, o card do dashboard mostra a fila atualizada.
  useEffect(() => () => void refresh(), [refresh]);

  if (queue.isPending) {
    return <Skeleton className="h-64 w-full rounded-lg" aria-busy="true" />;
  }
  if (queue.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>
          Não foi possível carregar sua revisão. Recarregue a página.
        </AlertDescription>
      </Alert>
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

  const answered = Object.values(results);
  const correctCount = answered.filter((r) => r.correct).length;
  const wrongCount = answered.length - correctCount;
  /** A próxima vez que alguma destas perguntas volta. */
  const nextReview = answered
    .map((r) => r.nextReviewAt)
    .sort()[0];

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
      <section
        aria-labelledby="review-done"
        className="border-border bg-card flex flex-col items-start gap-4 rounded-lg border p-6"
      >
        <h2 id="review-done" className="text-xl">
          {items.length} {items.length === 1 ? "revisada" : "revisadas"}
          {nextReview && `, próxima revisão ${relativeDays(nextReview)}`}
        </h2>
        <p className="data-label text-muted-foreground">
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
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-muted-foreground min-w-0 truncate text-sm">
            {item.topic.title}
          </p>
          <p className="data-label text-ink-faint" aria-live="polite">
            {index + 1} de {items.length}
          </p>
        </div>
        <Progress
          value={Math.round(((index + (result ? 1 : 0)) / items.length) * 100)}
          aria-label={`Revisão: pergunta ${index + 1} de ${items.length}`}
        />
      </header>

      <p id="review-question" className="font-medium">
        <InlineText text={item.question.question} />
      </p>

      {result ? (
        <AnswerOptions
          options={item.question.options}
          result={result}
          disabled
          onChoose={() => {}}
        />
      ) : (
        <AnswerRadioGroup
          key={item.cardId}
          options={item.question.options}
          pending={answer.isPending}
          onAnswer={choose}
          shortcuts
        />
      )}

      {answer.isError && !result && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Não foi possível enviar sua resposta. Tente de novo.
          </AlertDescription>
        </Alert>
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Com o foco aqui, Enter avança: "Enter confirma e avança". */}
            <Button
              autoFocus
              onClick={() => (index + 1 < items.length ? setIndex(index + 1) : setDone(true))}
            >
              {index + 1 < items.length ? "Próxima pergunta" : "Ver resultado"}
              <Kbd className="bg-primary-foreground/10 text-primary-foreground hidden sm:inline-flex">
                Enter
              </Kbd>
            </Button>
            <Link
              href={studyHref(item.topic.roadmapId, item.topic.id)}
              className={buttonVariants({ variant: "ghost" })}
            >
              Ver tópico
              <ArrowRight className="size-4" />
            </Link>
          </div>
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
        Nada para revisar hoje
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
