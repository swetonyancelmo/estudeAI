import { IsIn, IsObject, IsOptional } from 'class-validator';
import type {
  ChallengeFiles,
  SaveChallengeRequestDto,
} from '@estudeai/shared-types';

/**
 * Payload de PUT /roadmap/:id/topics/:topicId/challenges/:challengeId. O
 * formato de `files` (quais caminhos, tamanho de cada um) é conferido no
 * serviço, contra os arquivos do próprio desafio.
 */
export class SaveChallengeDto implements SaveChallengeRequestDto {
  @IsObject({ message: 'files deve ser um objeto caminho → código.' })
  files: ChallengeFiles;

  @IsOptional()
  @IsIn(['pass', 'fail'], { message: 'result deve ser pass ou fail.' })
  result?: 'pass' | 'fail';
}
