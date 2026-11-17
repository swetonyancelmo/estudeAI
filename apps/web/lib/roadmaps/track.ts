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
