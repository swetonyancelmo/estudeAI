"use client";

import { useState } from "react";
import { AlertCircle, Check, RotateCcw } from "lucide-react";
import {
  QUIZ_PASS_RATIO,
  type QuizAnswerResultDto,
  type QuizDto,
} from "@estudeai/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAnswerTopicQuiz, useTopicQuiz } from "@/lib/roadmaps/api";
import { AnswerOptions, AnswerRadioGroup } from "./answer-options";
import { InlineText } from "./study-text";

/**
 * Quiz do tópico na sala de estudo (Fase 3): uma pergunta por vez, correção
 * na hora com explicação e placar no fim.
 *
 * Redesign v2: as alternativas são um `RadioGroup`. As setas do teclado só
 * mudam a escolha; a resposta vai quando a pessoa confirma (Enter ou
 * "Responder"), para uma seta sem querer não gastar a pergunta.
 *
 * O cliente não conhece o gabarito: cada resposta vai para a API, que corrige,
 * grava a tentativa e devolve a alternativa certa. Tópico sem quiz não mostra
 * nada.
 */
export function TopicQuiz({
  roadmapId,
  topicId,
  topicCompleted,
  onCompleteTopic,
}: {
  roadmapId: string;
  topicId: string;
  topicCompleted: boolean;
  onCompleteTopic: () => void;
}) {
  const quiz = useTopicQuiz(roadmapId, topicId);

  if (quiz.isPending) {
    return <Skeleton className="h-28 w-full rounded-lg" />;
  }
  if (quiz.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>
          Não foi possível carregar os exercícios.
        </AlertDescription>
      </Alert>
    );
  }
  if (quiz.data.questions.length === 0) return null;

  return (
    <QuizRunner
      key={topicId}
      quiz={quiz.data}
      roadmapId={roadmapId}
      topicCompleted={topicCompleted}
      onCompleteTopic={onCompleteTopic}
    />
  );
}

type Stage = "intro" | "running" | "done";

function QuizRunner({
  quiz,
  roadmapId,
  topicCompleted,
  onCompleteTopic,
}: {
  quiz: QuizDto;
  roadmapId: string;
  topicCompleted: boolean;
  onCompleteTopic: () => void;
}) {
  const answer = useAnswerTopicQuiz(roadmapId, quiz.topicId);
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  /** Correções desta rodada, por pergunta. */
  const [results, setResults] = useState<Record<string, QuizAnswerResultDto>>(
    {},
  );

  const total = quiz.questions.length;
  const question = quiz.questions[index];
  const result = question ? results[question.id] : undefined;
  const correctCount = Object.values(results).filter((r) => r.correct).length;
  const passed = correctCount / total >= QUIZ_PASS_RATIO;

  function start() {
    setResults({});
    setIndex(0);
    setStage("running");
  }

  function choose(optionIndex: number) {
    if (result || answer.isPending) return;
    answer.mutate(
      { questionId: question.id, chosenIndex: optionIndex },
      {
        onSuccess: (correction) =>
          setResults((previous) => ({
            ...previous,
            [correction.questionId]: correction,
          })),
      },
    );
  }

  function next() {
    if (index + 1 < total) {
      setIndex(index + 1);
    } else {
      setStage("done");
    }
  }

  return (
    <section
      aria-labelledby="quiz-title"
      className="border-border bg-card flex flex-col gap-5 rounded-lg border p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="quiz-title" className="text-lg">
          Exercícios
        </h2>
        {stage === "running" && (
          <p className="data-label text-ink-faint" aria-live="polite">
            Pergunta {index + 1} de {total}
          </p>
        )}
      </header>

      {stage === "intro" && (
        <div className="flex flex-col items-start gap-4">
          <p className="text-muted-foreground">
            {total} perguntas para checar o que você aprendeu neste tópico. A
            resposta aparece logo depois de cada escolha.
          </p>
          {quiz.summary && (
            <p className="data-label text-ink-faint">
              Última vez: {quiz.summary.correct} de {quiz.summary.total} certas
            </p>
          )}
          <Button onClick={start}>
            {quiz.summary ? (
              <>
                <RotateCcw className="size-4" />
                Refazer exercícios
              </>
            ) : (
              "Começar"
            )}
          </Button>
        </div>
      )}

      {stage === "running" && question && (
        <div className="flex flex-col gap-4">
          <p className="font-medium">
            <InlineText text={question.question} />
          </p>

          {result ? (
            <AnswerOptions
              options={question.options}
              result={result}
              disabled
              onChoose={() => {}}
            />
          ) : (
            <AnswerRadioGroup
              key={question.id}
              options={question.options}
              pending={answer.isPending}
              onAnswer={choose}
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
              <div
                className={cn(
                  "border-l-[3px] pl-4",
                  result.correct ? "border-success" : "border-destructive",
                )}
              >
                <p className="font-semibold">
                  {result.correct ? "Resposta certa." : "Não foi dessa vez."}
                </p>
                <p className="text-muted-foreground mt-1">
                  <InlineText text={result.explanation} />
                </p>
              </div>
              <Button onClick={next}>
                {index + 1 < total ? "Próxima pergunta" : "Ver resultado"}
              </Button>
            </div>
          )}
        </div>
      )}

      {stage === "done" && (
        <div className="flex flex-col items-start gap-4">
          <p className="text-2xl font-heading font-bold">
            {correctCount} de {total} certas
          </p>
          <p className="text-muted-foreground">
            {passed
              ? topicCompleted
                ? "Mandou bem. Este tópico já está concluído."
                : "Mandou bem. Se sentir que domina o assunto, conclua o tópico."
              : "Vale revisar as aulas e a documentação e tentar de novo."}
          </p>
          <div className="flex flex-wrap gap-2">
            {passed && !topicCompleted && (
              <Button onClick={onCompleteTopic}>
                <Check className="size-4" />
                Concluir tópico
              </Button>
            )}
            <Button variant="outline" onClick={start}>
              <RotateCcw className="size-4" />
              Refazer
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
