"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Check, Code2, Eye, RotateCcw } from "lucide-react";
import type { ChallengeDto, ChallengeFiles } from "@estudeai/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getChallengeSolution,
  useSaveChallenge,
  useTopicChallenges,
} from "@/lib/roadmaps/api";
import { runMessage, type ChallengeRunResult } from "./challenge-message";
import { StudyText } from "./study-text";

/**
 * O Sandpack só é baixado quando alguém abre um editor: ele é pesado e liga o
 * bundler do CodeSandbox, então não pesa nem chama serviço externo para quem
 * só lê o tópico.
 */
const ChallengeEditor = dynamic(() => import("./challenge-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-lg" aria-busy="true" />,
});

/**
 * Desafios de código do tópico (Fase 4). Seção some quando o tópico não tem
 * desafio (hoje só tópicos de JS/HTML/CSS/React).
 */
export function TopicChallenges({
  roadmapId,
  topicId,
}: {
  roadmapId: string;
  topicId: string;
}) {
  const query = useTopicChallenges(roadmapId, topicId);

  if (query.isPending) {
    return <Skeleton className="h-24 w-full rounded-lg" aria-busy="true" />;
  }
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>
          Não foi possível carregar os desafios de código.
        </AlertDescription>
      </Alert>
    );
  }
  if (query.data.challenges.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {query.data.challenges.map((challenge) => (
        <ChallengeCard
          key={challenge.id}
          roadmapId={roadmapId}
          topicId={topicId}
          challenge={challenge}
        />
      ))}
    </div>
  );
}

type Pending = "solution" | "restart";

/** Texto das confirmações: as duas apagam o código atual do editor. */
const CONFIRM_COPY: Record<Pending, { title: string; description: string; action: string }> = {
  solution: {
    title: "Ver a solução?",
    description: "A solução vai substituir o seu código. Continuar?",
    action: "Ver solução",
  },
  restart: {
    title: "Recomeçar o desafio?",
    description: "O código vai voltar ao início, e o seu será apagado. Continuar?",
    action: "Recomeçar",
  },
};

function ChallengeCard({
  roadmapId,
  topicId,
  challenge,
}: {
  roadmapId: string;
  topicId: string;
  challenge: ChallengeDto;
}) {
  const save = useSaveChallenge(roadmapId, topicId);
  const [open, setOpen] = useState(false);
  /** Código com que o editor (re)abre; trocar recria o editor. */
  const [files, setFiles] = useState<ChallengeFiles>(challenge.files);
  const [version, setVersion] = useState(0);
  /** Ação em confirmação; fica guardada ao fechar para o texto não sumir na animação. */
  const [confirming, setConfirming] = useState<Pending>("solution");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadingSolution, setLoadingSolution] = useState(false);
  const [lastRun, setLastRun] = useState<ChallengeRunResult | null>(null);
  const [solutionError, setSolutionError] = useState(false);

  function replaceCode(next: ChallengeFiles) {
    setFiles(next);
    setVersion((value) => value + 1);
    setLastRun(null);
    save.mutate({ challengeId: challenge.id, files: next });
  }

  function askConfirm(action: Pending) {
    setConfirming(action);
    setConfirmOpen(true);
  }

  async function confirm(action: Pending) {
    setConfirmOpen(false);
    if (action === "restart") {
      replaceCode(challenge.starterFiles);
      return;
    }
    setLoadingSolution(true);
    setSolutionError(false);
    try {
      const solution = await getChallengeSolution(roadmapId, topicId, challenge.id);
      replaceCode(solution.files);
    } catch {
      setSolutionError(true);
    } finally {
      setLoadingSolution(false);
    }
  }

  return (
    <section
      aria-labelledby={`challenge-${challenge.id}`}
      className="border-border bg-card flex flex-col gap-5 rounded-lg border p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="data-label text-ink-faint">Desafio de código</p>
          <h2 id={`challenge-${challenge.id}`} className="text-lg">
            {challenge.title}
          </h2>
        </div>
        {challenge.passed && (
          <p className="text-success-ink flex items-center gap-1.5 text-sm font-medium">
            <Check className="size-4" strokeWidth={3} />
            Resolvido
          </p>
        )}
      </header>

      <StudyText text={challenge.prompt} />

      {!open ? (
        <div>
          <Button onClick={() => setOpen(true)}>
            <Code2 className="size-4" />
            {challenge.passed ? "Abrir editor" : "Começar desafio"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Edite o código abaixo. Os testes rodam sozinhos a cada mudança, e
            seu código fica salvo.
          </p>
          <ChallengeEditor
            key={version}
            challenge={challenge}
            files={files}
            onSave={(next) =>
              save.mutate({ challengeId: challenge.id, files: next })
            }
            onRun={(next, result) => {
              setLastRun(result);
              save.mutate({
                challengeId: challenge.id,
                files: next,
                result: result.passed ? "pass" : "fail",
              });
            }}
          />

          {lastRun && (
            <p
              className={
                lastRun.passed
                  ? "text-success-ink text-sm font-medium"
                  : "text-muted-foreground text-sm"
              }
            >
              {runMessage(lastRun)}
            </p>
          )}

          {(save.isError || solutionError) && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>
                {solutionError
                  ? "Não foi possível carregar a solução."
                  : "Não foi possível salvar seu código. Ele continua no editor."}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loadingSolution}
              onClick={() => askConfirm("solution")}
            >
              <Eye className="size-4" />
              Ver solução
            </Button>
            <Button size="sm" variant="ghost" onClick={() => askConfirm("restart")}>
              <RotateCcw className="size-4" />
              Recomeçar
            </Button>
          </div>

          {/* Confirmação num diálogo (antes era um bloco inline). `confirming`
              diz qual das duas ações está sendo confirmada. */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{CONFIRM_COPY[confirming].title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {CONFIRM_COPY[confirming].description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void confirm(confirming)}>
                  {CONFIRM_COPY[confirming].action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  );
}
