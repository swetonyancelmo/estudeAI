import type {
  PersistedModuleDto,
  PersistedTopicDto,
} from "@estudeai/shared-types";

/**
 * Marco alcançado ao concluir uma parada (D12), para o diálogo de resumo.
 * - "module": a estação ficou com todas as paradas de estudo concluídas. O
 *   checkpoint (projeto) pode ainda faltar: aí ele é a próxima ação.
 * - "roadmap": a rota inteira ficou concluída.
 */
export type CompletionMilestone =
  | {
      kind: "module";
      module: PersistedModuleDto;
      moduleIndex: number;
      /** Checkpoint da estação ainda por fazer, se houver. */
      pendingProject: PersistedTopicDto | null;
      /** Primeira parada da próxima estação, se houver. */
      nextModuleStart: PersistedTopicDto | null;
      nextModule: PersistedModuleDto | null;
    }
  | { kind: "roadmap" };

function byOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * O que concluir `topicId` alcança, olhando o roadmap ANTES da conclusão
 * (a tela chama isto no clique, antes da mutation otimista). Nulo quando a
 * parada já estava concluída (desmarcar não tem marco) ou nada fecha.
 *
 * A estação "fecha" duas vezes no máximo, e as duas contam: ao concluir a
 * última parada de estudo (sobra o checkpoint) e ao concluir o checkpoint.
 */
export function completionMilestone(
  modules: PersistedModuleDto[],
  topicId: string,
): CompletionMilestone | null {
  const ordered = byOrder(modules).map((item) => ({
    ...item,
    topics: byOrder(item.topics),
  }));
  const moduleIndex = ordered.findIndex((item) =>
    item.topics.some((topic) => topic.id === topicId),
  );
  if (moduleIndex === -1) return null;
  const station = ordered[moduleIndex];
  const target = station.topics.find((topic) => topic.id === topicId)!;
  if (target.isCompleted) return null;

  const doneAfter = (topic: PersistedTopicDto) =>
    topic.isCompleted || topic.id === topicId;

  if (ordered.every((item) => item.topics.every(doneAfter))) {
    return { kind: "roadmap" };
  }

  const studyStops = station.topics.filter((topic) => topic.kind !== "project");
  const projects = station.topics.filter((topic) => topic.kind === "project");
  const studyDone = studyStops.every(doneAfter);
  const moduleDone = station.topics.every(doneAfter);
  // Fecha ao terminar as paradas de estudo (o alvo é uma delas) ou ao
  // terminar a estação inteira (o alvo é o checkpoint).
  const closes =
    (studyDone && target.kind !== "project" && studyStops.length > 0) ||
    (moduleDone && target.kind === "project");
  if (!closes) return null;

  const nextModule = ordered[moduleIndex + 1] ?? null;
  return {
    kind: "module",
    module: station,
    moduleIndex,
    pendingProject: projects.find((topic) => !doneAfter(topic)) ?? null,
    nextModule,
    nextModuleStart: nextModule?.topics[0] ?? null,
  };
}
