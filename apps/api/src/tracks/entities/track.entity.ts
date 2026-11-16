import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TrackModule } from './track-module.entity';

/** Trilha curada (docs/TRILHAS.md). Catálogo: não pertence a usuário nenhum. */
@Entity('tracks')
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  /** SHA-256 do JSON de origem — é o que diz ao boot se há algo a sincronizar. */
  @Column({ type: 'varchar', name: 'content_hash' })
  contentHash: string;

  @OneToMany(() => TrackModule, (module) => module.track)
  modules: TrackModule[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
