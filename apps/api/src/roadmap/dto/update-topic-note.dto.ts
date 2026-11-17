import { IsString, MaxLength } from 'class-validator';
import {
  TOPIC_NOTE_MAX_LENGTH,
  type UpdateTopicNoteRequestDto,
} from '@estudeai/shared-types';

/**
 * Payload de PUT /roadmap/:id/topics/:topicId/note. String vazia é válida: é
 * como o usuário apaga a anotação.
 */
export class UpdateTopicNoteDto implements UpdateTopicNoteRequestDto {
  @IsString({ message: 'A anotação deve ser um texto.' })
  @MaxLength(TOPIC_NOTE_MAX_LENGTH, {
    message: `A anotação deve ter no máximo ${TOPIC_NOTE_MAX_LENGTH} caracteres.`,
  })
  content: string;
}
