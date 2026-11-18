import { IsInt, Max, Min } from 'class-validator';
import {
  QUIZ_OPTION_COUNT,
  type SubmitReviewAnswerRequestDto,
} from '@estudeai/shared-types';

/** Payload de POST /review/:cardId/answer. */
export class SubmitReviewAnswerDto implements SubmitReviewAnswerRequestDto {
  @IsInt({ message: 'Escolha uma alternativa.' })
  @Min(0)
  @Max(QUIZ_OPTION_COUNT - 1)
  chosenIndex: number;
}
