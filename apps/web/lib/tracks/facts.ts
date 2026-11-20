import type { TargetArea } from "@estudeai/shared-types";

/**
 * Ficha de cada trilha curada COMPLETA, para a landing (redesign v2, Fase 5).
 *
 * O web não tem leitura pública das trilhas (pendência P7), então os números
 * ficam aqui, copiados de `apps/api/src/tracks/content/{area}.json`
 * (`modules.length`, soma de `modules[].topics.length` e um `project` por
 * módulo), conferidos em 20/11/2026 e iguais à tabela de docs/TRILHAS.md §2.
 * Mudou o conteúdo de uma trilha, atualize aqui junto.
 *
 * O roadmap de cada pessoa é um recorte disto: menos tempo por semana e o que
 * ela já sabe tiram paradas. Por isso a landing fala da trilha, não do roadmap.
 */
export const TRACK_FACTS: Record<
  TargetArea,
  { stations: number; stops: number; projects: number }
> = {
  frontend: { stations: 9, stops: 52, projects: 9 },
  backend: { stations: 9, stops: 53, projects: 9 },
  fullstack: { stations: 9, stops: 53, projects: 9 },
  devops: { stations: 9, stops: 52, projects: 9 },
};

/** "9 estações · 52 paradas · 9 projetos". */
export function trackFactsLine(area: TargetArea): string {
  const { stations, stops, projects } = TRACK_FACTS[area];
  return `${stations} estações · ${stops} paradas · ${projects} projetos`;
}
