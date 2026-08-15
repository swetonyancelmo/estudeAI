import { UnprocessableEntityException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type {
  AdjustedRoadmapDto,
  RoadmapDetailDto,
} from '@estudeai/shared-types';

// Mesmo mock do SDK usado no spec da Etapa 4: nada bate na API real, e
// `generateContent` é o "Gemini" que controlamos por teste.
const generateContent = jest.fn();
jest.mock('@google/genai', () => ({
  ...jest.requireActual('@google/genai'),
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}));

import { RoadmapAiService } from './roadmap-ai.service';
import { RoadmapAdjustService } from './roadmap-adjust.service';
import type { ResourceDiscoveryService } from './resource-discovery.service';
import type { UserRoadmapService } from './user-roadmap.service';

const OWNER = 'user-owner';
const ROADMAP_ID = 'roadmap-1';

/** Roadmap do usuário com 1 tópico concluído (t-1) e 2 pendentes. */
function currentRoadmap(): RoadmapDetailDto {
  return {
    id: ROADMAP_ID,
    targetArea: 'frontend',
    justification: 'justificativa original',
    status: 'active',
    createdAt: '2026-01-01T12:00:00.000Z',
    progress: { completedTopics: 1, totalTopics: 3, percent: 33 },
    modules: [
      {
        id: 'm-1',
        title: 'Fundamentos',
        description: 'HTML, CSS e JS',
        order: 0,
        topics: [
          {
            id: 't-1',
            title: 'HTML semântico',
            order: 0,
            isCompleted: true,
            estimatedHours: 4,
            resources: [],
          },
          {
            id: 't-2',
            title: 'CSS layout',
            order: 1,
            isCompleted: false,
            resources: [],
          },
          {
            id: 't-3',
            title: 'JS básico',
            order: 2,
            isCompleted: false,
            resources: [],
          },
        ],
      },
    ],
  };
}

function geminiReturns(adjusted: AdjustedRoadmapDto): void {
  generateContent.mockResolvedValue({ text: JSON.stringify(adjusted) });
}

describe('RoadmapAdjustService (FR-04 — Etapa 7)', () => {
  let service: RoadmapAdjustService;
  let userRoadmaps: {
    findDetail: jest.Mock;
    applyAdjustment: jest.Mock;
    replaceTopicResources: jest.Mock;
  };
  let resources: { discoverForTopics: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    const config = {
      get: jest.fn((key: string) =>
        key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
      ),
    } as unknown as ConfigService;

    userRoadmaps = {
      findDetail: jest.fn().mockResolvedValue(currentRoadmap()),
      // Etapa 8: applyAdjustment devolve a resposta MAIS os tópicos que
      // precisam de recursos novos (recado interno, fora do contrato).
      applyAdjustment: jest.fn().mockResolvedValue({
        response: {
          roadmap: currentRoadmap(),
          adjustmentSummary: 'ok',
          changes: {
            addedTopicIds: [],
            updatedTopicIds: [],
            preservedTopicIds: ['t-1'],
            removedTopicCount: 0,
            addedModuleIds: [],
            removedModuleCount: 0,
          },
        },
        topicsNeedingResources: [],
      }),
      replaceTopicResources: jest.fn().mockResolvedValue(undefined),
    };

    resources = {
      discoverForTopics: jest.fn().mockResolvedValue(new Map()),
    };

    service = new RoadmapAdjustService(
      new RoadmapAiService(config),
      resources as unknown as ResourceDiscoveryService,
      userRoadmaps as unknown as UserRoadmapService,
    );
  });

  describe('a IA tenta trapacear o progresso do usuário', () => {
    it('rejeita (422) e NÃO persiste quando a IA reescreve um tópico concluído', async () => {
      geminiReturns({
        adjustmentSummary: 'Reorganizei tudo para você ir mais rápido.',
        modules: [
          {
            id: 'm-1',
            title: 'Fundamentos',
            description: 'HTML, CSS e JS',
            topics: [
              {
                id: 't-1',
                // Mesmo id, conteúdo trocado: é exatamente o que não pode passar.
                title: 'HTML semântico — versão acelerada',
                isCompleted: true,
                estimatedHours: 4,
              },
              { id: 't-2', title: 'CSS layout', isCompleted: false },
            ],
          },
        ],
      });

      await expect(
        service.adjust(OWNER, ROADMAP_ID, 'quero acelerar o módulo atual'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(userRoadmaps.applyAdjustment).not.toHaveBeenCalled();
    });

    it('rejeita e NÃO persiste quando a IA desmarca um tópico concluído', async () => {
      geminiReturns({
        adjustmentSummary: 'Recomecei do zero para caber na sua semana.',
        modules: [
          {
            id: 'm-1',
            title: 'Fundamentos',
            description: 'HTML, CSS e JS',
            topics: [
              {
                id: 't-1',
                title: 'HTML semântico',
                isCompleted: false,
                estimatedHours: 4,
              },
            ],
          },
        ],
      });

      await expect(
        service.adjust(OWNER, ROADMAP_ID, 'tenho menos tempo esta semana'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(userRoadmaps.applyAdjustment).not.toHaveBeenCalled();
    });

    it('rejeita e NÃO persiste quando a IA simplesmente apaga o tópico concluído', async () => {
      geminiReturns({
        adjustmentSummary: 'Deixei só o essencial.',
        modules: [
          {
            id: 'm-1',
            title: 'Fundamentos',
            description: 'HTML, CSS e JS',
            topics: [{ id: 't-2', title: 'CSS layout', isCompleted: false }],
          },
        ],
      });

      await expect(
        service.adjust(OWNER, ROADMAP_ID, 'tenho menos tempo esta semana'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(userRoadmaps.applyAdjustment).not.toHaveBeenCalled();
    });

    it('rejeita e NÃO persiste quando a IA marca um pendente como concluído', async () => {
      geminiReturns({
        adjustmentSummary: 'Considerei o CSS como já dominado.',
        modules: [
          {
            id: 'm-1',
            title: 'Fundamentos',
            description: 'HTML, CSS e JS',
            topics: [
              {
                id: 't-1',
                title: 'HTML semântico',
                isCompleted: true,
                estimatedHours: 4,
              },
              { id: 't-2', title: 'CSS layout', isCompleted: true },
            ],
          },
        ],
      });

      await expect(
        service.adjust(OWNER, ROADMAP_ID, 'já sei CSS, pode pular'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(userRoadmaps.applyAdjustment).not.toHaveBeenCalled();
    });
  });

  describe('caminho feliz', () => {
    it('persiste quando a IA respeita o concluído e só mexe no que falta', async () => {
      const adjusted: AdjustedRoadmapDto = {
        adjustmentSummary:
          'Reduzi o que faltava para caber na semana; seu progresso foi mantido.',
        modules: [
          {
            id: 'm-1',
            title: 'Fundamentos',
            description: 'HTML, CSS e JS',
            topics: [
              {
                id: 't-1',
                title: 'HTML semântico',
                isCompleted: true,
                estimatedHours: 4,
              },
              { id: 't-2', title: 'CSS layout essencial', isCompleted: false },
            ],
          },
        ],
      };
      geminiReturns(adjusted);

      const response = await service.adjust(
        OWNER,
        ROADMAP_ID,
        'tenho menos tempo esta semana',
      );

      expect(userRoadmaps.applyAdjustment).toHaveBeenCalledWith(
        OWNER,
        ROADMAP_ID,
        expect.objectContaining({
          adjustmentSummary: adjusted.adjustmentSummary,
        }),
      );
      expect(response.changes.preservedTopicIds).toEqual(['t-1']);
    });

    it('manda para a IA o roadmap atual com ids e o pedido do usuário delimitado', async () => {
      geminiReturns({
        adjustmentSummary: 'ok',
        modules: [
          {
            id: 'm-1',
            title: 'Fundamentos',
            description: 'HTML, CSS e JS',
            topics: [
              {
                id: 't-1',
                title: 'HTML semântico',
                isCompleted: true,
                estimatedHours: 4,
              },
            ],
          },
        ],
      });

      await service.adjust(OWNER, ROADMAP_ID, 'tenho menos tempo esta semana');

      const call = generateContent.mock.calls[0][0] as {
        contents: string;
        config: { systemInstruction: string };
      };
      expect(call.contents).toContain('t-1');
      expect(call.contents).toContain('isCompleted');
      // O texto do usuário vai isolado como DADO, não como instrução.
      expect(call.contents).toContain(
        '<pedido>tenho menos tempo esta semana</pedido>',
      );
      // Prompt do reajuste, não o da geração.
      expect(call.config.systemInstruction).toContain('JÁ EM ANDAMENTO');
    });
  });

  describe('recursos de estudo pós-reajuste (Etapa 8)', () => {
    /** Reajuste válido mínimo — o que interessa aqui é o pós-commit. */
    function adjustValidly() {
      geminiReturns({
        adjustmentSummary: 'ok',
        modules: [
          {
            id: 'm-1',
            title: 'Fundamentos',
            description: 'HTML, CSS e JS',
            topics: [
              {
                id: 't-1',
                title: 'HTML semântico',
                isCompleted: true,
                estimatedHours: 4,
              },
            ],
          },
        ],
      });
      return service.adjust(OWNER, ROADMAP_ID, 'tenho menos tempo');
    }

    it('não busca recursos quando nada novo nem renomeado saiu do reajuste', async () => {
      await adjustValidly();

      // Só concluídos/preservados: rebuscar aqui seria queimar cota à toa.
      expect(resources.discoverForTopics).not.toHaveBeenCalled();
      expect(userRoadmaps.replaceTopicResources).not.toHaveBeenCalled();
    });

    it('busca só os tópicos novos/renomeados e relê o detalhe já com os links', async () => {
      const pending = [{ id: 't-9', title: 'Flexbox na prática' }];
      userRoadmaps.applyAdjustment.mockResolvedValue({
        response: {
          roadmap: currentRoadmap(),
          adjustmentSummary: 'ok',
          changes: {
            addedTopicIds: ['t-9'],
            updatedTopicIds: [],
            preservedTopicIds: ['t-1'],
            removedTopicCount: 0,
            addedModuleIds: [],
            removedModuleCount: 0,
          },
        },
        topicsNeedingResources: pending,
      });
      const discovered = new Map([
        [
          't-9',
          [
            {
              title: 'Flexbox',
              url: 'https://exemplo.dev/flexbox',
              type: 'article' as const,
              source: 'web' as const,
            },
          ],
        ],
      ]);
      resources.discoverForTopics.mockResolvedValue(discovered);
      const relido = currentRoadmap();
      userRoadmaps.findDetail.mockResolvedValueOnce(currentRoadmap());
      userRoadmaps.findDetail.mockResolvedValueOnce(relido);

      const response = await adjustValidly();

      expect(resources.discoverForTopics).toHaveBeenCalledWith(pending);
      expect(userRoadmaps.replaceTopicResources).toHaveBeenCalledWith(
        ['t-9'],
        discovered,
      );
      // A resposta sai com o estado relido, para o frontend não precisar refetch.
      expect(response.roadmap).toBe(relido);
    });

    it('devolve o reajuste normalmente quando a busca de recursos falha', async () => {
      userRoadmaps.applyAdjustment.mockResolvedValue({
        response: {
          roadmap: currentRoadmap(),
          adjustmentSummary: 'ok',
          changes: {
            addedTopicIds: ['t-9'],
            updatedTopicIds: [],
            preservedTopicIds: ['t-1'],
            removedTopicCount: 0,
            addedModuleIds: [],
            removedModuleCount: 0,
          },
        },
        topicsNeedingResources: [{ id: 't-9', title: 'Flexbox na prática' }],
      });
      resources.discoverForTopics.mockRejectedValue(new Error('quota'));

      // O reajuste JÁ foi gravado: falhar em achar links não pode virar erro.
      const response = await adjustValidly();

      expect(response.changes.addedTopicIds).toEqual(['t-9']);
    });
  });

  describe('ownership', () => {
    it('não chama a IA quando o roadmap é de outro usuário', async () => {
      userRoadmaps.findDetail.mockRejectedValue(new ForbiddenException());

      await expect(
        service.adjust('outro-usuario', ROADMAP_ID, 'tenho menos tempo'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(generateContent).not.toHaveBeenCalled();
      expect(userRoadmaps.applyAdjustment).not.toHaveBeenCalled();
    });
  });
});
