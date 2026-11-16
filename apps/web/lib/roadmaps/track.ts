import type { PersistedModuleDto, TargetArea } from "@estudeai/shared-types";

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
