import type { RoadmapStatus, TargetArea } from "@estudeai/shared-types";

/** Rótulos de exibição — lista e detalhe precisam falar a mesma língua. */
export const AREA_LABELS: Record<TargetArea, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Fullstack",
};

export const STATUS_LABELS: Record<RoadmapStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

/** Data curta em pt-BR ("14 ago 2026") a partir do ISO devolvido pela API. */
export function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
