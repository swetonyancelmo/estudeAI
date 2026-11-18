import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Minutos de estudo de uma pessoa num roadmap, num dia (Fase 5). O dia é o
 * LOCAL de quem estuda, informado pelo navegador. Cada aviso de "estou
 * estudando" soma 1 minuto, desde que o anterior tenha mais de 55 s
 * (`last_beat_at`) — assim duas abas abertas não contam em dobro.
 */
@Entity('study_days')
@Index('IDX_study_days_roadmap_day', ['roadmapId', 'day'])
export class StudyDay {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @PrimaryColumn({ type: 'uuid', name: 'roadmap_id' })
  roadmapId: string;

  @PrimaryColumn({ type: 'date' })
  day: string;

  @Column({ type: 'int', default: 0 })
  minutes: number;

  @Column({ type: 'timestamptz', name: 'last_beat_at' })
  lastBeatAt: Date;
}
