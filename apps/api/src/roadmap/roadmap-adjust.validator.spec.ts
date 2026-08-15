import type {
  AdjustedRoadmapDto,
  RoadmapDetailDto,
} from '@estudeai/shared-types';
import {
  AdjustmentIntegrityError,
  buildAdjustmentPlan,
} from './roadmap-adjust.validator';

/**
 * Roadmap persistido de referência:
 *  - módulo A (m-1): t-1 CONCLUÍDO, t-2 pendente
 *  - módulo B (m-2): t-3 pendente, t-4 pendente  (nenhum concluído)
 */
function currentRoadmap(): RoadmapDetailDto {
  return {
    id: 'roadmap-1',
    targetArea: 'frontend',
    justification: 'justificativa original',
    status: 'active',
    createdAt: '2026-01-01T12:00:00.000Z',
    progress: { completedTopics: 1, totalTopics: 4, percent: 25 },
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
        ],
      },
      {
        id: 'm-2',
        title: 'React',
        description: 'Componentes e estado',
        order: 1,
        topics: [
          {
            id: 't-3',
            title: 'JSX',
            order: 0,
            isCompleted: false,
            resources: [],
          },
          {
            id: 't-4',
            title: 'Hooks',
            order: 1,
            isCompleted: false,
            resources: [],
          },
        ],
      },
    ],
  };
}

/** Resposta da IA que respeita todas as regras — base para as variações. */
function validAdjustment(): AdjustedRoadmapDto {
  return {
    adjustmentSummary: 'Enxuguei o que faltava; seu progresso foi preservado.',
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
      {
        id: 'm-2',
        title: 'React',
        description: 'Componentes e estado',
        topics: [{ id: 't-3', title: 'JSX', isCompleted: false }],
      },
    ],
  };
}

/** Roda o validador e devolve a causa técnica registrada na exceção. */
function violationOf(ai: AdjustedRoadmapDto): string {
  try {
    buildAdjustmentPlan(currentRoadmap(), ai);
  } catch (error) {
    expect(error).toBeInstanceOf(AdjustmentIntegrityError);
    return (error as AdjustmentIntegrityError).violation;
  }
  throw new Error('esperava rejeição, mas o ajuste passou');
}

describe('buildAdjustmentPlan (FR-04.2 — integridade do progresso)', () => {
  describe('rejeita a resposta da IA quando ela mexe no que foi concluído', () => {
    it('tópico concluído com o título reescrito', () => {
      const ai = validAdjustment();
      ai.modules[0].topics[0].title = 'HTML semântico (revisado)';

      expect(violationOf(ai)).toContain('título alterado');
    });

    it('tópico concluído voltando desmarcado', () => {
      const ai = validAdjustment();
      ai.modules[0].topics[0].isCompleted = false;

      expect(violationOf(ai)).toContain('desmarcado');
    });

    it('tópico concluído omitido da resposta', () => {
      const ai = validAdjustment();
      ai.modules[0].topics = ai.modules[0].topics.filter(
        (topic) => topic.id !== 't-1',
      );

      expect(violationOf(ai)).toContain('sumiu da resposta');
    });

    it('tópico concluído movido para outro módulo', () => {
      const ai = validAdjustment();
      const completed = ai.modules[0].topics.shift()!;
      ai.modules[1].topics.push(completed);

      expect(violationOf(ai)).toContain('movido para outro módulo');
    });

    it('tópico concluído com a estimativa alterada', () => {
      const ai = validAdjustment();
      ai.modules[0].topics[0].estimatedHours = 12;

      expect(violationOf(ai)).toContain('estimativa alterada');
    });

    it('módulo com concluídos renomeado', () => {
      const ai = validAdjustment();
      ai.modules[0].title = 'Fundamentos acelerados';

      expect(violationOf(ai)).toContain('título/descrição alterados');
    });

    it('módulo com concluídos omitido da resposta', () => {
      const ai = validAdjustment();
      ai.modules = ai.modules.filter((module) => module.id !== 'm-1');

      expect(violationOf(ai)).toContain('sumiu da resposta');
    });

    it('tópico pendente que a IA tenta marcar como concluído', () => {
      const ai = validAdjustment();
      ai.modules[0].topics[1].isCompleted = true;

      expect(violationOf(ai)).toContain('voltou marcado como concluído');
    });

    it('tópico novo já nascendo concluído', () => {
      const ai = validAdjustment();
      ai.modules[1].topics.push({ title: 'Suspense', isCompleted: true });

      expect(violationOf(ai)).toContain('já marcado como concluído');
    });

    it('id de tópico duplicado', () => {
      const ai = validAdjustment();
      ai.modules[1].topics.push({
        id: 't-3',
        title: 'JSX de novo',
        isCompleted: false,
      });

      expect(violationOf(ai)).toContain('mais de uma vez');
    });

    it('id de tópico que não pertence a este roadmap (alucinação)', () => {
      const ai = validAdjustment();
      ai.modules[1].topics.push({
        id: 't-de-outro-usuario',
        title: 'Roubado',
        isCompleted: false,
      });

      expect(violationOf(ai)).toContain('não pertence a este roadmap');
    });

    it('id de módulo que não pertence a este roadmap', () => {
      const ai = validAdjustment();
      ai.modules[1].id = 'm-fantasma';

      expect(violationOf(ai)).toContain('não pertence a este roadmap');
    });

    it('roadmap devolvido sem módulos', () => {
      const ai = validAdjustment();
      ai.modules = [];

      expect(violationOf(ai)).toContain('sem módulos');
    });
  });

  describe('aceita e planeja o reajuste legítimo', () => {
    it('preserva o concluído, atualiza pendentes e remove o que a IA cortou', () => {
      const plan = buildAdjustmentPlan(currentRoadmap(), validAdjustment());

      // Concluído: entra só como posição, nunca como conteúdo.
      expect(plan.completedTopicOrders).toEqual([{ id: 't-1', order: 0 }]);
      expect(plan.changes.preservedTopicIds).toEqual(['t-1']);
      expect(plan.topicUpdates.map((topic) => topic.id)).toEqual([
        't-2',
        't-3',
      ]);
      expect(plan.topicIdsToDelete).toEqual(['t-4']);
      expect(plan.changes.removedTopicCount).toBe(1);

      // "Ajustado" é só o que realmente mudou: t-2 teve o título reescrito,
      // t-3 só mudou de posição.
      expect(plan.changes.updatedTopicIds).toEqual(['t-2']);
    });

    it('cria módulo e tópico novos com ids próprios', () => {
      const ai = validAdjustment();
      ai.modules.push({
        title: 'Testes',
        description: 'Vitest e Testing Library',
        topics: [{ title: 'Testes de componente', isCompleted: false }],
      });

      const plan = buildAdjustmentPlan(currentRoadmap(), ai);

      expect(plan.moduleInserts).toHaveLength(1);
      expect(plan.topicInserts).toHaveLength(1);
      // O id do tópico novo aponta para o módulo novo criado nesta mesma passada.
      expect(plan.topicInserts[0].moduleId).toBe(plan.moduleInserts[0].id);
      expect(plan.changes.addedModuleIds).toEqual([plan.moduleInserts[0].id]);
      expect(plan.changes.addedTopicIds).toEqual([plan.topicInserts[0].id]);
    });

    it('remove módulo sem nenhum concluído e não duplica o delete dos tópicos dele', () => {
      const ai = validAdjustment();
      ai.modules = ai.modules.filter((module) => module.id !== 'm-2');

      const plan = buildAdjustmentPlan(currentRoadmap(), ai);

      expect(plan.moduleIdsToDelete).toEqual(['m-2']);
      expect(plan.changes.removedModuleCount).toBe(1);
      // t-3 e t-4 morrem pelo ON DELETE CASCADE do módulo…
      expect(plan.topicIdsToDelete).toEqual([]);
      // …mas continuam contando como removidos para o usuário.
      expect(plan.changes.removedTopicCount).toBe(2);
    });

    it('reordena a posição do concluído quando um pendente entra antes dele', () => {
      const ai = validAdjustment();
      ai.modules[0].topics.unshift({
        title: 'Revisão rápida de HTML',
        isCompleted: false,
      });

      const plan = buildAdjustmentPlan(currentRoadmap(), ai);

      // Reordenar não é "alterar": o concluído aceita a nova posição.
      expect(plan.completedTopicOrders).toEqual([{ id: 't-1', order: 1 }]);
    });

    it('permite renomear módulo que NÃO tem concluídos', () => {
      const ai = validAdjustment();
      ai.modules[1].title = 'React essencial';
      ai.modules[1].description = 'Só o necessário para esta semana';

      const plan = buildAdjustmentPlan(currentRoadmap(), ai);

      expect(plan.moduleUpdates).toContainEqual({
        id: 'm-2',
        title: 'React essencial',
        description: 'Só o necessário para esta semana',
        order: 1,
      });
    });
  });

  describe('quais tópicos precisam de recursos novos (Etapa 8)', () => {
    it('marca os NOVOS e os pendentes RENOMEADOS — e mais ninguém', () => {
      const ai = validAdjustment();
      ai.modules[1].topics.push({
        title: 'Context API',
        isCompleted: false,
      });

      const plan = buildAdjustmentPlan(currentRoadmap(), ai);

      // t-2 foi renomeado no molde válido; t-3 só mudou de posição.
      expect(plan.topicsNeedingResources).toEqual([
        { id: 't-2', title: 'CSS layout essencial' },
        { id: plan.topicInserts[0].id, title: 'Context API' },
      ]);
    });

    it('nunca inclui tópico concluído nem tópico apenas reordenado', () => {
      const ai = validAdjustment();
      // Devolve t-2 com o título original: nada mudou de assunto no roadmap.
      ai.modules[0].topics[1].title = 'CSS layout';

      const plan = buildAdjustmentPlan(currentRoadmap(), ai);

      expect(plan.topicsNeedingResources).toEqual([]);
      // ...ainda que o concluído tenha mudado de posição.
      expect(plan.completedTopicOrders).toHaveLength(1);
    });

    it('ignorar mudança só de estimativa evita gastar cota do YouTube à toa', () => {
      const ai = validAdjustment();
      ai.modules[1].topics[0].estimatedHours = 12;

      const plan = buildAdjustmentPlan(currentRoadmap(), ai);

      expect(plan.changes.updatedTopicIds).toContain('t-3');
      expect(
        plan.topicsNeedingResources.some((topic) => topic.id === 't-3'),
      ).toBe(false);
    });
  });
});
