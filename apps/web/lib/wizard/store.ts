import { create } from "zustand";
import type { WizardAnswers } from "@estudeai/shared-types";
import { TOTAL_STEPS } from "./steps";

/** Direção da última transição, para animar o slide no sentido certo. */
export type StepDirection = "forward" | "back";

interface WizardState {
  stepIndex: number;
  /** Respostas parciais — sobrevivem ao voltar (FR-01.3). */
  answers: Partial<WizardAnswers>;
  direction: StepDirection;
  /** Grava a resposta do step atual (sem avançar). */
  select: <K extends keyof WizardAnswers>(field: K, value: WizardAnswers[K]) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  stepIndex: 0,
  answers: {},
  direction: "forward",
  select: (field, value) =>
    set((s) => ({ answers: { ...s.answers, [field]: value } })),
  next: () =>
    set((s) => ({
      direction: "forward",
      stepIndex: Math.min(s.stepIndex + 1, TOTAL_STEPS - 1),
    })),
  back: () =>
    set((s) => ({
      direction: "back",
      stepIndex: Math.max(s.stepIndex - 1, 0),
    })),
  reset: () => set({ stepIndex: 0, answers: {}, direction: "forward" }),
}));

/**
 * Type guard: todas as 4 respostas presentes. Estreita `Partial<WizardAnswers>`
 * para `WizardAnswers`, então o submit não precisa de cast.
 */
export function isComplete(
  answers: Partial<WizardAnswers>,
): answers is WizardAnswers {
  return (
    answers.goal !== undefined &&
    answers.weeklyTime !== undefined &&
    answers.affinity !== undefined &&
    answers.learningStyle !== undefined
  );
}
