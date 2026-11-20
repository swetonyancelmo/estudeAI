"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleDashed,
  ExternalLink,
  FileText,
  ListVideo,
  Play,
} from "lucide-react";
import type { ResourceDto, ResourceStatus } from "@estudeai/shared-types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Peças de material da sala de estudo, usadas pela aba Materiais e pela
 * parada atual da lista lateral. Antes moravam dentro de `topic-study.tsx`.
 */

export function ResourceGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h3 className="data-label text-ink-faint font-sans">{title}</h3>
      <ul className="-mx-2 flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}

/** Aula em vídeo: escolher troca o vídeo do palco. */
export function VideoItem({
  resource,
  active,
  onSelect,
  freshlyDone = false,
}: {
  resource: ResourceDto;
  active: boolean;
  onSelect: () => void;
  /** Concluído agora há pouco: o check entra com `station-pop`. */
  freshlyDone?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active || undefined}
        className={cn(
          "hover:bg-muted flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
          active && "bg-muted",
        )}
      >
        <ResourceIcon resource={resource} />
        <span className="min-w-0 flex-1 truncate text-sm">{resource.title}</span>
        <StatusMark status={resource.status} pop={freshlyDone} />
      </button>
    </li>
  );
}

/**
 * Linha de leitura: abre no leitor interno (`readerHref`) ou numa nova aba, e
 * tem o botão de "marcar como lido" ao lado — fora do link, para o clique no
 * botão não abrir a página.
 */
export function ReadingItem({
  resource,
  caption,
  readerHref: internalHref,
  onOpen,
  onMarkRead,
  freshlyDone = false,
}: {
  resource: ResourceDto;
  caption?: string;
  readerHref?: string;
  onOpen: () => void;
  onMarkRead: () => void;
  freshlyDone?: boolean;
}) {
  const content = (
    <>
      <ResourceIcon resource={resource} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{resource.title}</span>
        {caption && (
          <span className="text-ink-faint block truncate font-mono text-xs">
            {caption}
          </span>
        )}
      </span>
      {internalHref ? (
        <ArrowRight className="text-ink-faint size-3.5 shrink-0" />
      ) : (
        <ExternalLink className="text-ink-faint size-3.5 shrink-0" />
      )}
    </>
  );
  const rowClass =
    "hover:bg-muted flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 transition-colors";

  return (
    <li className="flex items-center gap-1">
      {internalHref ? (
        <Link href={internalHref} className={rowClass}>
          {content}
        </Link>
      ) : (
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={onOpen}
          className={rowClass}
        >
          {content}
        </a>
      )}
      {resource.status === "completed" ? (
        <span className="flex size-11 shrink-0 items-center justify-center">
          <StatusMark status="completed" pop={freshlyDone} />
        </span>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Marcar "${resource.title}" como lido`}
                onClick={onMarkRead}
              />
            }
          >
            <Check className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Marcar como lido</TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}

export function ResourceIcon({ resource }: { resource: ResourceDto }) {
  const Icon =
    resource.source === "docs"
      ? BookOpen
      : resource.type === "playlist"
        ? ListVideo
        : resource.type === "video"
          ? Play
          : FileText;
  return (
    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-sm">
      <Icon className="size-4" />
    </span>
  );
}

const STATUS_LABELS: Record<ResourceStatus, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
};

/**
 * Estado do recurso. O `aria-label` é o que o leitor de tela anuncia; o
 * `Tooltip` (antes um `title`) é a mesma informação para quem passa o mouse.
 * O gatilho é um `<span>` porque o marcador fica dentro do link do recurso.
 */
export function StatusMark({
  status,
  pop = false,
}: {
  status: ResourceStatus;
  /** Acabou de concluir: o check "acende" (D12). Nos já concluídos, nada. */
  pop?: boolean;
}) {
  if (status === "not_started") return null;
  const label = STATUS_LABELS[status];
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="flex shrink-0" role="img" aria-label={label} />}
      >
        {status === "completed" ? (
          <Check
            className={cn("text-line size-4", pop && "station-pop")}
            strokeWidth={3}
            aria-hidden="true"
          />
        ) : (
          <CircleDashed className="text-ink-faint size-4" aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
