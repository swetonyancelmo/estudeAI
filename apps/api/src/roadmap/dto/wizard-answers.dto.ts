import { IsIn } from 'class-validator';
import {
  AFFINITIES,
  LEARNING_GOALS,
  LEARNING_STYLES,
  WEEKLY_TIMES,
  type Affinity,
  type LearningGoal,
  type LearningStyle,
  type WeeklyTime,
  type WizardAnswers,
} from '@estudeai/shared-types';

/**
 * Payload de POST /roadmap/generate. Valida os 4 campos do FR-01.2 contra os
 * const arrays do shared-types — mesma fonte de verdade usada no frontend.
 */
export class WizardAnswersDto implements WizardAnswers {
  @IsIn(LEARNING_GOALS, { message: 'Objetivo inválido.' })
  goal: LearningGoal;

  @IsIn(WEEKLY_TIMES, { message: 'Tempo semanal inválido.' })
  weeklyTime: WeeklyTime;

  @IsIn(AFFINITIES, { message: 'Preferência de afinidade inválida.' })
  affinity: Affinity;

  @IsIn(LEARNING_STYLES, { message: 'Estilo de aprendizado inválido.' })
  learningStyle: LearningStyle;
}
