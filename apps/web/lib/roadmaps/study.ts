import type {
  PersistedModuleDto,
  PersistedTopicDto,
} from "@estudeai/shared-types";

export interface TopicLocation {
  topic: PersistedTopicDto;
  module: PersistedModuleDto;
  /** Posição do módulo no roadmap (0-based), já na ordem de exibição. */
  moduleIndex: number;
  /** Paradas da estação atual, na ordem (lista lateral da sala de estudo). */
  moduleTopics: PersistedTopicDto[];
  previous: PersistedTopicDto | null;
  next: PersistedTopicDto | null;
  /** Primeira parada da estação anterior e da próxima, para pular de estação. */
  previousModuleStart: PersistedTopicDto | null;
  nextModuleStart: PersistedTopicDto | null;
}

function byOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * Acha o tópico no roadmap e os vizinhos na ordem de estudo (módulo a módulo,
 * tópico a tópico), atravessando a fronteira dos módulos. Nulo quando o tópico
 * não está neste roadmap (link velho depois de um reajuste, por exemplo).
 */
export function locateTopic(
  modules: PersistedModuleDto[],
  topicId: string,
): TopicLocation | null {
  const orderedModules = byOrder(modules).map((module) => ({
    module,
    topics: byOrder(module.topics),
  }));
  const ordered = orderedModules.flatMap(({ module, topics }, moduleIndex) =>
    topics.map((topic) => ({ topic, module, moduleIndex })),
  );

  const index = ordered.findIndex((entry) => entry.topic.id === topicId);
  if (index === -1) return null;
  const { moduleIndex } = ordered[index];

  return {
    ...ordered[index],
    moduleTopics: orderedModules[moduleIndex].topics,
    previous: ordered[index - 1]?.topic ?? null,
    next: ordered[index + 1]?.topic ?? null,
    previousModuleStart: orderedModules[moduleIndex - 1]?.topics[0] ?? null,
    nextModuleStart: orderedModules[moduleIndex + 1]?.topics[0] ?? null,
  };
}

/**
 * Próxima parada da rota: a primeira não concluída na ordem de estudo (o
 * botão "Continuar" do detalhe). Nula quando tudo está concluído.
 */
export function firstPendingTopic(
  modules: PersistedModuleDto[],
): PersistedTopicDto | null {
  for (const station of byOrder(modules)) {
    const pending = byOrder(station.topics).find((topic) => !topic.isCompleted);
    if (pending) return pending;
  }
  return null;
}

/**
 * Estado de uma parada para o marcador (BASE §3.4). "Em andamento" não é um
 * estado salvo: vem dos recursos, quando algum já foi aberto ou assistido.
 */
export type StopState = "done" | "in_progress" | "not_started";

export function stopState(topic: PersistedTopicDto): StopState {
  if (topic.isCompleted) return "done";
  return topic.resources.some((resource) => resource.status !== "not_started")
    ? "in_progress"
    : "not_started";
}

/** Rota da sala de estudo de um tópico. */
export function studyHref(roadmapId: string, topicId: string): string {
  return `/roadmaps/${roadmapId}/topics/${topicId}`;
}

/** Rota do leitor de documentação de um recurso do tópico. */
export function readerHref(
  roadmapId: string,
  topicId: string,
  resourceId: string,
): string {
  return `${studyHref(roadmapId, topicId)}/docs/${resourceId}`;
}
