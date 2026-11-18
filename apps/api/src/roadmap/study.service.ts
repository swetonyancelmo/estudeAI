import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WEEKLY_HOURS,
  type ModuleQuizStatsDto,
  type RoadmapStatsDto,
} from '@estudeai/shared-types';
import { StudyDay } from './entities/study-day.entity';
import {
  isPlausibleToday,
  isValidTimeZone,
  localDay,
  pace,
  streaks,
  weekly,
  addDays,
} from './study-stats';
import { UserRoadmapService } from './user-roadmap.service';

/** Janela de dias devolvida ao mapa de estudo (pouco mais de 6 meses). */
const HEATMAP_DAYS = 26 * 7;

/**
 * Soma 1 minuto ao dia, com duas travas contra contagem em dobro:
 *  - a linha do dia só soma se o último aviso dela tem mais de 55 s;
 *  - nada soma se a pessoa teve qualquer aviso nos últimos 55 s, em qualquer
 *    roadmap (duas abas, de roadmaps diferentes, ao mesmo tempo).
 * Tudo numa instrução, para avisos simultâneos não passarem juntos.
 */
const RECORD_MINUTE_SQL = `
  INSERT INTO "study_days" ("user_id", "roadmap_id", "day", "minutes", "last_beat_at")
  SELECT $1, $2, $3::date, 1, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM "study_days"
    WHERE "user_id" = $1 AND "last_beat_at" > now() - interval '55 seconds'
  )
  ON CONFLICT ("user_id", "roadmap_id", "day") DO UPDATE SET
    "minutes" = "study_days"."minutes" + 1,
    "last_beat_at" = now()
  WHERE "study_days"."last_beat_at" <= now() - interval '55 seconds'
    AND "study_days"."minutes" < 1440
`;

interface DayRow {
  day: string;
  roadmap_id: string;
  minutes: number;
}

interface QuizModuleRow {
  module_id: string;
  answered: string;
  correct: string;
}

interface CountRow {
  module_id?: string;
  total: string;
}

/**
 * Evolução do estudante (Fase 5): registro do tempo de estudo e o painel.
 * Os cálculos de data ficam em `study-stats.ts` (funções puras).
 */
@Injectable()
export class StudyService {
  constructor(
    private readonly userRoadmaps: UserRoadmapService,
    @InjectRepository(StudyDay)
    private readonly studyDays: Repository<StudyDay>,
  ) {}

  async recordMinute(
    userId: string,
    roadmapId: string,
    day: string,
  ): Promise<void> {
    if (!isPlausibleToday(day)) {
      throw new BadRequestException('Dia inválido.');
    }
    await this.userRoadmaps.assertOwner(userId, roadmapId);
    await this.studyDays.query(RECORD_MINUTE_SQL, [userId, roadmapId, day]);
  }

  async stats(
    userId: string,
    roadmapId: string,
    today: string,
    timeZone: string,
  ): Promise<RoadmapStatsDto> {
    if (!isPlausibleToday(today)) {
      throw new BadRequestException('Dia inválido.');
    }
    if (!isValidTimeZone(timeZone)) {
      throw new BadRequestException('Fuso horário inválido.');
    }
    const roadmap = await this.userRoadmaps.loadOwnedRoadmap(userId, roadmapId);
    const topics = roadmap.modules.flatMap((module) => module.topics);
    const topicIds = topics.map((topic) => topic.id);
    const trackTopicIds = topics
      .map((topic) => topic.trackTopicId)
      .filter((id): id is string => id !== null);

    // Dias de estudo da pessoa (todos os roadmaps) na janela do mapa.
    const dayRows: DayRow[] = await this.studyDays.query(
      `SELECT to_char("day", 'YYYY-MM-DD') AS "day", "roadmap_id", "minutes"
         FROM "study_days"
        WHERE "user_id" = $1 AND "day" > $2::date AND "minutes" > 0`,
      [userId, addDays(today, -HEATMAP_DAYS)],
    );
    const allDays = new Map<string, number>();
    const thisRoadmapDays = new Map<string, number>();
    for (const row of dayRows) {
      allDays.set(row.day, (allDays.get(row.day) ?? 0) + row.minutes);
      if (row.roadmap_id === roadmap.id) {
        thisRoadmapDays.set(
          row.day,
          (thisRoadmapDays.get(row.day) ?? 0) + row.minutes,
        );
      }
    }

    const completedDays = topics
      .filter((topic) => topic.isCompleted && topic.completedAt)
      .map((topic) => localDay(topic.completedAt!, timeZone));
    const weeks = weekly(today, thisRoadmapDays, completedDays);
    const remainingHours = topics
      .filter((topic) => !topic.isCompleted)
      .reduce((sum, topic) => sum + (topic.estimatedHours ?? 0), 0);
    const { current, best } = streaks(allDays.keys(), today);
    const weeklyHours = roadmap.answers
      ? WEEKLY_HOURS[roadmap.answers.weeklyTime]
      : null;

    return {
      roadmapId: roadmap.id,
      today,
      days: [...allDays.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, minutes]) => ({ day, minutes })),
      currentStreak: current,
      bestStreak: best,
      weeklyGoalMinutes: weeklyHours ? weeklyHours * 60 : null,
      weeks,
      quizByModule: await this.quizByModule(
        roadmap.modules,
        topicIds,
        trackTopicIds,
      ),
      challenges: await this.challengeCounts(topicIds, trackTopicIds),
      remainingHours,
      ...pace(weeks, remainingHours),
    };
  }

  /** Acertos por módulo, pela última resposta de cada pergunta. */
  private async quizByModule(
    modules: { id: string; title: string; order: number }[],
    topicIds: string[],
    trackTopicIds: string[],
  ): Promise<ModuleQuizStatsDto[]> {
    if (topicIds.length === 0) return [];
    const answeredRows: QuizModuleRow[] = await this.studyDays.query(
      `SELECT latest."module_id",
              count(*) AS "answered",
              count(*) FILTER (WHERE latest."is_correct") AS "correct"
         FROM (
           SELECT DISTINCT ON (a."roadmap_topic_id", a."question_id")
                  t."module_id", a."is_correct"
             FROM "quiz_attempts" a
             JOIN "roadmap_topics" t ON t."id" = a."roadmap_topic_id"
            WHERE a."roadmap_topic_id" = ANY($1::uuid[])
            ORDER BY a."roadmap_topic_id", a."question_id", a."created_at" DESC
         ) latest
        GROUP BY latest."module_id"`,
      [topicIds],
    );
    const totalRows: CountRow[] =
      trackTopicIds.length === 0
        ? []
        : await this.studyDays.query(
            `SELECT t."module_id", count(q."id") AS "total"
               FROM "roadmap_topics" t
               JOIN "track_quiz_questions" q ON q."track_topic_id" = t."track_topic_id"
              WHERE t."id" = ANY($1::uuid[])
              GROUP BY t."module_id"`,
            [topicIds],
          );
    const answered = new Map(answeredRows.map((row) => [row.module_id, row]));
    const totals = new Map(
      totalRows.map((row) => [row.module_id, Number(row.total)]),
    );

    return [...modules]
      .sort((a, b) => a.order - b.order)
      .filter((module) => (totals.get(module.id) ?? 0) > 0)
      .map((module) => ({
        moduleId: module.id,
        title: module.title,
        answered: Number(answered.get(module.id)?.answered ?? 0),
        correct: Number(answered.get(module.id)?.correct ?? 0),
        total: totals.get(module.id) ?? 0,
      }));
  }

  private async challengeCounts(
    topicIds: string[],
    trackTopicIds: string[],
  ): Promise<{ passed: number; total: number }> {
    if (trackTopicIds.length === 0) return { passed: 0, total: 0 };
    const totalRows: CountRow[] = await this.studyDays.query(
      `SELECT count(c."id") AS "total"
         FROM "roadmap_topics" t
         JOIN "track_challenges" c ON c."track_topic_id" = t."track_topic_id"
        WHERE t."id" = ANY($1::uuid[])`,
      [topicIds],
    );
    const passedRows: CountRow[] = await this.studyDays.query(
      `SELECT count(*) AS "total" FROM "challenge_progress"
        WHERE "roadmap_topic_id" = ANY($1::uuid[]) AND "passed"`,
      [topicIds],
    );
    return {
      passed: Number(passedRows[0]?.total ?? 0),
      total: Number(totalRows[0]?.total ?? 0),
    };
  }
}
