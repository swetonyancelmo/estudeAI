import type {
  PersistedModuleDto,
  PersistedTopicDto,
} from "@estudeai/shared-types";

export interface TopicLocation {
  topic: PersistedTopicDto;
  module: PersistedModuleDto;
  /** Posição do módulo no roadmap (0-based), já na ordem de exibição. */
  moduleIndex: number;
  previous: PersistedTopicDto | null;
  next: PersistedTopicDto | null;
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
  const ordered = [...modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((module, moduleIndex) =>
      [...module.topics]
        .sort((a, b) => a.order - b.order)
        .map((topic) => ({ topic, module, moduleIndex })),
    );

  const index = ordered.findIndex((entry) => entry.topic.id === topicId);
  if (index === -1) return null;

  return {
    ...ordered[index],
    previous: ordered[index - 1]?.topic ?? null,
    next: ordered[index + 1]?.topic ?? null,
  };
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
