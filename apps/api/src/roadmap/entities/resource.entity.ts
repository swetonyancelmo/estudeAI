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
import { Topic } from './topic.entity';

/**
 * Recurso gratuito de estudo anexado a um tópico (Etapa 8): vídeo/playlist do
 * YouTube ou artigo da web.
 *
 * `url` é sempre a URL FINAL, já resolvida pelo validador — nunca o redirect
 * `vertexaisearch.cloud.google.com/grounding-api-redirect/...` que a Gemini API
 * devolve no groundingMetadata e que expira em ~30 dias.
 *
 * `type` e `source` são varchar, não enum do Postgres — mesma escolha de
 * `roadmaps.status` e `roadmaps.target_area`: os valores são fonte única em
 * `@estudeai/shared-types`, e mudar a lista não exige ALTER TYPE.
 */
@Entity('topic_resources')
@Index('UQ_topic_resources_topic_url', ['topicId', 'url'], { unique: true })
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_topic_resources_topic_id')
  @Column({ type: 'uuid', name: 'topic_id' })
  topicId: string;

  @ManyToOne(() => Topic, (topic) => topic.resources, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic: Topic;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar' })
  type: ResourceType;

  /** Só o YouTube fornece; artigos da web ficam nulos. */
  @Column({ type: 'text', name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'varchar' })
  source: ResourceSource;

  /**
   * Não serve como ordenação: `now()` é constante dentro da transação, então
   * todos os recursos de um roadmap nascem com o MESMO timestamp. A ordem de
   * exibição é derivada de `source`/`title` no DTO (ver `toDetailDto`).
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
