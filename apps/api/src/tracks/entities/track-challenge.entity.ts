import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ChallengeTemplate } from '@estudeai/shared-types';
import { TrackTopic } from './track-topic.entity';

/**
 * Desafio de código de um tópico da trilha (Fase 4). Conteúdo compartilhado,
 * vindo do JSON e casado pelo `slug` (o `id` do JSON) a cada sync, para o
 * progresso dos usuários continuar preso a ele.
 */
@Entity('track_challenges')
@Index('UQ_track_challenges_topic_slug', ['trackTopicId', 'slug'], {
  unique: true,
})
export class TrackChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'track_topic_id' })
  trackTopicId: string;

  @ManyToOne(() => TrackTopic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_topic_id' })
  topic: TrackTopic;

  @Column({ type: 'varchar' })
  slug: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'varchar' })
  template: ChallengeTemplate;

  /** Código inicial: caminho → conteúdo. */
  @Column({ type: 'jsonb' })
  files: Record<string, string>;

  @Column({ type: 'text' })
  tests: string;

  @Column({ type: 'jsonb' })
  solution: Record<string, string>;

  @Column({ type: 'int', name: 'order_index' })
  order: number;
}
