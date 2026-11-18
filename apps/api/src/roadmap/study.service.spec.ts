import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Roadmap } from './entities/roadmap.entity';
import { StudyService } from './study.service';
import type { UserRoadmapService } from './user-roadmap.service';

const USER = 'user-1';
const TODAY = new Date().toISOString().slice(0, 10);

function roadmap(): Roadmap {
  return {
    id: 'roadmap-1',
    userId: USER,
    answers: { weeklyTime: '5h' },
    modules: [
      {
        id: 'm2',
        title: 'Segundo',
        order: 1,
        topics: [
          {
            id: 't3',
            isCompleted: false,
            completedAt: null,
            estimatedHours: 6,
            trackTopicId: 'tt3',
          },
        ],
      },
      {
        id: 'm1',
        title: 'Primeiro',
        order: 0,
        topics: [
          {
            id: 't1',
            isCompleted: true,
            completedAt: new Date(),
            estimatedHours: 3,
            trackTopicId: 'tt1',
          },
          {
            id: 't2',
            isCompleted: false,
            completedAt: null,
            estimatedHours: 4,
            trackTopicId: null,
          },
        ],
      },
    ],
  } as unknown as Roadmap;
}

describe('StudyService (Fase 5)', () => {
  let userRoadmaps: { assertOwner: jest.Mock; loadOwnedRoadmap: jest.Mock };
  let studyDays: { query: jest.Mock<Promise<unknown>, [string, unknown[]]> };
  let service: StudyService;

  beforeEach(() => {
    userRoadmaps = {
      assertOwner: jest.fn().mockResolvedValue(undefined),
      loadOwnedRoadmap: jest.fn().mockResolvedValue(roadmap()),
    };
    studyDays = {
      query: jest
        .fn<Promise<unknown>, [string, unknown[]]>()
        .mockResolvedValue([]),
    };
    service = new StudyService(
      userRoadmaps as unknown as UserRoadmapService,
      studyDays as never,
    );
  });

  describe('recordMinute', () => {
    it('confere o dono e soma o minuto num upsert com as travas de 55 s', async () => {
      await service.recordMinute(USER, 'roadmap-1', TODAY);

      expect(userRoadmaps.assertOwner).toHaveBeenCalledWith(USER, 'roadmap-1');
      const [sql, params] = studyDays.query.mock.calls[0];
      expect(params).toEqual([USER, 'roadmap-1', TODAY]);
      expect(sql).toContain("interval '55 seconds'");
      expect(sql).toContain('ON CONFLICT ("user_id", "roadmap_id", "day")');
    });

    it('recusa dia inválido ou longe demais de hoje, sem consultar nada', async () => {
      await expect(
        service.recordMinute(USER, 'roadmap-1', '2020-01-01'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.recordMinute(USER, 'roadmap-1', 'hoje'),
      ).rejects.toThrow(BadRequestException);
      expect(userRoadmaps.assertOwner).not.toHaveBeenCalled();
      expect(studyDays.query).not.toHaveBeenCalled();
    });

    it('roadmap alheio: 403 e nada gravado', async () => {
      userRoadmaps.assertOwner.mockRejectedValue(new ForbiddenException());

      await expect(
        service.recordMinute('intruso', 'roadmap-1', TODAY),
      ).rejects.toThrow(ForbiddenException);
      expect(studyDays.query).not.toHaveBeenCalled();
    });
  });

  describe('stats', () => {
    it('monta o painel a partir das consultas e das funções puras', async () => {
      studyDays.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM "study_days"')) {
          return Promise.resolve([
            { day: TODAY, roadmap_id: 'roadmap-1', minutes: 30 },
            { day: TODAY, roadmap_id: 'outro-roadmap', minutes: 15 },
          ]);
        }
        if (sql.includes('"quiz_attempts"')) {
          return Promise.resolve([
            { module_id: 'm1', answered: '3', correct: '2' },
          ]);
        }
        if (sql.includes('"track_quiz_questions"')) {
          return Promise.resolve([
            { module_id: 'm1', total: '4' },
            { module_id: 'm2', total: '4' },
          ]);
        }
        if (sql.includes('"track_challenges"')) {
          return Promise.resolve([{ total: '2' }]);
        }
        if (sql.includes('"challenge_progress"')) {
          return Promise.resolve([{ total: '1' }]);
        }
        return Promise.resolve([]);
      });

      const stats = await service.stats(USER, 'roadmap-1', TODAY, 'UTC');

      // O mapa soma todos os roadmaps; as semanas, só este.
      expect(stats.days).toEqual([{ day: TODAY, minutes: 45 }]);
      expect(stats.weeks).toHaveLength(8);
      expect(stats.weeks[7]).toEqual(
        expect.objectContaining({ minutes: 30, topicsCompleted: 1 }),
      );
      expect(stats.currentStreak).toBe(1);
      expect(stats.weeklyGoalMinutes).toBe(300);
      expect(stats.remainingHours).toBe(10);
      expect(stats.quizByModule).toEqual([
        {
          moduleId: 'm1',
          title: 'Primeiro',
          answered: 3,
          correct: 2,
          total: 4,
        },
        { moduleId: 'm2', title: 'Segundo', answered: 0, correct: 0, total: 4 },
      ]);
      expect(stats.challenges).toEqual({ passed: 1, total: 2 });
      // 30 min nas últimas 4 semanas → média 8 min/semana → 600 min / 8 = 75 semanas.
      expect(stats.recentWeeklyMinutes).toBe(8);
      expect(stats.weeksAtRecentPace).toBe(75);
    });

    it('recusa fuso e dia inválidos', async () => {
      await expect(
        service.stats(USER, 'roadmap-1', TODAY, 'Marte/Olympus'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.stats(USER, 'roadmap-1', '2020-01-01', 'UTC'),
      ).rejects.toThrow(BadRequestException);
      expect(userRoadmaps.loadOwnedRoadmap).not.toHaveBeenCalled();
    });
  });
});
