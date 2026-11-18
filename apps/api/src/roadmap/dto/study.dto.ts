import { IsString, MaxLength } from 'class-validator';
import type { StudyTimeRequestDto } from '@estudeai/shared-types';

/** Payload de POST /roadmap/:id/study-time. O dia é validado no serviço. */
export class StudyTimeDto implements StudyTimeRequestDto {
  @IsString({ message: 'Informe o dia (YYYY-MM-DD).' })
  @MaxLength(10)
  day: string;
}

/** Query de GET /roadmap/:id/stats. */
export class StatsQueryDto {
  @IsString({ message: 'Informe o dia de hoje (YYYY-MM-DD).' })
  @MaxLength(10)
  today: string;

  @IsString({ message: 'Informe o fuso horário (ex.: America/Sao_Paulo).' })
  @MaxLength(64)
  tz: string;
}
