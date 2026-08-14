import { useMutation } from "@tanstack/react-query";
import type { RoadmapDetailDto, WizardAnswers } from "@estudeai/shared-types";
import { api } from "@/lib/api/client";

/**
 * POST /roadmap/generate — o `api` client injeta o JWT e trata 401→refresh.
 * Desde a Etapa 6 a resposta é o roadmap JÁ PERSISTIDO no usuário
 * (`RoadmapDetailDto`, com ids reais), não mais a forma solta gerada pela IA.
 */
export async function generateRoadmap(
  answers: WizardAnswers,
): Promise<RoadmapDetailDto> {
  const { data } = await api.post<RoadmapDetailDto>(
    "/roadmap/generate",
    answers,
  );
  return data;
}

/** Envio do wizard via TanStack Query; a `data` da mutation é o roadmap criado. */
export function useGenerateRoadmap() {
  return useMutation<RoadmapDetailDto, unknown, WizardAnswers>({
    mutationFn: generateRoadmap,
  });
}
