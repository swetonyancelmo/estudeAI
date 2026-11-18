import { useQuery } from "@tanstack/react-query";
import type { MdnArticleDto } from "@estudeai/shared-types";
import { api } from "@/lib/api/client";

export const docsKeys = {
  mdn: (url: string) => ["docs", "mdn", url] as const,
};

/** GET /docs/mdn — artigo da MDN pronto para o leitor (Fase 2). */
export async function getMdnArticle(url: string): Promise<MdnArticleDto> {
  const { data } = await api.get<MdnArticleDto>("/docs/mdn", {
    params: { url },
  });
  return data;
}

export function useMdnArticle(url: string | null) {
  return useQuery({
    queryKey: docsKeys.mdn(url ?? ""),
    queryFn: () => getMdnArticle(url!),
    enabled: url !== null,
    // A API já guarda em cache por uma semana; no cliente, uma hora basta para
    // ir e voltar entre o tópico e a leitura sem refazer a requisição.
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
