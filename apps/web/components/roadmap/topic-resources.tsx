import Image from "next/image";
import { ExternalLink, FileText, ListVideo, Play } from "lucide-react";
import type { ResourceDto, ResourceType } from "@estudeai/shared-types";

const TYPE_ICONS: Record<ResourceType, typeof Play> = {
  video: Play,
  playlist: ListVideo,
  article: FileText,
};

/** Dimensões da thumbnail — fixas para não haver layout shift ao carregar. */
const THUMBNAIL_WIDTH = 72;
const THUMBNAIL_HEIGHT = 40;

/**
 * Recursos gratuitos de um tópico (Etapa 8): vídeos/playlists do YouTube e
 * artigos da web, todos com link já validado pelo backend.
 *
 * Lista vazia some por completo, sem título de seção e sem aviso: quando a
 * descoberta falha (quota, API fora do ar, orçamento de tempo), o backend
 * responde com `resources: []` de propósito, e isso não é um erro que o
 * estudante precise ver — é só um tópico sem sugestão de material.
 */
export function TopicResources({ resources }: { resources: ResourceDto[] }) {
  if (resources.length === 0) {
    return null;
  }

  return (
    // O padding à esquerda alinha os recursos com o TÍTULO do tópico, não com o
    // marcador (24px da parada + 12px do gap na linha do TopicCheckbox = pl-9).
    <ul className="flex flex-col gap-0.5 pb-2.5 pl-9">
      {resources.map((resource) => {
        const Icon = TYPE_ICONS[resource.type];
        const host = hostOf(resource.url);

        return (
          <li key={resource.id}>
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group/resource hover:bg-muted -ml-2 flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
            >
              {resource.thumbnailUrl ? (
                <Image
                  src={resource.thumbnailUrl}
                  alt=""
                  width={THUMBNAIL_WIDTH}
                  height={THUMBNAIL_HEIGHT}
                  className="bg-muted shrink-0 rounded-sm object-cover"
                />
              ) : (
                <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-sm">
                  <Icon className="size-4" />
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="text-foreground/85 group-hover/resource:text-foreground block truncate text-sm transition-colors">
                  {resource.title}
                </span>
                {host !== resource.title.toLowerCase() && (
                  <span className="text-ink-faint block truncate font-mono text-xs">
                    {host}
                  </span>
                )}
              </span>

              <ExternalLink className="text-ink-faint size-3.5 shrink-0 opacity-0 transition-opacity group-hover/resource:opacity-100" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Domínio como legenda ("youtube.com"), sem o www. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
