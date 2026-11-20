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
import type { TrackDocContent, TrackVideoContent } from '../track-content';
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

  /**
   * Documentação oficial curada no JSON (Fase 2). Vem do arquivo e é
   * regravada a cada sync: não custa cota nem tem id próprio, então jsonb
   * basta. Vira linhas `topic_resources` (source 'docs') no roadmap do usuário.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  docs: TrackDocContent[];

  /**
   * Videoaulas curadas no JSON (`pnpm videos import`). Mesmo regime de `docs`:
   * vem do arquivo, é regravada a cada sync e vira linhas `topic_resources`
   * (source 'youtube') no roadmap do usuário.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  videos: TrackVideoContent[];

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
