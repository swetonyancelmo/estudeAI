import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Roadmap } from './roadmap.entity';
import { Topic } from './topic.entity';

/**
 * Módulo do roadmap do usuário (ARCHITETURE.md §4).
 *
 * A coluna é `order_index`, não `order`: `order` é palavra reservada em SQL e
 * as migrations aqui são SQL cru — o rename evita ter que lembrar das aspas em
 * toda query futura. A propriedade continua `order`, casando com o DTO.
 */
@Entity('roadmap_modules')
export class Module {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_roadmap_modules_roadmap_id')
  @Column({ type: 'uuid', name: 'roadmap_id' })
  roadmapId: string;

  @ManyToOne(() => Roadmap, (roadmap) => roadmap.modules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roadmap_id' })
  roadmap: Roadmap;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', name: 'order_index' })
  order: number;

  @OneToMany(() => Topic, (topic) => topic.module, { cascade: ['insert'] })
  topics: Topic[];
}
