import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TrackTopic } from './track-topic.entity';

/**
 * Pergunta de quiz de um tópico da trilha (Fase 3). Conteúdo compartilhado,
 * vindo do JSON — não é copiada para o roadmap do usuário. O `id` (uuid) fica
 * estável entre syncs porque o sync casa pelo `slug` (o `id` do JSON), e é nele
 * que as tentativas dos usuários se prendem.
 */
@Entity('track_quiz_questions')
@Index('UQ_track_quiz_questions_topic_slug', ['trackTopicId', 'slug'], {
  unique: true,
})
export class TrackQuizQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'track_topic_id' })
  trackTopicId: string;

  @ManyToOne(() => TrackTopic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_topic_id' })
  topic: TrackTopic;

  @Column({ type: 'varchar' })
  slug: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'jsonb' })
  options: string[];

  /** Nunca sai da API antes de a pessoa responder. */
  @Column({ type: 'int', name: 'answer_index' })
  answerIndex: number;

  @Column({ type: 'text' })
  explanation: string;

  @Column({ type: 'int', name: 'order_index' })
  order: number;
}
