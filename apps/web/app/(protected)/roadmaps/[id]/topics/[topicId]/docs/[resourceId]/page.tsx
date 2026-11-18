import { DocReader } from "@/components/study/doc-reader";

/** Leitor de documentação (Fase 2). Mesmo padrão da sala de estudo. */
export default async function DocReaderPage({
  params,
}: PageProps<"/roadmaps/[id]/topics/[topicId]/docs/[resourceId]">) {
  const { id, topicId, resourceId } = await params;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-10 sm:py-14">
      <DocReader roadmapId={id} topicId={topicId} resourceId={resourceId} />
    </div>
  );
}
