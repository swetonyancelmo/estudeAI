import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Uma resposta do usuário a uma pergunta de quiz (Fase 3). Só se acrescenta,
 * nunca se altera: o histórico é o que alimenta a evolução (Fase 5) e a
 * revisão espaçada (Fase 6). A situação atual do quiz é a última resposta de
 * cada pergunta.
 *
 * `roadmap_topic_id` diz em qual roadmap a pessoa respondeu; `user_id` fica
 * desnormalizado de propósito, para as consultas por usuário das próximas fases
 * não precisarem atravessar roadmap → módulo → tópico.
 */
@Entity('quiz_attempts')
@Index('IDX_quiz_attempts_topic_question', ['roadmapTopicId', 'questionId'])
@Index('IDX_quiz_attempts_user_created', ['userId', 'createdAt'])
export class QuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'roadmap_topic_id' })
  roadmapTopicId: string;

  @Column({ type: 'uuid', name: 'question_id' })
  questionId: string;

  @Column({ type: 'int', name: 'chosen_index' })
  chosenIndex: number;

  @Column({ type: 'boolean', name: 'is_correct' })
  isCorrect: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
