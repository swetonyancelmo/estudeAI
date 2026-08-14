import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Module } from './module.entity';

/**
 * Tópico do roadmap do usuário. `is_completed` é o ÚNICO dado de progresso do
 * sistema (FR-03.3) — não há contador desnormalizado em Roadmap: o percentual
 * é sempre derivado destas linhas, então não existe estado a dessincronizar.
 */
@Entity('roadmap_topics')
export class Topic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_roadmap_topics_module_id')
  @Column({ type: 'uuid', name: 'module_id' })
  moduleId: string;

  @ManyToOne(() => Module, (module) => module.topics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: Module;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'boolean', name: 'is_completed', default: false })
  isCompleted: boolean;

  @Column({ type: 'int', name: 'order_index' })
  order: number;

  /** Estimativa opcional da IA — o Gemini pode omitir (ver RoadmapTopicDto). */
  @Column({ type: 'int', name: 'estimated_hours', nullable: true })
  estimatedHours: number | null;
}
