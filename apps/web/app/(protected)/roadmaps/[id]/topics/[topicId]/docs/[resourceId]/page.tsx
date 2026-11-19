import { DocReader } from "@/components/study/doc-reader";

/** Leitor de documentação (Fase 2). Mesmo padrão da sala de estudo. */
export default async function DocReaderPage({
  params,
}: PageProps<"/roadmaps/[id]/topics/[topicId]/docs/[resourceId]">) {
  const { id, topicId, resourceId } = await params;

  return (
    <div className="flex w-full flex-1 flex-col">
      <DocReader roadmapId={id} topicId={topicId} resourceId={resourceId} />
    </div>
  );
}
