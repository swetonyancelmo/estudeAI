"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleDashed,
  ExternalLink,
  FileText,
  ListVideo,
  Play,
} from "lucide-react";
import type {
  ResourceDto,
  ResourceStatus,
  RoadmapDetailDto,
} from "@estudeai/shared-types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useRoadmap,
  useToggleTopic,
  useUpdateResourceProgress,
} from "@/lib/roadmaps/api";
import { docSiteName, isMdnDocUrl } from "@/lib/docs/sites";
import { locateTopic, readerHref, studyHref } from "@/lib/roadmaps/study";
import { TRACK_CLASS } from "@/lib/roadmaps/track";
import {
  VIDEO_COMPLETION_RATIO,
  parseYoutubeUrl,
} from "@/lib/roadmaps/youtube";
import { TopicNoteEditor } from "./topic-note-editor";
import { TopicQuiz } from "./topic-quiz";
import { useStudyTime } from "./use-study-time";
import { TopicChallenges } from "./topic-challenges";
import { YoutubePlayer } from "./youtube-player";

/** Intervalo mínimo entre dois registros de "em andamento" do mesmo vídeo. */
const PROGRESS_REPORT_MS = 15_000;

/**
 * Sala de estudo de um tópico (Fase 1 da plataforma de estudos): assistir às
 * aulas embutidas, abrir as leituras, anotar e concluir, sem sair do estudeAI.
 *
 * Lê o MESMO cache do detalhe do roadmap: chegar aqui pelo mapa não faz nova
 * requisição, e concluir o tópico aqui já aparece marcado ao voltar.
 */
export function TopicStudy({
  roadmapId,
  topicId,
}: {
  roadmapId: string;
  topicId: string;
}) {
  const { data: roadmap, isPending, isError } = useRoadmap(roadmapId);

  if (isPending) return <StudySkeleton />;
  if (isError) return <StudyError roadmapId={roadmapId} />;

  return <StudyRoom key={topicId} roadmap={roadmap} topicId={topicId} />;
}

function StudyRoom({
  roadmap,
  topicId,
}: {
  roadmap: RoadmapDetailDto;
  topicId: string;
}) {
  const location = locateTopic(roadmap.modules, topicId);
  const toggle = useToggleTopic(roadmap.id);
  const progress = useUpdateResourceProgress(roadmap.id, topicId);
  // Fase 5: o tempo aqui conta como estudo; vídeo tocando também é atividade.
  const { markActive } = useStudyTime(roadmap.id);

  const resources = location?.topic.resources ?? [];
  const playable = resources.filter(
    (resource) =>
      resource.source === "youtube" && parseYoutubeUrl(resource.url) !== null,
  );
  const docs = resources.filter((resource) => resource.source === "docs");
  const readings = resources.filter(
    (resource) => !playable.includes(resource) && resource.source !== "docs",
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      (
        playable.find((resource) => resource.status !== "completed") ??
        playable[0]
      )?.id ?? null,
  );
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  /** Último envio por recurso, para não chamar a API a cada leitura do player. */
  const lastReport = useRef(new Map<string, number>());

  if (!location) return <StudyError roadmapId={roadmap.id} />;

  const { topic, module, moduleIndex, previous, next } = location;
  const selected = playable.find((resource) => resource.id === selectedId);
  const isProject = topic.kind === "project";

  function markCompleted(resource: ResourceDto, watchedSeconds?: number) {
    if (resource.status === "completed") return;
    progress.mutate({
      resourceId: resource.id,
      status: "completed",
      ...(watchedSeconds !== undefined
        ? { watchedSeconds: Math.floor(watchedSeconds) }
        : {}),
    });
  }

  function handleVideoProgress(
    resource: ResourceDto,
    current: number,
    duration: number,
  ) {
    markActive();
    if (resource.status === "completed") return;
    if (current / duration >= VIDEO_COMPLETION_RATIO) {
      markCompleted(resource, current);
      return;
    }
    const now = Date.now();
    const last = lastReport.current.get(resource.id) ?? 0;
    if (now - last < PROGRESS_REPORT_MS || current <= resource.watchedSeconds)
      return;
    lastReport.current.set(resource.id, now);
    progress.mutate({
      resourceId: resource.id,
      status: "in_progress",
      watchedSeconds: Math.floor(current),
    });
  }

  function openReading(resource: ResourceDto) {
    if (resource.status === "not_started") {
      progress.mutate({ resourceId: resource.id, status: "in_progress" });
    }
  }

  return (
    <div
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "flex flex-col gap-8 duration-300 animate-in fade-in-0",
      )}
    >
      <Link
        href={`/roadmaps/${roadmap.id}`}
        className="text-muted-foreground hover:text-foreground -my-2 flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" />
        Voltar para a trilha
      </Link>

      <header className="flex flex-col gap-2">
        <p className="data-label text-ink-faint">
          Módulo {moduleIndex + 1} · {module.title}
          {topic.estimatedHours !== undefined && ` · ~${topic.estimatedHours}h`}
        </p>
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {isProject && (
            <span className="border-line text-foreground rounded-sm border px-1.5 py-0.5 text-sm font-semibold">
              Projeto
            </span>
          )}
          {topic.title}
        </h1>
        {topic.isCompleted && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Check className="text-line size-4" strokeWidth={3} />
            Tópico concluído
          </p>
        )}
      </header>

      {isProject && topic.description && (
        <section className="border-border bg-card rounded-lg border p-5 sm:p-6">
          <h2 className="text-lg">O que construir</h2>
          <p className="text-muted-foreground mt-2">{topic.description}</p>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {selected ? (
            <section className="flex flex-col gap-3" aria-label="Aula">
              {unavailable.has(selected.id) ? (
                <div className="border-border bg-card flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center">
                  <p className="text-muted-foreground">
                    Este vídeo não pode ser exibido aqui.
                  </p>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={() => openReading(selected)}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Assistir no YouTube
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              ) : (
                <YoutubePlayer
                  key={selected.id}
                  target={parseYoutubeUrl(selected.url)!}
                  title={selected.title}
                  startSeconds={
                    selected.status === "completed" ? 0 : selected.watchedSeconds
                  }
                  onProgress={(current, duration) =>
                    handleVideoProgress(selected, current, duration)
                  }
                  onEnded={() => markCompleted(selected)}
                  onUnavailable={() =>
                    setUnavailable((ids) => new Set(ids).add(selected.id))
                  }
                />
              )}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-medium">{selected.title}</p>
                {selected.status !== "completed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markCompleted(selected)}
                  >
                    <Check className="size-4" />
                    Marcar aula como vista
                  </Button>
                )}
              </div>
            </section>
          ) : (
            !isProject && (
              <p className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                Ainda não há aulas em vídeo para este tópico. Os materiais são
                buscados aos poucos e aparecem aqui assim que estiverem prontos.
              </p>
            )
          )}

          <TopicQuiz
            roadmapId={roadmap.id}
            topicId={topic.id}
            topicCompleted={topic.isCompleted}
            onCompleteTopic={() => {
              if (!topic.isCompleted) toggle.mutate(topic.id);
            }}
          />

          <TopicChallenges roadmapId={roadmap.id} topicId={topic.id} />

          <TopicNoteEditor roadmapId={roadmap.id} topicId={topic.id} />
        </div>

        <aside className="flex flex-col gap-6">
          {playable.length > 0 && (
            <ResourceGroup title="Aulas">
              {playable.map((resource) => (
                <li key={resource.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(resource.id)}
                    aria-current={resource.id === selectedId || undefined}
                    className={cn(
                      "hover:bg-muted flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                      resource.id === selectedId && "bg-muted",
                    )}
                  >
                    <ResourceIcon resource={resource} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {resource.title}
                    </span>
                    <StatusMark status={resource.status} />
                  </button>
                </li>
              ))}
            </ResourceGroup>
          )}

          {docs.length > 0 && (
            <ResourceGroup title="Documentação oficial">
              {docs.map((resource) => (
                <ReadingItem
                  key={resource.id}
                  resource={resource}
                  caption={docSiteName(resource.url)}
                  // MDN abre no leitor do estudeAI; o resto, no site oficial.
                  readerHref={
                    isMdnDocUrl(resource.url)
                      ? readerHref(roadmap.id, topic.id, resource.id)
                      : undefined
                  }
                  onOpen={() => openReading(resource)}
                  onMarkRead={() => markCompleted(resource)}
                />
              ))}
            </ResourceGroup>
          )}

          {readings.length > 0 && (
            <ResourceGroup title="Leituras">
              {readings.map((resource) => (
                <ReadingItem
                  key={resource.id}
                  resource={resource}
                  onOpen={() => openReading(resource)}
                  onMarkRead={() => markCompleted(resource)}
                />
              ))}
            </ResourceGroup>
          )}
        </aside>
      </div>

      {(toggle.isError || progress.isError) && (
        <p className="text-destructive flex items-center gap-2 text-sm" role="alert">
          <AlertCircle className="size-4" />
          Não foi possível salvar seu progresso. Tente de novo.
        </p>
      )}

      <footer className="border-border flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant={topic.isCompleted ? "outline" : "default"}
          onClick={() => toggle.mutate(topic.id)}
        >
          <Check className="size-4" />
          {topic.isCompleted ? "Marcar como não concluído" : "Concluir tópico"}
        </Button>

        <nav className="flex gap-2" aria-label="Navegação entre tópicos">
          {previous && (
            <Link
              href={studyHref(roadmap.id, previous.id)}
              className={buttonVariants({ variant: "ghost" })}
            >
              <ArrowLeft className="size-4" />
              Anterior
            </Link>
          )}
          {next && (
            <Link
              href={studyHref(roadmap.id, next.id)}
              className={buttonVariants({ variant: "outline" })}
            >
              Próximo
              <ArrowRight className="size-4" />
            </Link>
          )}
        </nav>
      </footer>
    </div>
  );
}

function ResourceGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="data-label text-ink-faint">{title}</h2>
      <ul className="-mx-2 flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}

/**
 * Linha de leitura: abre no leitor interno (`readerHref`) ou numa nova aba, e
 * tem o botão de "marcar como lido" ao lado — fora do link, para o clique no
 * botão não abrir a página.
 */
function ReadingItem({
  resource,
  caption,
  readerHref: internalHref,
  onOpen,
  onMarkRead,
}: {
  resource: ResourceDto;
  caption?: string;
  readerHref?: string;
  onOpen: () => void;
  onMarkRead: () => void;
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
        <span className="flex size-9 shrink-0 items-center justify-center">
          <StatusMark status="completed" />
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Marcar "${resource.title}" como lido`}
          title="Marcar como lido"
          onClick={onMarkRead}
        >
          <Check className="size-4" />
        </Button>
      )}
    </li>
  );
}

function ResourceIcon({ resource }: { resource: ResourceDto }) {
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

function StatusMark({ status }: { status: ResourceStatus }) {
  if (status === "not_started") return null;
  return status === "completed" ? (
    <Check
      className="text-line size-4 shrink-0"
      strokeWidth={3}
      aria-label={STATUS_LABELS.completed}
    />
  ) : (
    <CircleDashed
      className="text-ink-faint size-4 shrink-0"
      aria-label={STATUS_LABELS.in_progress}
    />
  );
}

function StudySkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <div className="bg-muted h-5 w-32 animate-pulse rounded-md" />
      <div className="bg-muted h-10 w-2/3 animate-pulse rounded-md" />
      <div className="bg-muted aspect-video w-full animate-pulse rounded-lg lg:w-2/3" />
    </div>
  );
}

function StudyError({ roadmapId }: { roadmapId: string }) {
  return (
    <div className="flex flex-col items-start gap-5">
      <h1 className="text-2xl">Tópico não encontrado</h1>
      <p className="text-muted-foreground">
        Este tópico não está disponível. Ele pode ter mudado num reajuste da
        trilha.
      </p>
      <Link
        href={`/roadmaps/${roadmapId}`}
        className={buttonVariants({ variant: "outline" })}
      >
        <ArrowLeft className="size-4" />
        Voltar para a trilha
      </Link>
    </div>
  );
}
