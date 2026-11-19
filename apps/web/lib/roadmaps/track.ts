import type {
  PersistedModuleDto,
  ResourceDto,
  TargetArea,
} from "@estudeai/shared-types";

/**
 * Classe que injeta a cor da trilha em `--line` (ver globals.css). Tudo que
 * desenha linha/estação dentro do elemento herda: `bg-line`, `border-line`…
 */
export const TRACK_CLASS: Record<TargetArea, string> = {
  frontend: "track-frontend",
  backend: "track-backend",
  fullstack: "track-fullstack",
  devops: "track-devops",
};

export type ModuleState = "done" | "current" | "upcoming";

/**
 * Estado de cada módulo na linha: concluído (todos os tópicos marcados), atual
 * (o primeiro ainda incompleto) ou futuro. Módulo sem tópicos conta como
 * concluído — não há nada a fazer nele.
 */
export function moduleStates(modules: PersistedModuleDto[]): ModuleState[] {
  let currentFound = false;
  return modules.map((module) => {
    if (module.topics.every((topic) => topic.isCompleted)) return "done";
    if (!currentFound) {
      currentFound = true;
      return "current";
    }
    return "upcoming";
  });
}

/** Soma das horas estimadas do que ainda falta (tópicos sem estimativa = 0). */
export function remainingHours(modules: PersistedModuleDto[]): number {
  return modules
    .flatMap((module) => module.topics)
    .filter((topic) => !topic.isCompleted)
    .reduce((total, topic) => total + (topic.estimatedHours ?? 0), 0);
}

/**
 * Semanas até o fim, no ritmo que a pessoa declarou no wizard
 * (docs/TRILHAS.md §5). Arredonda para cima: 1h pendente ainda é uma semana em
 * que há o que estudar. `null` quando não há o que estimar — roadmap anterior
 * às trilhas (ritmo desconhecido) ou nada pendente.
 *
 * Calculado no cliente, a partir das mesmas horas do cabeçalho, para descer
 * junto com cada tópico marcado.
 */
export function estimatedWeeks(
  hoursLeft: number,
  weeklyHours: number | null,
): number | null {
  if (!weeklyHours || hoursLeft <= 0) return null;
  return Math.ceil(hoursLeft / weeklyHours);
}

/** Horas estimadas de uma estação inteira. */
export function moduleHours(module: PersistedModuleDto): number {
  return module.topics.reduce(
    (total, topic) => total + (topic.estimatedHours ?? 0),
    0,
  );
}

export interface RoadmapFacts {
  stations: number;
  /** Paradas de estudo (`kind: "topic"`), sem contar os checkpoints. */
  stops: number;
  checkpoints: number;
  totalHours: number;
}

/**
 * Ficha do roadmap (D1), toda calculada do próprio `RoadmapDetailDto`: não há
 * nível nem pré-requisitos no contrato ainda (pendência P5).
 */
export function roadmapFacts(modules: PersistedModuleDto[]): RoadmapFacts {
  const topics = modules.flatMap((module) => module.topics);
  return {
    stations: modules.length,
    stops: topics.filter((topic) => topic.kind !== "project").length,
    checkpoints: topics.filter((topic) => topic.kind === "project").length,
    totalHours: modules.reduce((total, module) => total + moduleHours(module), 0),
  };
}

export interface ResourceCounts {
  videos: number;
  docs: number;
  readings: number;
}

/**
 * Recursos de uma parada por tipo (D18), na mesma divisão da sala de estudo:
 * vídeos do YouTube, documentação oficial e o resto como leitura.
 */
export function resourceCounts(resources: ResourceDto[]): ResourceCounts {
  let videos = 0;
  let docs = 0;
  let readings = 0;
  for (const resource of resources) {
    if (resource.source === "docs") docs += 1;
    else if (resource.source === "youtube" && resource.type !== "article") videos += 1;
    else readings += 1;
  }
  return { videos, docs, readings };
}
