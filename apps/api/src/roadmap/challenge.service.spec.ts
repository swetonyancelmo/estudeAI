import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { TrackChallenge } from '../tracks/entities/track-challenge.entity';
import type { ChallengeProgress } from './entities/challenge-progress.entity';
import type { Topic } from './entities/topic.entity';
import { ChallengeService } from './challenge.service';
import type { UserRoadmapService } from './user-roadmap.service';

const USER = 'user-1';

function challenge(id: string): TrackChallenge {
  return {
    id,
    trackTopicId: 'track-topic-1',
    slug: id,
    title: `Desafio ${id}`,
    prompt: 'Implemente `soma`.',
    template: 'vanilla',
    files: {
      '/exercicio.js': 'export function soma() {}\n',
      '/util.js': 'export const x = 1;\n',
    },
    tests: "test('x', () => {});",
    solution: {
      '/exercicio.js': 'export function soma(a, b) { return a + b; }\n',
    },
    order: 0,
  } as unknown as TrackChallenge;
}

describe('ChallengeService (Fase 4)', () => {
  let topic: Partial<Topic>;
  let userRoadmaps: { loadOwnedTopic: jest.Mock };
  let challenges: { find: jest.Mock };
  let progress: {
    find: jest.Mock;
    query: jest.Mock<Promise<unknown>, [string, unknown[]]>;
  };
  let service: ChallengeService;

  beforeEach(() => {
    topic = { id: 'topic-1', trackTopicId: 'track-topic-1' };
    userRoadmaps = { loadOwnedTopic: jest.fn(() => Promise.resolve(topic)) };
    challenges = { find: jest.fn().mockResolvedValue([challenge('c1')]) };
    progress = {
      find: jest.fn().mockResolvedValue([]),
      query: jest
        .fn<Promise<unknown>, [string, unknown[]]>()
        .mockResolvedValue([{ passed: false, passed_at: null }]),
    };
    service = new ChallengeService(
      userRoadmaps as unknown as UserRoadmapService,
      challenges as never,
      progress as never,
    );
  });

  describe('list', () => {
    it('sem progresso: código inicial, não resolvido, sem solução no payload', async () => {
      const result = await service.list(USER, 'roadmap-1', 'topic-1');

      expect(result.challenges).toEqual([
        {
          id: 'c1',
          title: 'Desafio c1',
          prompt: 'Implemente `soma`.',
          template: 'vanilla',
          starterFiles: challenge('c1').files,
          files: challenge('c1').files,
          tests: "test('x', () => {});",
          passed: false,
          passedAt: null,
        },
      ]);
      expect(JSON.stringify(result)).not.toContain('return a + b');
    });

    it('com progresso: devolve o código salvo e o resolvido', async () => {
      progress.find.mockResolvedValue([
        {
          challengeId: 'c1',
          files: { '/exercicio.js': 'meu código' },
          passed: true,
          passedAt: new Date('2026-11-18T12:00:00Z'),
        } as Partial<ChallengeProgress>,
      ]);

      const [item] = (await service.list(USER, 'roadmap-1', 'topic-1'))
        .challenges;

      expect(item.files).toEqual({
        '/exercicio.js': 'meu código',
        // Arquivo do desafio que a pessoa nunca salvou continua presente.
        '/util.js': 'export const x = 1;\n',
      });
      expect(item.passed).toBe(true);
      expect(item.passedAt).toBe('2026-11-18T12:00:00.000Z');
    });

    it('tópico sem ligação com a trilha não tem desafios', async () => {
      topic.trackTopicId = null;

      const result = await service.list(USER, 'roadmap-1', 'topic-1');

      expect(result.challenges).toEqual([]);
      expect(challenges.find).not.toHaveBeenCalled();
    });

    it('propaga a checagem de dono', async () => {
      userRoadmaps.loadOwnedTopic.mockRejectedValue(new ForbiddenException());

      await expect(
        service.list('intruso', 'roadmap-1', 'topic-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('save', () => {
    it('autosave: grava o código num upsert atômico, sem contar execução', async () => {
      const result = await service.save(USER, 'roadmap-1', 'topic-1', 'c1', {
        files: { '/exercicio.js': 'rascunho' },
      });

      const [sql, params] = progress.query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT ("roadmap_topic_id", "challenge_id")');
      expect(params).toEqual([
        USER,
        'topic-1',
        'c1',
        JSON.stringify({ '/exercicio.js': 'rascunho' }),
        false,
        0,
      ]);
      expect(result).toEqual({
        challengeId: 'c1',
        passed: false,
        passedAt: null,
      });
    });

    it('execução que passou: conta a execução e devolve o resolvido', async () => {
      progress.query.mockResolvedValue([
        { passed: true, passed_at: new Date('2026-11-18T12:00:00Z') },
      ]);

      const result = await service.save(USER, 'roadmap-1', 'topic-1', 'c1', {
        files: { '/exercicio.js': 'ok' },
        result: 'pass',
      });

      const params = progress.query.mock.calls[0][1];
      expect(params.slice(4)).toEqual([true, 1]);
      expect(result).toEqual({
        challengeId: 'c1',
        passed: true,
        passedAt: '2026-11-18T12:00:00.000Z',
      });
    });

    it('as regras de "só avança" ficam no SQL', async () => {
      await service.save(USER, 'roadmap-1', 'topic-1', 'c1', {
        files: { '/exercicio.js': 'quebrei' },
        result: 'fail',
      });

      const sql = progress.query.mock.calls[0][0];
      expect(sql).toContain(
        '"passed" = "challenge_progress"."passed" OR EXCLUDED."passed"',
      );
      expect(sql).toContain(
        'COALESCE("challenge_progress"."passed_at", EXCLUDED."passed_at")',
      );
    });

    it('recusa arquivo que não é do desafio (inclusive o de testes)', async () => {
      await expect(
        service.save(USER, 'roadmap-1', 'topic-1', 'c1', {
          files: { '/exercicio.test.js': 'test("fake", () => {})' },
          result: 'pass',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(progress.query).not.toHaveBeenCalled();
    });

    it('recusa arquivo grande demais e lista vazia', async () => {
      await expect(
        service.save(USER, 'roadmap-1', 'topic-1', 'c1', {
          files: { '/exercicio.js': 'x'.repeat(20_001) },
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.save(USER, 'roadmap-1', 'topic-1', 'c1', { files: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('desafio de outro tópico: 404', async () => {
      await expect(
        service.save(USER, 'roadmap-1', 'topic-1', 'outro', {
          files: { '/exercicio.js': 'x' },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  it('solution: código inicial com os arquivos da solução por cima', async () => {
    expect(await service.solution(USER, 'roadmap-1', 'topic-1', 'c1')).toEqual({
      challengeId: 'c1',
      files: {
        '/exercicio.js': 'export function soma(a, b) { return a + b; }\n',
        '/util.js': 'export const x = 1;\n',
      },
    });
  });
});
