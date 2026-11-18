import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ReviewAnswerResultDto,
  ReviewQueueDto,
} from "@estudeai/shared-types";
import { api } from "@/lib/api/client";

export const reviewKeys = {
  queue: () => ["review", "queue"] as const,
};

/** GET /review/queue — perguntas com revisão vencida (Fase 6). */
export async function getReviewQueue(): Promise<ReviewQueueDto> {
  const { data } = await api.get<ReviewQueueDto>("/review/queue");
  return data;
}

/** POST /review/:cardId/answer — corrige e agenda a próxima revisão. */
export async function answerReview(
  cardId: string,
  chosenIndex: number,
): Promise<ReviewAnswerResultDto> {
  const { data } = await api.post<ReviewAnswerResultDto>(
    `/review/${cardId}/answer`,
    { chosenIndex },
  );
  return data;
}

export function useReviewQueue() {
  return useQuery({
    queryKey: reviewKeys.queue(),
    queryFn: getReviewQueue,
    // A sessão trabalha sobre a fila que abriu; refetch no meio dela trocaria
    // a pergunta que está na tela.
    refetchOnWindowFocus: false,
  });
}

export function useAnswerReview() {
  return useMutation({
    mutationFn: ({ cardId, chosenIndex }: { cardId: string; chosenIndex: number }) =>
      answerReview(cardId, chosenIndex),
  });
}

/** Ao sair da sessão, a fila do dashboard precisa refletir o que foi feito. */
export function useRefreshReviewQueue() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: reviewKeys.queue() });
}

/** "amanhã", "em 3 dias", "em 2 meses" a partir de agora. */
export function relativeDays(iso: string, now: Date = new Date()): string {
  const days = Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days < 30) return `em ${days} dias`;
  const months = Math.round(days / 30);
  return months === 1 ? "em 1 mês" : `em ${months} meses`;
}
