import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { RoadmapResponseDto } from '@estudeai/shared-types';

/**
 * Cache de roadmaps pré-gerados (FR-02.2). Um registro por conjunto EXATO de
 * critérios do wizard (goal + weeklyTime + affinity + learningStyle) — os 4
 * campos do WizardAnswersDto, os únicos disponíveis ANTES de chamar o Gemini.
 * (targetArea NÃO entra na chave: é a área que a IA sugere — output —, então
 * fica dentro do `payload`, não como critério de match.)
 *
 * O roadmap gerado é guardado inteiro em `payload` (jsonb): isto é cache
 * genérico, não roadmap vinculado a usuário nem progresso — isso é Etapa 6.
 *
 * O índice composto é UNIQUE: não pode existir dois templates pro mesmo
 * conjunto de critérios (também serve de guard-rail contra corrida — dois
 * cache miss simultâneos: o segundo insert viola o índice, tratado no service).
 */
@Entity('roadmap_templates')
@Index(
  'UQ_roadmap_templates_criteria',
  ['goal', 'weeklyTime', 'affinity', 'learningStyle'],
  { unique: true },
)
export class RoadmapTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  goal: string;

  @Column({ type: 'varchar', name: 'weekly_time' })
  weeklyTime: string;

  @Column({ type: 'varchar' })
  affinity: string;

  @Column({ type: 'varchar', name: 'learning_style' })
  learningStyle: string;

  @Column({ type: 'jsonb' })
  payload: RoadmapResponseDto;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
