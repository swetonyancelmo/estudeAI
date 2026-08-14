import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { RoadmapResponseDto, WizardAnswers } from '@estudeai/shared-types';
import { RoadmapCacheService } from './roadmap-cache.service';
import { RoadmapTemplate } from './entities/roadmap-template.entity';

describe('RoadmapCacheService (FR-02.2 — cache de match exato)', () => {
  const answers: WizardAnswers = {
    goal: 'mercado',
    weeklyTime: '15h',
    affinity: 'visual',
    learningStyle: 'pratico',
  };

  const roadmap: RoadmapResponseDto = {
    targetArea: 'frontend',
    justification: 'justificativa',
    modules: [
      {
        title: 'Módulo 1',
        description: 'desc',
        order: 0,
        topics: [{ title: 'Tópico 1', order: 0 }],
      },
    ],
  };

  let service: RoadmapCacheService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'tpl-1', ...v })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RoadmapCacheService,
        { provide: getRepositoryToken(RoadmapTemplate), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(RoadmapCacheService);
  });

  describe('find', () => {
    it('cache HIT: devolve o payload do template dos critérios exatos', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', payload: roadmap });

      const result = await service.find(answers);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          goal: 'mercado',
          weeklyTime: '15h',
          affinity: 'visual',
          learningStyle: 'pratico',
        },
      });
      expect(result).toBe(roadmap);
    });

    it('cache MISS: devolve null quando não há template', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.find(answers);

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('grava um novo template com os 4 critérios + payload (após um miss)', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.find(answers)).toBeNull();

      await service.save(answers, roadmap);

      expect(repo.create).toHaveBeenCalledWith({
        goal: 'mercado',
        weeklyTime: '15h',
        affinity: 'visual',
        learningStyle: 'pratico',
        payload: roadmap,
      });
      expect(repo.save).toHaveBeenCalled();
    });

    it('tolera corrida: unique_violation (23505) não propaga erro', async () => {
      repo.save.mockRejectedValue({ code: '23505' });

      await expect(service.save(answers, roadmap)).resolves.toBeUndefined();
    });

    it('propaga erros que não sejam de unicidade', async () => {
      const boom = { code: '08006', message: 'connection failure' };
      repo.save.mockRejectedValue(boom);

      await expect(service.save(answers, roadmap)).rejects.toBe(boom);
    });
  });
});
