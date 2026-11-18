import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ReviewAnswerResultDto,
  ReviewQueueDto,
} from '@estudeai/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SubmitReviewAnswerDto } from './dto/submit-review-answer.dto';
import { ReviewService } from './review.service';

/**
 * Revisão espaçada (Fase 6). É da pessoa, não de um roadmap: a fila junta as
 * perguntas de todas as trilhas dela.
 */
@Controller('review')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  /** Perguntas com revisão vencida, sem o gabarito. */
  @Get('queue')
  queue(@CurrentUser() user: AuthenticatedUser): Promise<ReviewQueueDto> {
    return this.review.queue(user.id);
  }

  /** Corrige, grava e agenda a próxima revisão; só então revela o gabarito. */
  @Post(':cardId/answer')
  @HttpCode(HttpStatus.OK)
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: SubmitReviewAnswerDto,
  ): Promise<ReviewAnswerResultDto> {
    return this.review.answer(user.id, cardId, dto.chosenIndex);
  }
}
