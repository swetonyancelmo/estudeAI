import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AdjustRoadmapResponseDto,
  ResourceProgressDto,
  RoadmapDetailDto,
  RoadmapListItemDto,
  ToggleTopicResponseDto,
  TopicNoteDto,
  UpdateResourceProgressRequestDto,
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
  note: (roadmapId: string, topicId: string) =>
    ["roadmaps", "note", roadmapId, topicId] as const,
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

/** POST /roadmap/:id/adjust — reajuste do roadmap ativo pela IA (FR-04.1). */
export async function adjustRoadmap(
  roadmapId: string,
  adjustmentRequest: string,
): Promise<AdjustRoadmapResponseDto> {
  const { data } = await api.post<AdjustRoadmapResponseDto>(
    `/roadmap/${roadmapId}/adjust`,
    { adjustmentRequest },
  );
  return data;
}

/** DELETE /roadmap/:id — exclui o roadmap do usuário (204, sem corpo). */
export async function deleteRoadmap(roadmapId: string): Promise<void> {
  await api.delete(`/roadmap/${roadmapId}`);
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

/** PATCH .../topics/:topicId/resources/:resourceId — andamento no recurso. */
export async function updateResourceProgress(
  roadmapId: string,
  topicId: string,
  resourceId: string,
  body: UpdateResourceProgressRequestDto,
): Promise<ResourceProgressDto> {
  const { data } = await api.patch<ResourceProgressDto>(
    `/roadmap/${roadmapId}/topics/${topicId}/resources/${resourceId}`,
    body,
  );
  return data;
}

/** GET .../topics/:topicId/note — anotação do tópico. */
export async function getTopicNote(
  roadmapId: string,
  topicId: string,
): Promise<TopicNoteDto> {
  const { data } = await api.get<TopicNoteDto>(
    `/roadmap/${roadmapId}/topics/${topicId}/note`,
  );
  return data;
}

/** PUT .../topics/:topicId/note — salva a anotação inteira. */
export async function saveTopicNote(
  roadmapId: string,
  topicId: string,
  content: string,
): Promise<TopicNoteDto> {
  const { data } = await api.put<TopicNoteDto>(
    `/roadmap/${roadmapId}/topics/${topicId}/note`,
    { content },
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

/**
 * Exclusão. Sem atualização otimista de propósito: apagar é irreversível, então
 * a tela só muda depois que o servidor confirmou. No sucesso, o cache do detalhe
 * é REMOVIDO (não invalidado — refetchar um roadmap apagado daria 404) e a lista
 * é invalidada; quem navega é o chamador, que sabe para onde voltar.
 */
export function useDeleteRoadmap(roadmapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteRoadmap(roadmapId),

    onSuccess: () => {
      queryClient.removeQueries({ queryKey: roadmapKeys.detail(roadmapId) });
      void queryClient.invalidateQueries({ queryKey: roadmapKeys.list() });
    },
  });
}

/**
 * Reajuste (FR-04.1). Ao contrário do toggle, aqui NÃO há atualização otimista:
 * o cliente não tem como adivinhar o que a IA vai devolver, e o servidor pode
 * recusar o ajuste (422) sem alterar nada. O estado só muda com a resposta.
 *
 * A resposta já traz o roadmap final, então gravamos direto no cache do detalhe
 * em vez de refetchar. A lista é invalidada porque o total de tópicos muda e,
 * com ele, o percentual mostrado no card.
 */
export function useAdjustRoadmap(roadmapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adjustmentRequest: string) =>
      adjustRoadmap(roadmapId, adjustmentRequest),

    onSuccess: (response) => {
      queryClient.setQueryData<RoadmapDetailDto>(
        roadmapKeys.detail(roadmapId),
        response.roadmap,
      );
      void queryClient.invalidateQueries({ queryKey: roadmapKeys.list() });
    },
  });
}

/**
 * Andamento num recurso (sala de estudo). Sem palpite otimista: o player manda
 * atualizações periódicas e quem decide o estado final é o servidor (o status
 * só avança). A resposta é gravada direto no cache do detalhe, sem refetch,
 * porque o player chama isto várias vezes por vídeo.
 */
export function useUpdateResourceProgress(roadmapId: string, topicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      resourceId,
      ...body
    }: UpdateResourceProgressRequestDto & { resourceId: string }) =>
      updateResourceProgress(roadmapId, topicId, resourceId, body),

    onSuccess: (result) => {
      queryClient.setQueryData<RoadmapDetailDto>(
        roadmapKeys.detail(roadmapId),
        (previous) =>
          previous && {
            ...previous,
            modules: previous.modules.map((module) => ({
              ...module,
              topics: module.topics.map((topic) =>
                topic.id !== topicId
                  ? topic
                  : {
                      ...topic,
                      resources: topic.resources.map((resource) =>
                        resource.id === result.resourceId
                          ? {
                              ...resource,
                              status: result.status,
                              watchedSeconds: result.watchedSeconds,
                            }
                          : resource,
                      ),
                    },
              ),
            })),
          },
      );
    },
  });
}

export function useTopicNote(roadmapId: string, topicId: string) {
  return useQuery({
    queryKey: roadmapKeys.note(roadmapId, topicId),
    queryFn: () => getTopicNote(roadmapId, topicId),
    // O editor é a fonte do texto enquanto a tela está aberta; refetch ao
    // voltar para a aba sobrescreveria o que a pessoa acabou de digitar.
    refetchOnWindowFocus: false,
  });
}

export function useSaveTopicNote(roadmapId: string, topicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => saveTopicNote(roadmapId, topicId, content),
    onSuccess: (note) => {
      queryClient.setQueryData(roadmapKeys.note(roadmapId, topicId), note);
    },
  });
}
