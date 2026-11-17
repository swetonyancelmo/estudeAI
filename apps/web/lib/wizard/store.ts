import { create } from "zustand";
import {
  UNDECIDED_AREA,
  type KnownSkill,
  type WizardAnswers,
} from "@estudeai/shared-types";
import { visibleSteps, type SingleField } from "./steps";

/** Direção da última transição, para animar o slide no sentido certo. */
export type StepDirection = "forward" | "back";

interface WizardState {
  /** Posição dentro de `visibleSteps(answers)`, não do array completo. */
  stepIndex: number;
  /** Respostas parciais — sobrevivem ao voltar (FR-01.3). */
  answers: Partial<WizardAnswers>;
  direction: StepDirection;
  /** Grava a resposta de uma pergunta de escolha única (sem avançar). */
  select: <K extends SingleField>(field: K, value: WizardAnswers[K]) => void;
  /** Liga/desliga uma habilidade na pergunta de múltipla escolha. */
  toggleSkill: (skill: KnownSkill) => void;
  /** "Estou começando do zero": responde a pergunta com a lista vazia. */
  clearSkills: () => void;
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
  toggleSkill: (skill) =>
    set((s) => {
      const current = s.answers.knownSkills ?? [];
      return {
        answers: {
          ...s.answers,
          knownSkills: current.includes(skill)
            ? current.filter((item) => item !== skill)
            : [...current, skill],
        },
      };
    }),
  clearSkills: () =>
    set((s) => ({ answers: { ...s.answers, knownSkills: [] } })),
  next: () =>
    set((s) => ({
      direction: "forward",
      // O total depende das respostas: quem escolhe a área pula a afinidade.
      stepIndex: Math.min(s.stepIndex + 1, visibleSteps(s.answers).length - 1),
    })),
  back: () =>
    set((s) => ({
      direction: "back",
      stepIndex: Math.max(s.stepIndex - 1, 0),
    })),
  reset: () => set({ stepIndex: 0, answers: {}, direction: "forward" }),
}));

/**
 * Monta o payload do POST a partir das respostas parciais, ou `null` se ainda
 * falta alguma. A afinidade só vai junto quando decidiu a trilha: quem
 * respondeu "não sei", escolheu a afinidade e depois voltou para escolher uma
 * área não envia a resposta que ficou para trás.
 */
export function toWizardAnswers(
  answers: Partial<WizardAnswers>,
): WizardAnswers | null {
  const { goal, area, affinity, knownSkills, weeklyTime, learningStyle } =
    answers;
  if (
    goal === undefined ||
    area === undefined ||
    knownSkills === undefined ||
    weeklyTime === undefined ||
    learningStyle === undefined
  ) {
    return null;
  }

  if (area !== UNDECIDED_AREA) {
    return { goal, area, knownSkills, weeklyTime, learningStyle };
  }
  if (affinity === undefined) {
    return null;
  }
  return { goal, area, affinity, knownSkills, weeklyTime, learningStyle };
}
