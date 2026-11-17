import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { TopicKind } from '@estudeai/shared-types';
import { Module } from './module.entity';
import { Resource } from './resource.entity';

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

  /** Tópico de estudo ou projeto de fim de módulo. */
  @Column({ type: 'varchar', default: 'topic' })
  kind: TopicKind;

  /** Só nos projetos: o que construir. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', name: 'is_completed', default: false })
  isCompleted: boolean;

  @Column({ type: 'int', name: 'order_index' })
  order: number;

  /** Estimativa opcional da IA — o Gemini pode omitir (ver RoadmapTopicDto). */
  @Column({ type: 'int', name: 'estimated_hours', nullable: true })
  estimatedHours: number | null;

  /**
   * Tópico da trilha curada de onde este nasceu. Só o id, sem relação: serve
   * para a fila de recursos achar quem ainda está sem links, e vira nulo quando
   * o reajuste muda o assunto do tópico.
   */
  @Column({ type: 'uuid', name: 'track_topic_id', nullable: true })
  trackTopicId: string | null;

  /**
   * Recursos gratuitos de estudo (Etapa 8). `cascade: ['insert']` faz com que
   * eles entrem na MESMA transação que grava roadmap + módulos + tópicos: ou o
   * tópico nasce com seus links, ou não nasce.
   */
  @OneToMany(() => Resource, (resource) => resource.topic, {
    cascade: ['insert'],
  })
  resources: Resource[];
}
