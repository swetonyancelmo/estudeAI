import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { UpdateResourceProgressRequestDto } from '@estudeai/shared-types';

/** Um dia de vídeo é teto mais do que suficiente para qualquer aula. */
const MAX_WATCHED_SECONDS = 24 * 60 * 60;

/** Payload de PATCH /roadmap/:id/topics/:topicId/resources/:resourceId. */
export class UpdateResourceProgressDto implements UpdateResourceProgressRequestDto {
  @IsIn(['in_progress', 'completed'], {
    message: 'Status deve ser in_progress ou completed.',
  })
  status: 'in_progress' | 'completed';

  @IsOptional()
  @IsInt({ message: 'watchedSeconds deve ser um número inteiro.' })
  @Min(0)
  @Max(MAX_WATCHED_SECONDS)
  watchedSeconds?: number;
}
