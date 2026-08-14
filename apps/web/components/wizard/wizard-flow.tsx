"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WIZARD_STEPS, TOTAL_STEPS } from "@/lib/wizard/steps";
import { isComplete, useWizardStore } from "@/lib/wizard/store";
import { useGenerateRoadmap } from "@/lib/wizard/api";
import { roadmapKeys } from "@/lib/roadmaps/api";
import { WizardProgress } from "./wizard-progress";
import { WizardStep } from "./wizard-step";
import { RoadmapResultSkeleton } from "./roadmap-result-skeleton";
import { RoadmapError } from "./roadmap-error";

type StepOptions = ReadonlyArray<{ value: string; label: string; hint: string }>;

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

  // A geração real (Gemini) demora — enquanto pende, mostramos o skeleton.
  // Segue exibido depois do sucesso, durante a navegação para o detalhe.
  if (mutation.isPending || mutation.isSuccess) {
    return <RoadmapResultSkeleton />;
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

  const step = WIZARD_STEPS[stepIndex];
  const currentValue = answers[step.field];
  const isLastStep = stepIndex === TOTAL_STEPS - 1;
  const canAdvance = currentValue !== undefined;

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress stepIndex={stepIndex} />

      <WizardStep
        // key remonta o componente por step → redispara a animação de entrada.
        key={step.field}
        direction={direction}
        title={step.title}
        subtitle={step.subtitle}
        options={step.options as StepOptions}
        selected={currentValue}
        // `as never`: correlaciona o campo (union) com seu valor no store tipado.
        onSelect={(value) => select(step.field, value as never)}
      />

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={back} disabled={stepIndex === 0}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        {isLastStep ? (
          <Button onClick={handleSubmit} disabled={!canAdvance}>
            <Sparkles className="size-4" />
            Gerar roadmap
          </Button>
        ) : (
          <Button onClick={next} disabled={!canAdvance}>
            Avançar
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
