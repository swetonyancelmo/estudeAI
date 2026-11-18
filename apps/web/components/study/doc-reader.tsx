"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, ExternalLink } from "lucide-react";
import type {
  MdnArticleDto,
  ResourceDto,
  RoadmapDetailDto,
} from "@estudeai/shared-types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMdnArticle } from "@/lib/docs/api";
import { isMdnDocUrl } from "@/lib/docs/sites";
import { useRoadmap, useUpdateResourceProgress } from "@/lib/roadmaps/api";
import { locateTopic, studyHref } from "@/lib/roadmaps/study";
import { TRACK_CLASS } from "@/lib/roadmaps/track";
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

  if (roadmap.isPending) return <ReaderSkeleton />;
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

  return (
    <Reader
      roadmap={roadmap.data}
      topicId={topicId}
      topicTitle={location.topic.title}
      resource={resource}
    />
  );
}

function Reader({
  roadmap,
  topicId,
  topicTitle,
  resource,
}: {
  roadmap: RoadmapDetailDto;
  topicId: string;
  topicTitle: string;
  resource: ResourceDto;
}) {
  const article = useMdnArticle(resource.url);
  const progress = useUpdateResourceProgress(roadmap.id, topicId);
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

  return (
    <div
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "flex flex-col gap-8 duration-300 animate-in fade-in-0",
      )}
    >
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground -my-2 flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" />
        <span className="truncate">{topicTitle}</span>
      </Link>

      {article.isPending ? (
        <ReaderSkeleton />
      ) : article.isError ? (
        <ArticleError error={article.error} url={resource.url} />
      ) : (
        <ArticleBody article={article.data} />
      )}

      {progress.isError && (
        <p className="text-destructive flex items-center gap-2 text-sm" role="alert">
          <AlertCircle className="size-4" />
          Não foi possível salvar seu progresso. Tente de novo.
        </p>
      )}

      <footer className="border-border flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        {resource.status === "completed" ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Check className="text-line size-4" strokeWidth={3} />
            Leitura concluída
          </p>
        ) : (
          <Button
            onClick={() =>
              progress.mutate({ resourceId: resource.id, status: "completed" })
            }
          >
            <Check className="size-4" />
            Marcar como lido
          </Button>
        )}
        <Link
          href={backHref}
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeft className="size-4" />
          Voltar para o tópico
        </Link>
      </footer>
    </div>
  );
}

function ArticleBody({ article }: { article: MdnArticleDto }) {
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

      <div className="doc-prose">
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
      <div className="bg-muted h-4 w-40 animate-pulse rounded-md" />
      <div className="bg-muted h-10 w-3/4 animate-pulse rounded-md" />
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="bg-muted h-4 w-full animate-pulse rounded-md" />
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
    <div className="flex flex-col items-start gap-5">
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
