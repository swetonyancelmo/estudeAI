"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ForkIcon } from "@/components/brand/icons";
import { Button } from "@/components/ui/button";
import { WIZARD_STEPS, TOTAL_STEPS } from "@/lib/wizard/steps";
import { isComplete, useWizardStore } from "@/lib/wizard/store";
import { useGenerateRoadmap } from "@/lib/wizard/api";
import { roadmapKeys } from "@/lib/roadmaps/api";
import { WizardProgress } from "./wizard-progress";
import { WizardStep } from "./wizard-step";
import { RoadmapGenerating } from "./roadmap-generating";
import { RoadmapError } from "./roadmap-error";

type StepOptions = ReadonlyArray<{ value: string; label: string; hint: string }>;

/** Tempo para o usuário VER a opção acender antes de a tela trocar. */
const AUTO_ADVANCE_MS = 250;

export function WizardFlow() {
  const { stepIndex, answers, direction, select, next, back, reset } =
    useWizardStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useGenerateRoadmap();

  function handleSubmit() {
    if (isComplete(answers)) {
      mutation.mutate(answers, {
        // Etapa 6: o roadmap já nasce persistido e com id — a tela de resultado
        // virou o detalhe (/roadmaps/:id), onde o progresso é marcável.
        onSuccess: (roadmap) => {
          void queryClient.invalidateQueries({ queryKey: roadmapKeys.list() });
          reset();
          router.replace(`/roadmaps/${roadmap.id}`);
        },
      });
    }
  }

  function restart() {
    reset();
    mutation.reset();
  }

  // Avanço automático: escolher já leva à próxima pergunta. O timer é
  // cancelado se o componente sair ou se outra escolha vier antes.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const step = WIZARD_STEPS[stepIndex];
  const isLastStep = stepIndex === TOTAL_STEPS - 1;

  const handleSelect = useCallback(
    (value: string) => {
      // `as never`: correlaciona o campo (union) com seu valor no store tipado.
      select(step.field, value as never);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      // Na última pergunta não há para onde avançar: gerar é decisão explícita.
      if (!isLastStep) {
        advanceTimer.current = setTimeout(next, AUTO_ADVANCE_MS);
      }
    },
    [select, next, step.field, isLastStep],
  );

  // A geração real (Gemini) demora — enquanto pende, a rota vai sendo traçada.
  // Segue exibida depois do sucesso, durante a navegação para o detalhe. As
  // respostas vêm de `mutation.variables` porque o store já foi resetado.
  if ((mutation.isPending || mutation.isSuccess) && mutation.variables) {
    return <RoadmapGenerating answers={mutation.variables} />;
  }

  // Falha na geração (timeout / IA fora do ar / resposta inválida): mensagem + retry.
  if (mutation.isError) {
    return (
      <RoadmapError
        error={mutation.error}
        onRetry={handleSubmit}
        onRestart={restart}
      />
    );
  }

  const currentValue = answers[step.field];
  const canAdvance = currentValue !== undefined;

  return (
    <div className="flex flex-col gap-10">
      <WizardProgress stepIndex={stepIndex} />

      <WizardStep
        // key remonta o componente por step → redispara a animação de entrada.
        key={step.field}
        direction={direction}
        title={step.title}
        subtitle={step.subtitle}
        options={step.options as StepOptions}
        selected={currentValue}
        onSelect={handleSelect}
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            // Um avanço automático pendente não pode atropelar o "voltar".
            if (advanceTimer.current) clearTimeout(advanceTimer.current);
            back();
          }}
          disabled={stepIndex === 0}
          className="-ml-3"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        {isLastStep ? (
          <Button size="lg" onClick={handleSubmit} disabled={!canAdvance}>
            <ForkIcon className="size-5" />
            Gerar minha rota
          </Button>
        ) : (
          // Só aparece para quem voltou a uma pergunta já respondida: na ida,
          // escolher uma opção já avança sozinho.
          canAdvance && (
            <Button variant="outline" onClick={next}>
              Avançar
              <ArrowRight className="size-4" />
            </Button>
          )
        )}
      </div>

      <p className="text-ink-faint hidden text-sm sm:block">
        Dica: use as teclas{" "}
        <kbd className="data-label border-input rounded-sm border px-1.5 py-0.5">1</kbd>{" "}
        <kbd className="data-label border-input rounded-sm border px-1.5 py-0.5">2</kbd>{" "}
        <kbd className="data-label border-input rounded-sm border px-1.5 py-0.5">3</kbd>{" "}
        para responder.
      </p>
    </div>
  );
}
