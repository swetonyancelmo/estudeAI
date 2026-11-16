import { RouteLine } from "@/components/brand/route-line";
import { TOTAL_STEPS } from "@/lib/wizard/steps";

/**
 * Progresso do diagnóstico (FR-01.1) como mini rota de 4 estações: as
 * respondidas ficam preenchidas, a pergunta atual é o anel. O número grande
 * "2/4" é o mesmo dado em texto.
 */
export function WizardProgress({ stepIndex }: { stepIndex: number }) {
  const current = stepIndex + 1;

  return (
    <div
      className="flex items-center gap-5"
      role="progressbar"
      aria-label="Progresso do diagnóstico"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-valuetext={`Pergunta ${current} de ${TOTAL_STEPS}`}
    >
      <span className="font-heading text-3xl leading-none font-extrabold">
        {current}
        <span className="text-ink-faint text-xl">/{TOTAL_STEPS}</span>
      </span>
      <RouteLine stops={TOTAL_STEPS} reached={stepIndex} />
    </div>
  );
}
