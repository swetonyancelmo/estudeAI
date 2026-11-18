import { IsInt, IsUUID, Max, Min } from 'class-validator';
import {
  QUIZ_OPTION_COUNT,
  type SubmitQuizAnswerRequestDto,
} from '@estudeai/shared-types';

/** Payload de POST /roadmap/:id/topics/:topicId/quiz/answers. */
export class SubmitQuizAnswerDto implements SubmitQuizAnswerRequestDto {
  @IsUUID('4', { message: 'Pergunta inválida.' })
  questionId: string;

  @IsInt({ message: 'Escolha uma alternativa.' })
  @Min(0)
  @Max(QUIZ_OPTION_COUNT - 1)
  chosenIndex: number;
}
