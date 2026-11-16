import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Track } from './track.entity';
import { TrackTopic } from './track-topic.entity';

@Entity('track_modules')
@Index('UQ_track_modules_track_slug', ['trackId', 'slug'], { unique: true })
export class TrackModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'track_id' })
  trackId: string;

  @ManyToOne(() => Track, (track) => track.modules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_id' })
  track: Track;

  @Column({ type: 'varchar' })
  slug: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', name: 'order_index' })
  order: number;

  // O projeto de portfólio é 1:1 com o módulo, então vive em colunas dele.
  @Column({ type: 'varchar', name: 'project_title' })
  projectTitle: string;

  @Column({ type: 'text', name: 'project_description' })
  projectDescription: string;

  @Column({ type: 'int', name: 'project_hours' })
  projectHours: number;

  @OneToMany(() => TrackTopic, (topic) => topic.module)
  topics: TrackTopic[];
}
