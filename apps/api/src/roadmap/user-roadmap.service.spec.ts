import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { RoadmapResponseDto } from '@estudeai/shared-types';
import { UserRoadmapService } from './user-roadmap.service';
import { Roadmap } from './entities/roadmap.entity';
import { Topic } from './entities/topic.entity';

const OWNER = 'user-owner';
const INTRUDER = 'user-intruder';

/** Molde vindo do cache/Gemini — sem ids, sem progresso (RoadmapResponseDto). */
function makeTemplatePayload(): RoadmapResponseDto {
  return {
    targetArea: 'frontend',
    justification: 'Você prefere interface e tem 15h por semana.',
    modules: [
      {
        title: 'Fundamentos',
        description: 'HTML, CSS e JS',
        order: 0,
        topics: [
          { title: 'HTML semântico', order: 0, estimatedHours: 4 },
          { title: 'CSS layout', order: 1 },
        ],
      },
    ],
  };
}

/** Roadmap já persistido, como o findOne com relations devolveria. */
function makePersistedRoadmap(overrides: Partial<Roadmap> = {}): Roadmap {
  return {
    id: 'roadmap-1',
    userId: OWNER,
    targetArea: 'frontend',
    justification: 'justificativa',
    status: 'active',
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    modules: [
      {
        id: 'module-1',
        roadmapId: 'roadmap-1',
        title: 'Fundamentos',
        description: 'HTML, CSS e JS',
        order: 0,
        topics: [
          {
            id: 'topic-1',
            moduleId: 'module-1',
            title: 'HTML semântico',
            isCompleted: true,
            order: 0,
            estimatedHours: 4,
          },
          {
            id: 'topic-2',
            moduleId: 'module-1',
            title: 'CSS layout',
            isCompleted: false,
            order: 1,
            estimatedHours: null,
          },
          {
            id: 'topic-3',
            moduleId: 'module-1',
            title: 'JS básico',
            isCompleted: false,
            order: 2,
            estimatedHours: null,
          },
        ],
      },
    ],
    ...overrides,
  } as Roadmap;
}

describe('UserRoadmapService (FR-03.2 / FR-03.3 — Etapa 6)', () => {
  let service: UserRoadmapService;
  let roadmaps: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let topics: { save: jest.Mock };

  beforeEach(async () => {
    roadmaps = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: Record<string, unknown>) =>
        Promise.resolve({ ...value, id: 'roadmap-1' }),
      ),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    topics = { save: jest.fn((value: unknown) => Promise.resolve(value)) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserRoadmapService,
        { provide: getRepositoryToken(Roadmap), useValue: roadmaps },
        { provide: getRepositoryToken(Topic), useValue: topics },
      ],
    }).compile();

    service = moduleRef.get(UserRoadmapService);
  });

  describe('createFrom — persistência vinculada ao usuário', () => {
    it('grava com o userId autenticado, status active e tópicos não concluídos', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      const detail = await service.createFrom(OWNER, makeTemplatePayload());

      const created = roadmaps.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(created.userId).toBe(OWNER);
      expect(created.status).toBe('active');
      expect(created.targetArea).toBe('frontend');

      const modules = created.modules as Array<Record<string, unknown>>;
      const savedTopics = modules.flatMap(
        (module) => module.topics as Array<Record<string, unknown>>,
      );
      expect(savedTopics).toHaveLength(2);
      expect(savedTopics.every((topic) => topic.isCompleted === false)).toBe(
        true,
      );
      // estimatedHours ausente no molde vira null (coluna nullable), não undefined.
      expect(savedTopics[1].estimatedHours).toBeNull();

      expect(roadmaps.save).toHaveBeenCalled();
      // Devolve o roadmap persistido, com ids reais — não o molde solto.
      expect(detail.id).toBe('roadmap-1');
      expect(detail.modules[0].topics[0].id).toBe('topic-1');
    });

    it('NÃO referencia nem muta o payload do template compartilhado', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());
      const payload = makeTemplatePayload();
      const snapshot = structuredClone(payload);

      await service.createFrom(OWNER, payload);

      // O payload pode ser o jsonb de um RoadmapTemplate compartilhado: sai intacto.
      expect(payload).toEqual(snapshot);

      // E a árvore gravada é cópia — nenhum objeto em comum com o molde, então
      // marcar progresso depois não tem como alcançar o cache.
      const created = roadmaps.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const modules = created.modules as Array<Record<string, unknown>>;
      expect(modules[0]).not.toBe(payload.modules[0]);
      expect((modules[0].topics as unknown[])[0]).not.toBe(
        payload.modules[0].topics[0],
      );
    });
  });

  describe('ownership — roadmap de outro usuário', () => {
    it('findDetail devolve 403 (Forbidden)', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      await expect(service.findDetail(INTRUDER, 'roadmap-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('toggleTopic devolve 403 e não grava nada', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      await expect(
        service.toggleTopic(INTRUDER, 'roadmap-1', 'topic-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(topics.save).not.toHaveBeenCalled();
    });

    it('roadmap inexistente devolve 404 (não 403 — nada a proteger)', async () => {
      roadmaps.findOne.mockResolvedValue(null);

      await expect(service.findDetail(OWNER, 'roadmap-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('remove devolve 403 e não apaga nada', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      await expect(service.remove(INTRUDER, 'roadmap-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(roadmaps.delete).not.toHaveBeenCalled();
    });

    it('topicId que não pertence ao roadmap devolve 404', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      await expect(
        service.toggleTopic(OWNER, 'roadmap-1', 'topic-de-outro-roadmap'),
      ).rejects.toThrow(NotFoundException);
      expect(topics.save).not.toHaveBeenCalled();
    });
  });

  describe('toggleTopic e progresso (FR-03.3)', () => {
    it('inverte o tópico do dono e devolve o progresso recalculado', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      // topic-2 estava false → vira true. 2 de 3 concluídos = 67%.
      const result = await service.toggleTopic(OWNER, 'roadmap-1', 'topic-2');

      expect(result).toEqual({
        topicId: 'topic-2',
        isCompleted: true,
        progress: { completedTopics: 2, totalTopics: 3, percent: 67 },
      });
      expect(topics.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'topic-2', isCompleted: true }),
      );
    });

    it('desmarca um tópico já concluído', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      const result = await service.toggleTopic(OWNER, 'roadmap-1', 'topic-1');

      expect(result.isCompleted).toBe(false);
      expect(result.progress).toEqual({
        completedTopics: 0,
        totalTopics: 3,
        percent: 0,
      });
    });

    it('findDetail arredonda o percentual (1 de 3 = 33%)', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      const detail = await service.findDetail(OWNER, 'roadmap-1');

      expect(detail.progress).toEqual({
        completedTopics: 1,
        totalTopics: 3,
        percent: 33,
      });
      expect(detail.createdAt).toBe('2026-01-01T12:00:00.000Z');
    });

    it('roadmap sem tópicos é 0%, não NaN', async () => {
      roadmaps.findOne.mockResolvedValue(
        makePersistedRoadmap({ modules: [] }),
      );

      const detail = await service.findDetail(OWNER, 'roadmap-1');

      expect(detail.progress).toEqual({
        completedTopics: 0,
        totalTopics: 0,
        percent: 0,
      });
    });
  });

  describe('remove', () => {
    it('apaga só a linha do roadmap — módulos e tópicos vão pelo cascade', async () => {
      roadmaps.findOne.mockResolvedValue(makePersistedRoadmap());

      await service.remove(OWNER, 'roadmap-1');

      expect(roadmaps.delete).toHaveBeenCalledWith({ id: 'roadmap-1' });
      // Nada de apagar tópico a tópico na aplicação: a regra é do banco.
      expect(topics.save).not.toHaveBeenCalled();
    });

    it('roadmap inexistente devolve 404 (não 204 silencioso)', async () => {
      roadmaps.findOne.mockResolvedValue(null);

      await expect(service.remove(OWNER, 'roadmap-x')).rejects.toThrow(
        NotFoundException,
      );
      expect(roadmaps.delete).not.toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('filtra pelo usuário autenticado e converte os COUNT crus em progresso', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            id: 'roadmap-1',
            targetArea: 'frontend',
            status: 'active',
            createdAt: new Date('2026-01-01T12:00:00.000Z'),
            // O driver do pg devolve COUNT (bigint) como string.
            totalTopics: '8',
            completedTopics: '2',
          },
        ]),
      };
      roadmaps.createQueryBuilder.mockReturnValue(qb);

      const list = await service.listForUser(OWNER);

      expect(qb.where).toHaveBeenCalledWith('r.userId = :userId', {
        userId: OWNER,
      });
      expect(list).toEqual([
        {
          id: 'roadmap-1',
          targetArea: 'frontend',
          status: 'active',
          createdAt: '2026-01-01T12:00:00.000Z',
          progress: { completedTopics: 2, totalTopics: 8, percent: 25 },
        },
      ]);
    });
  });
});
