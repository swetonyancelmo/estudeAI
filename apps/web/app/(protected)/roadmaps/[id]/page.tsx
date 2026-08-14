import { RoadmapDetail } from "@/components/roadmap/roadmap-detail";

/**
 * Detalhe do roadmap do usuário. Server component fino: só resolve o `id` da
 * rota (params é Promise no App Router) e entrega ao componente client, que faz
 * a query autenticada — o access token vive em memória no browser, então o
 * fetch precisa acontecer lá.
 */
export default async function RoadmapDetailPage({
  params,
}: PageProps<"/roadmaps/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-[880px] flex-1 px-6 py-11 sm:px-10">
      <RoadmapDetail roadmapId={id} />
    </div>
  );
}
