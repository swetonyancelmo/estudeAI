import { RouteLine } from "@/components/brand/route-line";

/**
 * Progresso do diagnóstico (FR-01.1) como mini rota, uma estação por pergunta:
 * as respondidas ficam preenchidas, a pergunta atual é o anel. O número grande
 * "2/6" é o mesmo dado em texto.
 *
 * `total` vem de fora porque depende das respostas: quem escolhe a área tem
 * uma pergunta a menos.
 */
export function WizardProgress({
  stepIndex,
  total,
}: {
  stepIndex: number;
  total: number;
}) {
  const current = stepIndex + 1;

  return (
    <div
      className="flex items-center gap-5"
      role="progressbar"
      aria-label="Progresso do diagnóstico"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuetext={`Pergunta ${current} de ${total}`}
    >
      <span className="font-heading text-3xl leading-none font-extrabold">
        {current}
        <span className="text-ink-faint text-xl">/{total}</span>
      </span>
      <RouteLine stops={total} reached={stepIndex} />
    </div>
  );
}
