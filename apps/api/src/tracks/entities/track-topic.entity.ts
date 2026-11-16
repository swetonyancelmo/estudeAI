import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { KnownSkill, TrackTopicLevel } from '@estudeai/shared-types';
import { TrackModule } from './track-module.entity';
import { TrackTopicResource } from './track-topic-resource.entity';

@Entity('track_topics')
@Index('UQ_track_topics_track_slug', ['trackId', 'slug'], { unique: true })
export class TrackTopic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Redundante com o módulo: existe para o slug ser único NA TRILHA. */
  @Column({ type: 'uuid', name: 'track_id' })
  trackId: string;

  @Index('IDX_track_topics_module_id')
  @Column({ type: 'uuid', name: 'module_id' })
  moduleId: string;

  @ManyToOne(() => TrackModule, (module) => module.topics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'module_id' })
  module: TrackModule;

  @Column({ type: 'varchar' })
  slug: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  level: TrackTopicLevel;

  @Column({ type: 'boolean' })
  required: boolean;

  @Column({ type: 'int', name: 'estimated_hours' })
  estimatedHours: number;

  @Column({ type: 'varchar', name: 'known_skill', nullable: true })
  knownSkill: KnownSkill | null;

  /** Slugs de tópicos da mesma trilha que precisam vir antes. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  prerequisites: string[];

  @Column({ type: 'varchar', name: 'search_query' })
  searchQuery: string;

  @Column({ type: 'int', name: 'order_index' })
  order: number;

  /** Nulo = recursos ainda não buscados (fila do TrackResourceSyncService). */
  @Column({
    type: 'timestamptz',
    name: 'resources_fetched_at',
    nullable: true,
  })
  resourcesFetchedAt: Date | null;

  @OneToMany(() => TrackTopicResource, (resource) => resource.topic)
  resources: TrackTopicResource[];
}
