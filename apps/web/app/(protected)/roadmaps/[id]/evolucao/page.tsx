import { RoadmapProgress } from "@/components/progress/roadmap-progress";

/** Painel de evolução do roadmap (Fase 5). */
export default async function RoadmapProgressPage({
  params,
}: PageProps<"/roadmaps/[id]/evolucao">) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-10 sm:py-14">
      <RoadmapProgress roadmapId={id} />
    </div>
  );
}
