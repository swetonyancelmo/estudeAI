import type { RoadmapResponseDto, WizardAnswers } from '@estudeai/shared-types';
import { RoadmapService } from './roadmap.service';
import type { RoadmapAiService } from './roadmap-ai.service';
import type { RoadmapCacheService } from './roadmap-cache.service';

describe('RoadmapService (orquestração cache + Gemini — Etapa 5)', () => {
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

  function makeCache(overrides: Partial<RoadmapCacheService> = {}) {
    return {
      find: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      keyOf: jest.fn().mockReturnValue('mercado/15h/visual/pratico'),
      ...overrides,
    } as unknown as RoadmapCacheService;
  }

  it('cache HIT: devolve o cache e NÃO chama o Gemini nem grava', async () => {
    const cache = makeCache({ find: jest.fn().mockResolvedValue(roadmap) });
    const aiService = {
      generate: jest.fn(),
    } as unknown as RoadmapAiService;
    const service = new RoadmapService(cache, aiService);

    const result = await service.generate(answers);

    expect(cache.find).toHaveBeenCalledWith(answers);
    expect(aiService.generate).not.toHaveBeenCalled();
    expect(cache.save).not.toHaveBeenCalled();
    expect(result).toBe(roadmap);
  });

  it('cache MISS: chama o Gemini e grava o resultado no cache', async () => {
    const cache = makeCache({ find: jest.fn().mockResolvedValue(null) });
    const aiService = {
      generate: jest.fn().mockResolvedValue(roadmap),
    } as unknown as RoadmapAiService;
    const service = new RoadmapService(cache, aiService);

    const result = await service.generate(answers);

    expect(aiService.generate).toHaveBeenCalledWith(answers);
    expect(cache.save).toHaveBeenCalledWith(answers, roadmap);
    expect(result).toBe(roadmap);
  });

  it('propaga o erro do Gemini e não grava no cache (miss + falha)', async () => {
    const boom = new Error('falha no Gemini');
    const cache = makeCache({ find: jest.fn().mockResolvedValue(null) });
    const aiService = {
      generate: jest.fn().mockRejectedValue(boom),
    } as unknown as RoadmapAiService;
    const service = new RoadmapService(cache, aiService);

    await expect(service.generate(answers)).rejects.toBe(boom);
    expect(cache.save).not.toHaveBeenCalled();
  });
});
