import type {
  PersistedModuleDto,
  RoadmapProgressDto,
} from "@estudeai/shared-types";

/**
 * Mesma fórmula do backend (UserRoadmapService.toProgress). Existe aqui por um
 * motivo só: a atualização OTIMISTA precisa recalcular o percentual antes de a
 * resposta chegar. Fora desse caminho, o progresso vem sempre do servidor —
 * esta função não é uma segunda fonte de verdade, é um palpite de um frame.
 */
export function computeProgress(
  modules: PersistedModuleDto[],
): RoadmapProgressDto {
  const topics = modules.flatMap((module) => module.topics);
  const completed = topics.filter((topic) => topic.isCompleted).length;

  return {
    completedTopics: completed,
    totalTopics: topics.length,
    percent:
      topics.length === 0 ? 0 : Math.round((completed / topics.length) * 100),
  };
}
