import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { RoadmapStatus, TargetArea } from '@estudeai/shared-types';
import { User } from '../../users/entities/user.entity';
import { Module } from './module.entity';

/**
 * FR-03.2 — roadmap de UM usuário. Não confundir com `RoadmapTemplate`: aquele
 * é cache genérico por critério do wizard (compartilhado entre usuários, sem
 * progresso); este é a instância pessoal, criada COPIANDO o conteúdo do
 * template/Gemini. Progresso (FR-03.3) vive nos Topics desta árvore, então
 * marcar um tópico jamais toca no cache compartilhado.
 */
@Entity('roadmaps')
export class Roadmap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_roadmaps_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', name: 'target_area' })
  targetArea: TargetArea;

  @Column({ type: 'text' })
  justification: string;

  @Column({ type: 'varchar', default: 'active' })
  status: RoadmapStatus;

  /**
   * `cascade: ['insert']` é o que permite gravar roadmap + módulos + tópicos
   * numa única chamada a save(), dentro de uma transação só. O ON DELETE
   * CASCADE da migration cuida do lado da remoção (no banco, não na aplicação).
   */
  @OneToMany(() => Module, (module) => module.roadmap, { cascade: ['insert'] })
  modules: Module[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
