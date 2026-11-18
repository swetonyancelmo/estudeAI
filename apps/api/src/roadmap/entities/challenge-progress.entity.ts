import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Andamento de um usuário num desafio de código (Fase 4): o código atual, para
 * continuar de onde parou, e se os testes já passaram. Uma linha por tópico do
 * roadmap e desafio. `passed` só avança: refazer e errar depois não apaga o
 * que a pessoa já resolveu.
 */
@Entity('challenge_progress')
@Index(
  'UQ_challenge_progress_topic_challenge',
  ['roadmapTopicId', 'challengeId'],
  { unique: true },
)
export class ChallengeProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_challenge_progress_user')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'roadmap_topic_id' })
  roadmapTopicId: string;

  @Index('IDX_challenge_progress_challenge')
  @Column({ type: 'uuid', name: 'challenge_id' })
  challengeId: string;

  @Column({ type: 'jsonb' })
  files: Record<string, string>;

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({ type: 'timestamptz', name: 'passed_at', nullable: true })
  passedAt: Date | null;

  /** Quantas vezes os testes rodaram (com resultado informado). */
  @Column({ type: 'int', default: 0 })
  runs: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
