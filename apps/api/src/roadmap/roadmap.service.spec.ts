import type {
  RoadmapDetailDto,
  RoadmapResponseDto,
  WizardAnswers,
} from '@estudeai/shared-types';
import { RoadmapService } from './roadmap.service';
import type { RoadmapAiService } from './roadmap-ai.service';
import type { RoadmapCacheService } from './roadmap-cache.service';
import type { ResourceDiscoveryService } from './resource-discovery.service';
import type { UserRoadmapService } from './user-roadmap.service';

describe('RoadmapService (orquestração cache + Gemini + persistência)', () => {
  const userId = 'user-1';

  const answers: WizardAnswers = {
    goal: 'mercado',
    weeklyTime: '15h',
    affinity: 'visual',
    learningStyle: 'pratico',
  };

  /** Molde: o que vem do cache ou do Gemini, sem ids. */
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

  /** O mesmo molde já enriquecido com recursos (Etapa 8). */
  const enriched: RoadmapResponseDto = {
    ...roadmap,
    modules: [
      {
        ...roadmap.modules[0],
        topics: [
          {
            title: 'Tópico 1',
            order: 0,
            resources: [
              {
                title: 'MDN',
                url: 'https://developer.mozilla.org/pt-BR/',
                type: 'article',
                source: 'web',
              },
            ],
          },
        ],
      },
    ],
  };

  /** O que o endpoint devolve depois da Etapa 6: já persistido, com ids. */
  const persisted = {
    id: 'roadmap-1',
    targetArea: 'frontend',
    justification: 'justificativa',
    status: 'active',
    createdAt: '2026-01-01T12:00:00.000Z',
    progress: { completedTopics: 0, totalTopics: 1, percent: 0 },
    modules: [],
  } as unknown as RoadmapDetailDto;

  function makeCache(overrides: Partial<RoadmapCacheService> = {}) {
    return {
      find: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn().mockResolvedValue(undefined),
      keyOf: jest.fn().mockReturnValue('mercado/15h/visual/pratico'),
      ...overrides,
    } as unknown as RoadmapCacheService;
  }

  function makeResources() {
    return {
      enrichRoadmap: jest.fn().mockResolvedValue(enriched),
    } as unknown as ResourceDiscoveryService;
  }

  function makeUserRoadmaps() {
    return {
      createFrom: jest.fn().mockResolvedValue(persisted),
    } as unknown as UserRoadmapService;
  }

  it('cache HIT: devolve o cache e NÃO chama o Gemini nem grava', async () => {
    const cache = makeCache({ find: jest.fn().mockResolvedValue(enriched) });
    const aiService = {
      generate: jest.fn(),
    } as unknown as RoadmapAiService;
    const resources = makeResources();
    const userRoadmaps = makeUserRoadmaps();
    const service = new RoadmapService(
      cache,
      aiService,
      resources,
      userRoadmaps,
    );

    const result = await service.generate(userId, answers);

    expect(cache.find).toHaveBeenCalledWith(answers);
    expect(aiService.generate).not.toHaveBeenCalled();
    expect(cache.save).not.toHaveBeenCalled();
    // Etapa 8: template já enriquecido = nenhuma chamada ao YouTube/Gemini.
    expect(resources.enrichRoadmap).not.toHaveBeenCalled();
    // FR-03.2: mesmo no HIT, o conteúdo é copiado para o usuário autenticado.
    expect(userRoadmaps.createFrom).toHaveBeenCalledWith(userId, enriched);
    expect(result).toBe(persisted);
  });

  it('cache MISS: chama o Gemini, descobre recursos, grava no cache e persiste', async () => {
    const cache = makeCache({ find: jest.fn().mockResolvedValue(null) });
    const aiService = {
      generate: jest.fn().mockResolvedValue(roadmap),
    } as unknown as RoadmapAiService;
    const resources = makeResources();
    const userRoadmaps = makeUserRoadmaps();
    const service = new RoadmapService(
      cache,
      aiService,
      resources,
      userRoadmaps,
    );

    const result = await service.generate(userId, answers);

    expect(aiService.generate).toHaveBeenCalledWith(answers);
    expect(resources.enrichRoadmap).toHaveBeenCalledWith(roadmap);
    // O que vai para o cache é a versão COM recursos: um HIT futuro não rebusca.
    expect(cache.save).toHaveBeenCalledWith(answers, enriched);
    expect(userRoadmaps.createFrom).toHaveBeenCalledWith(userId, enriched);
    expect(result).toBe(persisted);
  });

  it('cache HIT em template antigo (sem recursos): enriquece e regrava o template', async () => {
    const cache = makeCache({ find: jest.fn().mockResolvedValue(roadmap) });
    const aiService = {
      generate: jest.fn(),
    } as unknown as RoadmapAiService;
    const resources = makeResources();
    const userRoadmaps = makeUserRoadmaps();
    const service = new RoadmapService(
      cache,
      aiService,
      resources,
      userRoadmaps,
    );

    await service.generate(userId, answers);

    // Backfill preguiçoso: o Gemini de geração continua fora do caminho.
    expect(aiService.generate).not.toHaveBeenCalled();
    expect(resources.enrichRoadmap).toHaveBeenCalledWith(roadmap);
    expect(cache.refresh).toHaveBeenCalledWith(answers, enriched);
    expect(userRoadmaps.createFrom).toHaveBeenCalledWith(userId, enriched);
  });

  it('propaga o erro do Gemini, não grava no cache e não persiste', async () => {
    const boom = new Error('falha no Gemini');
    const cache = makeCache({ find: jest.fn().mockResolvedValue(null) });
    const aiService = {
      generate: jest.fn().mockRejectedValue(boom),
    } as unknown as RoadmapAiService;
    const resources = makeResources();
    const userRoadmaps = makeUserRoadmaps();
    const service = new RoadmapService(
      cache,
      aiService,
      resources,
      userRoadmaps,
    );

    await expect(service.generate(userId, answers)).rejects.toBe(boom);
    expect(cache.save).not.toHaveBeenCalled();
    expect(userRoadmaps.createFrom).not.toHaveBeenCalled();
  });
});
