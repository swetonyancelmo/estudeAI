import {
  UNDECIDED_AREA,
  type Affinity,
  type LearningGoal,
  type TargetArea,
  type WizardAnswers,
} from '@estudeai/shared-types';

/**
 * Trilha para quem respondeu "ainda não sei" (docs/TRILHAS.md §4).
 *
 * Tabela em vez de pontuação, de propósito: são 6 casos, cabem na tela, e a
 * resposta "por que caí nessa trilha?" é uma linha daqui. Quem quer construir
 * o próprio produto precisa das duas pontas, por isso `startup` leva a
 * fullstack — menos para quem se identifica com infraestrutura.
 */
const UNDECIDED_TRACK: Record<Affinity, Record<LearningGoal, TargetArea>> = {
  visual: { mercado: 'frontend', startup: 'fullstack' },
  logica: { mercado: 'backend', startup: 'fullstack' },
  infra: { mercado: 'devops', startup: 'devops' },
};

/**
 * Escolhe a trilha a partir das respostas. Sem IA e sem banco: quem escolheu a
 * área fica com ela; quem não sabe é decidido por afinidade + objetivo.
 *
 * `affinity` ausente com área indefinida não passa da validação do DTO; o
 * `visual` aqui é só o que mantém a função total.
 */
export function chooseTrack(
  answers: Pick<WizardAnswers, 'area' | 'affinity' | 'goal'>,
): TargetArea {
  if (answers.area !== UNDECIDED_AREA) {
    return answers.area;
  }
  return UNDECIDED_TRACK[answers.affinity ?? 'visual'][answers.goal];
}
