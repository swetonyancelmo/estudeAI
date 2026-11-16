import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ResourceSource, ResourceType } from '@estudeai/shared-types';
import { TrackTopic } from './track-topic.entity';

/** Mesmo formato de `topic_resources`, mas preso ao tópico da TRILHA. */
@Entity('track_topic_resources')
@Index('UQ_track_topic_resources_topic_url', ['trackTopicId', 'url'], {
  unique: true,
})
export class TrackTopicResource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'track_topic_id' })
  trackTopicId: string;

  @ManyToOne(() => TrackTopic, (topic) => topic.resources, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'track_topic_id' })
  topic: TrackTopic;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar' })
  type: ResourceType;

  @Column({ type: 'text', name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'varchar' })
  source: ResourceSource;

  /** Ordem em que a descoberta devolveu (relevância) — não há outra chave estável. */
  @Column({ type: 'int', name: 'order_index' })
  order: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
