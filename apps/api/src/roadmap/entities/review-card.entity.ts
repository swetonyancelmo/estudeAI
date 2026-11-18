import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { StoredCard } from '../review-scheduler';

/**
 * Cartão de revisão espaçada (Fase 6): uma pergunta de quiz para uma pessoa.
 * `due` fica em coluna (a fila do dia filtra e ordena por ela); o estado
 * completo do FSRS fica em `card` (jsonb), como o `ts-fsrs` o define.
 * `roadmap_topic_id` é o tópico onde a pessoa respondeu, usado para gravar as
 * respostas da revisão no mesmo lugar das do quiz.
 */
@Entity('review_cards')
@Index('UQ_review_cards_user_question', ['userId', 'questionId'], {
  unique: true,
})
@Index('IDX_review_cards_user_due', ['userId', 'due'])
export class ReviewCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Index('IDX_review_cards_question')
  @Column({ type: 'uuid', name: 'question_id' })
  questionId: string;

  @Index('IDX_review_cards_topic')
  @Column({ type: 'uuid', name: 'roadmap_topic_id' })
  roadmapTopicId: string;

  @Column({ type: 'timestamptz' })
  due: Date;

  @Column({ type: 'jsonb' })
  card: StoredCard;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
