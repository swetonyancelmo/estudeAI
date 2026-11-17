import { TopicStudy } from "@/components/study/topic-study";

/**
 * Sala de estudo de um tópico. Mesmo padrão do detalhe do roadmap: o server
 * component só resolve os params e o client component faz as queries
 * autenticadas (o access token vive em memória no browser).
 */
export default async function TopicStudyPage({
  params,
}: PageProps<"/roadmaps/[id]/topics/[topicId]">) {
  const { id, topicId } = await params;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-10 sm:py-14">
      <TopicStudy roadmapId={id} topicId={topicId} />
    </div>
  );
}
