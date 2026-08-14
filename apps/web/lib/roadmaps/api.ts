import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  RoadmapDetailDto,
  RoadmapListItemDto,
  ToggleTopicResponseDto,
} from "@estudeai/shared-types";
import { api } from "@/lib/api/client";
import { computeProgress } from "./progress";

/**
 * Chaves centralizadas — evita invalidar a chave errada em outro arquivo.
 * `list` e `detail` são ramos irmãos de propósito: invalidar a lista não
 * derruba o cache de todos os detalhes por prefixo.
 */
export const roadmapKeys = {
  all: ["roadmaps"] as const,
  list: () => ["roadmaps", "list"] as const,
  detail: (id: string) => ["roadmaps", "detail", id] as const,
};

/** GET /roadmap — "Meus Roadmaps" (FR-03.2). */
export async function listRoadmaps(): Promise<RoadmapListItemDto[]> {
  const { data } = await api.get<RoadmapListItemDto[]>("/roadmap");
  return data;
}

/** GET /roadmap/:id — detalhe completo com módulos e tópicos. */
export async function getRoadmap(id: string): Promise<RoadmapDetailDto> {
  const { data } = await api.get<RoadmapDetailDto>(`/roadmap/${id}`);
  return data;
}

/** PATCH /roadmap/:id/topics/:topicId — alterna a conclusão (FR-03.3). */
export async function toggleTopic(
  roadmapId: string,
  topicId: string,
): Promise<ToggleTopicResponseDto> {
  const { data } = await api.patch<ToggleTopicResponseDto>(
    `/roadmap/${roadmapId}/topics/${topicId}`,
  );
  return data;
}

export function useRoadmaps() {
  return useQuery({ queryKey: roadmapKeys.list(), queryFn: listRoadmaps });
}

export function useRoadmap(id: string) {
  return useQuery({
    queryKey: roadmapKeys.detail(id),
    queryFn: () => getRoadmap(id),
  });
}

/**
 * Toggle com atualização OTIMISTA: o checkbox e a barra reagem no mesmo frame,
 * sem esperar a rede.
 *  - onMutate: cancela refetches em voo (senão uma resposta antiga sobrescreve
 *    o palpite), guarda o snapshot e aplica a inversão no cache.
 *  - onError: devolve o snapshot — rollback completo, incluindo o percentual.
 *  - onSettled: revalida detalhe e lista, então o servidor tem a última palavra.
 */
export function useToggleTopic(roadmapId: string) {
  const queryClient = useQueryClient();
  const detailKey = roadmapKeys.detail(roadmapId);

  return useMutation({
    mutationFn: (topicId: string) => toggleTopic(roadmapId, topicId),

    onMutate: async (topicId: string) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<RoadmapDetailDto>(detailKey);

      if (previous) {
        const modules = previous.modules.map((module) => ({
          ...module,
          topics: module.topics.map((topic) =>
            topic.id === topicId
              ? { ...topic, isCompleted: !topic.isCompleted }
              : topic,
          ),
        }));

        queryClient.setQueryData<RoadmapDetailDto>(detailKey, {
          ...previous,
          modules,
          progress: computeProgress(modules),
        });
      }

      return { previous };
    },

    onError: (_error, _topicId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
      // O % dos cards da lista depende dos mesmos tópicos.
      void queryClient.invalidateQueries({ queryKey: roadmapKeys.list() });
    },
  });
}
