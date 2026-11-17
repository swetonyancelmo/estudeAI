import { ArrayUnique, IsArray, IsIn, ValidateIf } from 'class-validator';
import {
  AFFINITIES,
  KNOWN_SKILLS,
  LEARNING_GOALS,
  LEARNING_STYLES,
  UNDECIDED_AREA,
  WEEKLY_TIMES,
  WIZARD_AREAS,
  type Affinity,
  type KnownSkill,
  type LearningGoal,
  type LearningStyle,
  type WeeklyTime,
  type WizardAnswers,
  type WizardArea,
} from '@estudeai/shared-types';

/**
 * Payload de POST /roadmap/generate. Valida cada campo contra os const arrays
 * do shared-types — mesma fonte de verdade usada no frontend.
 */
export class WizardAnswersDto implements WizardAnswers {
  @IsIn(LEARNING_GOALS, { message: 'Objetivo inválido.' })
  goal: LearningGoal;

  @IsIn(WIZARD_AREAS, { message: 'Área inválida.' })
  area: WizardArea;

  /**
   * Obrigatória só para quem não escolheu a área — é ela que decide a trilha.
   * Para os demais o campo é opcional (e ignorado), mas se vier tem de ser um
   * valor conhecido: lixo não entra no banco nem por um campo que não é usado.
   */
  @ValidateIf(
    (answers: WizardAnswersDto) =>
      answers.area === UNDECIDED_AREA || answers.affinity !== undefined,
  )
  @IsIn(AFFINITIES, { message: 'Preferência de afinidade inválida.' })
  affinity?: Affinity;

  /** Lista vazia é resposta válida: "estou começando do zero". */
  @IsArray({ message: 'Habilidades inválidas.' })
  @ArrayUnique({ message: 'Habilidades repetidas.' })
  @IsIn(KNOWN_SKILLS, { each: true, message: 'Habilidade desconhecida.' })
  knownSkills: KnownSkill[];

  @IsIn(WEEKLY_TIMES, { message: 'Tempo semanal inválido.' })
  weeklyTime: WeeklyTime;

  @IsIn(LEARNING_STYLES, { message: 'Estilo de aprendizado inválido.' })
  learningStyle: LearningStyle;
}
