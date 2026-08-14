import { TOTAL_STEPS } from "@/lib/wizard/steps";

/** Indicador de progresso dos steps (FR-01.1): "Passo X de N" + barra. */
export function WizardProgress({ stepIndex }: { stepIndex: number }) {
  const current = stepIndex + 1;
  const percent = (current / TOTAL_STEPS) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          Passo {current} de {TOTAL_STEPS}
        </span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
