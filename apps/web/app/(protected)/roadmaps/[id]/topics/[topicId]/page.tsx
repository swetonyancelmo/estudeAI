import { TopicStudy } from "@/components/study/topic-study";

/**
 * Sala de estudo de um tópico. Mesmo padrão do detalhe do roadmap: o server
 * component só resolve os params e o client component faz as queries
 * autenticadas (o access token vive em memória no browser). A largura e as
 * margens ficam com a sala: o palco do vídeo vai de borda a borda no celular.
 */
export default async function TopicStudyPage({
  params,
}: PageProps<"/roadmaps/[id]/topics/[topicId]">) {
  const { id, topicId } = await params;

  return (
    <div className="flex w-full flex-1 flex-col">
      <TopicStudy roadmapId={id} topicId={topicId} />
    </div>
  );
}
