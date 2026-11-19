"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, ListTree } from "lucide-react";
import { toast } from "sonner";
import type {
  MdnArticleDto,
  ResourceDto,
  RoadmapDetailDto,
} from "@estudeai/shared-types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMdnArticle } from "@/lib/docs/api";
import { isMdnDocUrl } from "@/lib/docs/sites";
import {
  useRoadmap,
  useToggleTopic,
  useUpdateResourceProgress,
} from "@/lib/roadmaps/api";
import { AREA_LABELS } from "@/lib/roadmaps/labels";
import {
  locateTopic,
  studyHref,
  type TopicLocation,
} from "@/lib/roadmaps/study";
import { TRACK_CLASS } from "@/lib/roadmaps/track";
import { BOTTOM_BAR_PADDING, StudyBottomBar } from "./study-bottom-bar";
import { StudyBreadcrumb } from "./study-breadcrumb";
import { useStudyTime } from "./use-study-time";

const LICENSE_URL = "https://creativecommons.org/licenses/by-sa/2.5/";

/**
 * Leitor de documentação da MDN dentro do estudeAI (Fase 2).
 *
 * O HTML de cada seção chega da API já sanitizado por lista de permissões
 * (`apps/api/src/docs/mdn-sanitize.ts`), com links absolutos e sem script,
 * iframe ou atributo de evento — por isso pode ir para `dangerouslySetInnerHTML`.
 *
 * O conteúdo é da MDN (CC-BY-SA 2.5): a atribuição a "Mozilla Contributors" e
 * o link para a página original aparecem sempre, no fim do artigo.
 *
 * Redesign v2: mesmo breadcrumb e mesma barra fixa da sala de estudo, com
 * "Voltar à aula" no lugar do Anterior, e o sumário das seções ao lado (num
 * Sheet no celular).
 */
export function DocReader({
  roadmapId,
  topicId,
  resourceId,
}: {
  roadmapId: string;
  topicId: string;
  resourceId: string;
}) {
  const roadmap = useRoadmap(roadmapId);

  if (roadmap.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-10">
        <ReaderSkeleton />
      </div>
    );
  }
  if (roadmap.isError) {
    return <ReaderMissing roadmapId={roadmapId} topicId={topicId} />;
  }

  const location = locateTopic(roadmap.data.modules, topicId);
  const resource = location?.topic.resources.find(
    (candidate) => candidate.id === resourceId,
  );
  if (!location || !resource || !isMdnDocUrl(resource.url)) {
    return <ReaderMissing roadmapId={roadmapId} topicId={topicId} />;
  }

  return <Reader roadmap={roadmap.data} location={location} resource={resource} />;
}

function Reader({
  roadmap,
  location,
  resource,
}: {
  roadmap: RoadmapDetailDto;
  location: TopicLocation;
  resource: ResourceDto;
}) {
  const { topic, module, moduleIndex, next } = location;
  const topicId = topic.id;
  const article = useMdnArticle(resource.url);
  const progress = useUpdateResourceProgress(roadmap.id, topicId);
  const toggle = useToggleTopic(roadmap.id);
  // Fase 5: ler a documentação também conta como tempo de estudo.
  useStudyTime(roadmap.id);
  const backHref = studyHref(roadmap.id, topicId);

  // Abrir a leitura conta como "em andamento", uma vez por visita.
  const opened = useRef(false);
  const { mutate } = progress;
  useEffect(() => {
    if (opened.current || !article.data) return;
    opened.current = true;
    if (resource.status === "not_started") {
      mutate({ resourceId: resource.id, status: "in_progress" });
    }
  }, [article.data, mutate, resource.id, resource.status]);

  function saveError(retry: () => void) {
    toast.error("Não foi possível salvar seu progresso.", {
      id: "progress-error",
      action: { label: "Tentar de novo", onClick: retry },
    });
  }

  function markRead() {
    progress.mutate(
      { resourceId: resource.id, status: "completed" },
      { onError: () => saveError(markRead) },
    );
  }

  function toggleTopic() {
    toggle.mutate(topicId, { onError: () => saveError(toggleTopic) });
  }

  const toc = article.data ? tableOfContents(article.data) : [];

  return (
    <div
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 pt-4 duration-300 animate-in fade-in-0 sm:px-10",
        BOTTOM_BAR_PADDING,
      )}
    >
      <StudyBreadcrumb
        trackHref={`/roadmaps/${roadmap.id}`}
        trackLabel={`Trilha ${AREA_LABELS[roadmap.targetArea]}`}
        station={`Estação ${moduleIndex + 1}: ${module.title}`}
        items={[
          { label: topic.title, href: backHref },
          { label: article.data?.title ?? resource.title },
        ]}
        actions={toc.length > 0 && <TocSheet entries={toc} />}
      />

      <div
        className={cn(
          "grid gap-10",
          toc.length > 0 && "lg:grid-cols-[minmax(0,1fr)_14rem]",
        )}
      >
        <div className="flex max-w-3xl min-w-0 flex-col gap-8">
          {article.isPending ? (
            <ReaderSkeleton />
          ) : article.isError ? (
            <ArticleError error={article.error} url={resource.url} />
          ) : (
            <ArticleBody article={article.data} />
          )}

          <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
            {resource.status === "completed" ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Check className="text-line size-4" strokeWidth={3} />
                Leitura concluída
              </p>
            ) : (
              <Button variant="outline" onClick={markRead}>
                <Check className="size-4" />
                Marcar como lido
              </Button>
            )}
          </div>
        </div>

        {toc.length > 0 && (
          <aside className="hidden lg:block">
            <nav aria-label="Nesta página" className="sticky top-4 flex flex-col gap-2">
              <p className="data-label text-ink-faint">Nesta página</p>
              <TocLinks entries={toc} />
            </nav>
          </aside>
        )}
      </div>

      <StudyBottomBar
        previous={{ href: backHref, label: "Voltar à aula", title: topic.title }}
        next={
          next && {
            href: studyHref(roadmap.id, next.id),
            label: "Próximo",
            title: next.title,
          }
        }
        completed={topic.isCompleted}
        onToggleComplete={toggleTopic}
      />
    </div>
  );
}

interface TocEntry {
  id: string;
  title: string;
  isH3: boolean;
}

/** Seções com título e âncora, na ordem do artigo. */
function tableOfContents(article: MdnArticleDto): TocEntry[] {
  return article.sections.flatMap((section) =>
    section.id && section.title
      ? [{ id: section.id, title: section.title, isH3: section.isH3 }]
      : [],
  );
}

function TocLinks({
  entries,
  onNavigate,
}: {
  entries: TocEntry[];
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col">
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            onClick={onNavigate}
            className={cn(
              "text-muted-foreground hover:text-foreground hover:bg-muted flex min-h-11 items-center rounded-md px-2 text-sm transition-colors lg:min-h-9",
              entry.isH3 && "pl-5",
            )}
          >
            {entry.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Sumário no celular: as seções num Sheet que sobe de baixo. */
function TocSheet({ entries }: { entries: TocEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Sumário" />}
      >
        <ListTree className="size-4" />
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader className="pb-0">
          <SheetTitle>Nesta página</SheetTitle>
        </SheetHeader>
        <nav aria-label="Nesta página" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <TocLinks entries={entries} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function ArticleBody({ article }: { article: MdnArticleDto }) {
  // Blocos de código longos rolam na horizontal: com foco pelo teclado, quem
  // não usa mouse também consegue rolar (axe: scrollable-region-focusable).
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.querySelectorAll("pre").forEach((pre) => {
      pre.tabIndex = 0;
    });
  }, [article]);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="data-label text-ink-faint">Documentação · MDN Web Docs</p>
        <h1>{article.title}</h1>
        {article.isTranslated && (
          <p className="text-muted-foreground text-sm">
            Tradução feita pela comunidade. A{" "}
            <a
              href={article.englishUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-ink underline underline-offset-4"
            >
              versão original em inglês
            </a>{" "}
            pode estar mais atualizada.
          </p>
        )}
      </header>

      <div ref={body} className="doc-prose">
        {article.sections.map((section, index) => {
          const Heading = section.isH3 ? "h3" : "h2";
          return (
            <section key={section.id ?? `intro-${index}`}>
              {section.title && (
                <Heading id={section.id ?? undefined}>{section.title}</Heading>
              )}
              <div dangerouslySetInnerHTML={{ __html: section.html }} />
            </section>
          );
        })}

        {article.specifications.length > 0 && (
          <section>
            <h2>Especificações</h2>
            <ul>
              {article.specifications.map((spec) => (
                <li key={spec.url}>
                  <a href={spec.url} target="_blank" rel="noreferrer noopener">
                    {spec.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {article.hasBrowserCompat && (
          <section>
            <h2>Compatibilidade com navegadores</h2>
            <p>
              A tabela de compatibilidade é mantida pela MDN.{" "}
              <a
                href={`${article.url}#browser_compatibility`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Ver na página original
              </a>
              .
            </p>
          </section>
        )}
      </div>

      <p className="text-ink-faint border-border border-t pt-4 text-xs">
        Conteúdo de{" "}
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          {article.title}
        </a>{" "}
        na MDN Web Docs, por Mozilla Contributors, sob a licença{" "}
        <a
          href={LICENSE_URL}
          target="_blank"
          rel="noreferrer noopener license"
          className="underline underline-offset-2"
        >
          CC-BY-SA 2.5
        </a>
        .
      </p>
    </article>
  );
}

function ArticleError({ error, url }: { error: unknown; url: string }) {
  const status =
    typeof error === "object" && error !== null
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

  return (
    <div className="border-border bg-card flex flex-col items-start gap-4 rounded-lg border p-6">
      <p className="text-muted-foreground">
        {status === 404
          ? "Esta página não existe mais na MDN."
          : "Não foi possível carregar esta documentação agora."}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className={buttonVariants({ variant: "outline" })}
      >
        Abrir na MDN
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-4 w-40 rounded-md" />
      <Skeleton className="h-10 w-3/4 rounded-md" />
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-4 w-full rounded-md" />
      ))}
    </div>
  );
}

function ReaderMissing({
  roadmapId,
  topicId,
}: {
  roadmapId: string;
  topicId: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-5 px-5 py-10 sm:px-10 sm:py-14">
      <h1 className="text-2xl">Leitura não encontrada</h1>
      <p className="text-muted-foreground">
        Esta documentação não está disponível neste tópico.
      </p>
      <Link
        href={studyHref(roadmapId, topicId)}
        className={buttonVariants({ variant: "outline" })}
      >
        <ArrowLeft className="size-4" />
        Voltar para o tópico
      </Link>
    </div>
  );
}
