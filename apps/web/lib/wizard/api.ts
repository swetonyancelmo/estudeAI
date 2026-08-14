import { useMutation } from "@tanstack/react-query";
import type { RoadmapResponseDto, WizardAnswers } from "@estudeai/shared-types";
import { api } from "@/lib/api/client";

/** POST /roadmap/generate — o `api` client injeta o JWT e trata 401→refresh. */
export async function generateRoadmap(
  answers: WizardAnswers,
): Promise<RoadmapResponseDto> {
  const { data } = await api.post<RoadmapResponseDto>(
    "/roadmap/generate",
    answers,
  );
  return data;
}

/** Envio do wizard via TanStack Query; a `data` da mutation é o roadmap. */
export function useGenerateRoadmap() {
  return useMutation<RoadmapResponseDto, unknown, WizardAnswers>({
    mutationFn: generateRoadmap,
  });
}
