import { randomUUID } from 'node:crypto';
import { UnprocessableEntityException } from '@nestjs/common';
import type {
  AdjustedRoadmapDto,
  AdjustmentChangesDto,
  PersistedTopicDto,
  RoadmapDetailDto,
} from '@estudeai/shared-types';

/** Mensagem mostrada ao usuário quando a IA desrespeita o progresso (422). */
const INTEGRITY_MESSAGE =
  'A IA devolveu um ajuste que alteraria tópicos já concluídos. Nada foi alterado — tente reformular o pedido, por exemplo "tenho menos tempo esta semana".';

/**
 * 422 com dois públicos: `message` (o que o usuário lê) e `violation` (a causa
 * técnica, só para log). Separar os dois evita a tentação de expor detalhe
 * interno na resposta ou de logar uma mensagem genérica inútil.
 */
export class AdjustmentIntegrityError extends UnprocessableEntityException {
  constructor(readonly violation: string) {
    super(INTEGRITY_MESSAGE);
  }
}

/** Linha de módulo a gravar. `order` é sempre a posição no array da IA. */
export interface PlannedModule {
  id: string;
  title: string;
  description: string;
  order: number;
}

/** Linha de tópico a gravar (inserção ou atualização de pendente). */
export interface PlannedTopic {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  estimatedHours: number | null;
}

/**
 * Plano de escrita já resolvido: o service de persistência não decide nada,
 * só executa. Tudo que envolve julgamento ("isto pode ser alterado?") acontece
 * aqui, numa função pura e testável sem banco.
 */
export interface AdjustmentPlan {
  moduleInserts: PlannedModule[];
  moduleUpdates: PlannedModule[];
  moduleIdsToDelete: string[];
  topicInserts: PlannedTopic[];
  /** Só tópicos PENDENTES: conteúdo pode mudar. */
  topicUpdates: PlannedTopic[];
  /** Tópicos CONCLUÍDOS: apenas a posição muda, nunca o conteúdo. */
  completedTopicOrders: { id: string; order: number }[];
  topicIdsToDelete: string[];
  changes: AdjustmentChangesDto;
}

/**
 * FR-04.2 — confere a resposta da IA contra o estado REAL do banco e devolve o
 * plano de escrita. Esta é a fronteira onde a resposta do Gemini deixa de ser
 * "sugestão" e vira "dado": nada é persistido sem passar por aqui.
 *
 * Rejeita (422) se a IA:
 *  1. repetiu um id (módulo ou tópico);
 *  2. citou um id que não existe neste roadmap (alucinação / id de outro user);
 *  3. omitiu um tópico concluído;
 *  4. alterou título, estimativa, flag ou módulo de um tópico concluído;
 *  5. marcou como concluído um tópico que não estava (só o usuário marca);
 *  6. omitiu, renomeou ou redescreveu um módulo que contém concluídos;
 *  7. devolveu um roadmap vazio.
 *
 * Defesa em profundidade: mesmo quando aprova, o plano copia título, estimativa
 * e flag dos tópicos concluídos DO BANCO — nunca da resposta da IA. Da resposta
 * aproveita-se apenas a POSIÇÃO deles, porque reordenar é inerente a
 * "reorganizar o que falta". Ou seja: um furo futuro nas regras acima ainda não
 * daria à IA como reescrever o conteúdo de um tópico concluído.
 */
export function buildAdjustmentPlan(
  current: RoadmapDetailDto,
  ai: AdjustedRoadmapDto,
): AdjustmentPlan {
  const currentModules = new Map(
    current.modules.map((module) => [module.id, module]),
  );
  const currentTopics = new Map<
    string,
    { topic: PersistedTopicDto; moduleId: string }
  >();
  const modulesWithCompleted = new Set<string>();

  for (const module of current.modules) {
    for (const topic of module.topics) {
      currentTopics.set(topic.id, { topic, moduleId: module.id });
      if (topic.isCompleted) {
        modulesWithCompleted.add(module.id);
      }
    }
  }

  const plan: AdjustmentPlan = {
    moduleInserts: [],
    moduleUpdates: [],
    moduleIdsToDelete: [],
    topicInserts: [],
    topicUpdates: [],
    completedTopicOrders: [],
    topicIdsToDelete: [],
    changes: {
      addedTopicIds: [],
      updatedTopicIds: [],
      preservedTopicIds: [],
      removedTopicCount: 0,
      addedModuleIds: [],
      removedModuleCount: 0,
    },
  };

  const seenModuleIds = new Set<string>();
  const seenTopicIds = new Set<string>();

  if (ai.modules.length === 0) {
    throw new AdjustmentIntegrityError('A IA devolveu um roadmap sem módulos.');
  }

  ai.modules.forEach((aiModule, moduleOrder) => {
    const existing = aiModule.id ? currentModules.get(aiModule.id) : undefined;

    if (aiModule.id) {
      if (!existing) {
        throw new AdjustmentIntegrityError(
          `Módulo ${aiModule.id} não pertence a este roadmap.`,
        );
      }
      if (seenModuleIds.has(aiModule.id)) {
        throw new AdjustmentIntegrityError(
          `Módulo ${aiModule.id} apareceu mais de uma vez.`,
        );
      }
      seenModuleIds.add(aiModule.id);

      // Módulo que abriga progresso é congelado: só os pendentes dele mudam.
      if (modulesWithCompleted.has(aiModule.id)) {
        if (
          aiModule.title !== existing.title ||
          aiModule.description !== existing.description
        ) {
          throw new AdjustmentIntegrityError(
            `Módulo ${aiModule.id} contém tópicos concluídos e teve título/descrição alterados.`,
          );
        }
      }
    }

    const moduleId = aiModule.id ?? randomUUID();
    const plannedModule: PlannedModule = {
      id: moduleId,
      title: aiModule.title,
      description: aiModule.description,
      order: moduleOrder,
    };

    if (aiModule.id) {
      plan.moduleUpdates.push(plannedModule);
    } else {
      plan.moduleInserts.push(plannedModule);
      plan.changes.addedModuleIds.push(moduleId);
    }

    aiModule.topics.forEach((aiTopic, topicOrder) => {
      // --- tópico novo -------------------------------------------------
      if (!aiTopic.id) {
        if (aiTopic.isCompleted) {
          throw new AdjustmentIntegrityError(
            'A IA criou um tópico já marcado como concluído.',
          );
        }
        const id = randomUUID();
        plan.topicInserts.push({
          id,
          moduleId,
          title: aiTopic.title,
          order: topicOrder,
          estimatedHours: aiTopic.estimatedHours ?? null,
        });
        plan.changes.addedTopicIds.push(id);
        return;
      }

      // --- tópico existente --------------------------------------------
      const found = currentTopics.get(aiTopic.id);
      if (!found) {
        throw new AdjustmentIntegrityError(
          `Tópico ${aiTopic.id} não pertence a este roadmap.`,
        );
      }
      if (seenTopicIds.has(aiTopic.id)) {
        throw new AdjustmentIntegrityError(
          `Tópico ${aiTopic.id} apareceu mais de uma vez.`,
        );
      }
      seenTopicIds.add(aiTopic.id);

      const { topic, moduleId: originalModuleId } = found;

      if (topic.isCompleted) {
        if (moduleId !== originalModuleId) {
          throw new AdjustmentIntegrityError(
            `Tópico concluído ${topic.id} foi movido para outro módulo.`,
          );
        }
        if (aiTopic.title !== topic.title) {
          throw new AdjustmentIntegrityError(
            `Tópico concluído ${topic.id} teve o título alterado.`,
          );
        }
        if (!aiTopic.isCompleted) {
          throw new AdjustmentIntegrityError(
            `Tópico concluído ${topic.id} voltou desmarcado.`,
          );
        }
        if (
          (aiTopic.estimatedHours ?? null) !== (topic.estimatedHours ?? null)
        ) {
          throw new AdjustmentIntegrityError(
            `Tópico concluído ${topic.id} teve a estimativa alterada.`,
          );
        }

        // Nada do conteúdo é copiado da IA — só a nova posição.
        plan.completedTopicOrders.push({ id: topic.id, order: topicOrder });
        plan.changes.preservedTopicIds.push(topic.id);
        return;
      }

      // Pendente: a IA reorganiza, mas não marca progresso por ninguém.
      if (aiTopic.isCompleted) {
        throw new AdjustmentIntegrityError(
          `Tópico pendente ${topic.id} voltou marcado como concluído.`,
        );
      }

      const estimatedHours = aiTopic.estimatedHours ?? null;
      plan.topicUpdates.push({
        id: topic.id,
        moduleId,
        title: aiTopic.title,
        order: topicOrder,
        estimatedHours,
      });

      // "Ajustado" é só o que realmente mudou — reordenar sozinho não vira badge.
      if (
        aiTopic.title !== topic.title ||
        estimatedHours !== (topic.estimatedHours ?? null) ||
        moduleId !== originalModuleId
      ) {
        plan.changes.updatedTopicIds.push(topic.id);
      }
    });
  });

  // --- o que a IA não devolveu ------------------------------------------
  for (const module of current.modules) {
    if (seenModuleIds.has(module.id)) {
      continue;
    }
    if (modulesWithCompleted.has(module.id)) {
      throw new AdjustmentIntegrityError(
        `Módulo ${module.id} contém tópicos concluídos e sumiu da resposta.`,
      );
    }
    plan.moduleIdsToDelete.push(module.id);
  }

  for (const [topicId, { topic, moduleId }] of currentTopics) {
    if (seenTopicIds.has(topicId)) {
      continue;
    }
    if (topic.isCompleted) {
      throw new AdjustmentIntegrityError(
        `Tópico concluído ${topicId} sumiu da resposta.`,
      );
    }
    // Tópico de módulo removido morre pelo ON DELETE CASCADE — não repetimos
    // o delete, mas ele conta como removido para o usuário.
    if (!plan.moduleIdsToDelete.includes(moduleId)) {
      plan.topicIdsToDelete.push(topicId);
    }
    plan.changes.removedTopicCount += 1;
  }

  plan.changes.removedModuleCount = plan.moduleIdsToDelete.length;

  const totalTopics =
    plan.topicInserts.length +
    plan.topicUpdates.length +
    plan.completedTopicOrders.length;
  if (totalTopics === 0) {
    throw new AdjustmentIntegrityError(
      'A IA devolveu um roadmap sem nenhum tópico.',
    );
  }

  return plan;
}
