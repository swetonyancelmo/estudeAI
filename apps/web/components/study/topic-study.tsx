"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  ListOrdered,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import {
  QUIZ_PASS_RATIO,
  type ResourceDto,
  type RoadmapDetailDto,
  type UpdateResourceProgressRequestDto,
} from "@estudeai/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CompletionDialog } from "@/components/roadmap/completion-dialog";
import { useCompleteTopic } from "@/components/roadmap/use-complete-topic";
import {
  useRoadmap,
  useTopicChallenges,
  useTopicQuiz,
  useUpdateResourceProgress,
} from "@/lib/roadmaps/api";
import { docSiteName, isMdnDocUrl } from "@/lib/docs/sites";
import { AREA_LABELS } from "@/lib/roadmaps/labels";
import {
  locateTopic,
  readerHref,
  studyHref,
  type TopicLocation,
} from "@/lib/roadmaps/study";
import { TRACK_CLASS } from "@/lib/roadmaps/track";
import {
  VIDEO_COMPLETION_RATIO,
  parseYoutubeUrl,
} from "@/lib/roadmaps/youtube";
import {
  PREFERENCE_KEYS,
  usePreference,
  useStudyChrome,
} from "@/lib/study/preferences";
import { ProjectBrief } from "./project-brief";
import { StationList, StationRail } from "./station-list";
import { BOTTOM_BAR_PADDING, StudyBottomBar } from "./study-bottom-bar";
import { StudyBreadcrumb } from "./study-breadcrumb";
import { ReadingItem, ResourceGroup, VideoItem } from "./study-resources";
import { TopicChallenges } from "./topic-challenges";
import { TopicNoteEditor } from "./topic-note-editor";
import { TopicQuiz } from "./topic-quiz";
import { useStudyShortcuts } from "./use-study-shortcuts";
import { useStudyTime } from "./use-study-time";
import { YoutubePlayer } from "./youtube-player";

/** Intervalo mínimo entre dois registros de "em andamento" do mesmo vídeo. */
const PROGRESS_REPORT_MS = 15_000;

/** Relógio dos eventos do player (fora do componente: não roda no render). */
const clock = () => Date.now();

/** Abas do tópico (D9). O valor vai para a URL em `?aba=`. */
const TABS = ["materiais", "exercicios", "desafios", "anotacoes"] as const;
type Tab = (typeof TABS)[number];
const DEFAULT_TAB: Tab = "materiais";

/** A partir daqui a lista lateral vira coluna; abaixo, vai para um Sheet. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Sala de estudo de um tópico (Fase 1 da plataforma de estudos): assistir às
 * aulas embutidas, abrir as leituras, anotar e concluir, sem sair do estudeAI.
 *
 * Lê o MESMO cache do detalhe do roadmap: chegar aqui pelo mapa não faz nova
 * requisição, e concluir o tópico aqui já aparece marcado ao voltar.
 *
 * Redesign v2 (Fase 2): o objetivo é estudar uma estação inteira sem sair da
 * página. Palco do vídeo no topo, conteúdo do tópico em abas, a estação numa
 * lista lateral (Sheet no celular) e uma barra fixa com Anterior, Concluir e
 * Próximo.
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

  // `useSearchParams` (a aba na URL) pede um Suspense em volta.
  return (
    <Suspense fallback={<StudySkeleton />}>
      <StudyRoom key={topicId} roadmap={roadmap} topicId={topicId} />
    </Suspense>
  );
}

function StudyRoom({
  roadmap,
  topicId,
}: {
  roadmap: RoadmapDetailDto;
  topicId: string;
}) {
  const location = locateTopic(roadmap.modules, topicId);
  if (!location) return <StudyError roadmapId={roadmap.id} />;
  return <StudyLayout roadmap={roadmap} location={location} />;
}

function StudyLayout({
  roadmap,
  location,
}: {
  roadmap: RoadmapDetailDto;
  location: TopicLocation;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { topic, module, moduleIndex, moduleTopics, previous, next } = location;
  const completion = useCompleteTopic(roadmap, { announce: true });
  const progress = useUpdateResourceProgress(roadmap.id, topic.id);
  const quiz = useTopicQuiz(roadmap.id, topic.id);
  const challenges = useTopicChallenges(roadmap.id, topic.id);
  // Fase 5: o tempo aqui conta como estudo; vídeo tocando também é atividade.
  const { markActive } = useStudyTime(roadmap.id);

  const [collapsed, setCollapsed] = usePreference(PREFERENCE_KEYS.listCollapsed);
  const [focus, setFocus] = usePreference(PREFERENCE_KEYS.focusMode);
  const setHideNav = useStudyChrome((state) => state.setHideNav);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Modo foco (D8) esconde a barra global, que mora no layout.
  useEffect(() => {
    setHideNav(focus);
    return () => setHideNav(false);
  }, [focus, setHideNav]);

  const resources = topic.resources;
  const playable = resources.filter(
    (resource) =>
      resource.source === "youtube" && parseYoutubeUrl(resource.url) !== null,
  );
  const docs = resources.filter((resource) => resource.source === "docs");
  const readings = resources.filter(
    (resource) => !playable.includes(resource) && resource.source !== "docs",
  );
  const seen = resources.filter((resource) => resource.status === "completed").length;

  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      (
        playable.find((resource) => resource.status !== "completed") ??
        playable[0]
      )?.id ?? null,
  );
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  /** Vídeo que acabou de terminar: o palco oferece a próxima aula (sem autoplay). */
  const [endedId, setEndedId] = useState<string | null>(null);
  /** Último envio por recurso, para não chamar a API a cada leitura do player. */
  const lastReport = useRef(new Map<string, number>());

  const selected = playable.find((resource) => resource.id === selectedId);
  /** A aula seguinte na ordem; a primeira ainda não vista, se a seguinte já foi. */
  const nextVideo = selected
    ? (playable
        .slice(playable.indexOf(selected) + 1)
        .find((resource) => resource.status !== "completed") ??
      playable.find(
        (resource) => resource.id !== selected.id && resource.status !== "completed",
      ) ??
      playable[playable.indexOf(selected) + 1])
    : undefined;
  const isProject = topic.kind === "project";

  // Estado de cada aba, para o indicador discreto no rótulo.
  const hasQuiz = quiz.data ? quiz.data.questions.length > 0 : false;
  const quizPassed =
    hasQuiz &&
    quiz.data?.summary != null &&
    quiz.data.summary.correct / quiz.data.questions.length >= QUIZ_PASS_RATIO;
  const challengeList = challenges.data?.challenges ?? [];
  const hasChallenges = challengeList.length > 0;
  const challengesPassed = hasChallenges && challengeList.every((c) => c.passed);
  const materialsSeen = resources.length > 0 && seen === resources.length;

  const visibleTabs = TABS.filter(
    (tab) =>
      (tab !== "exercicios" || hasQuiz) && (tab !== "desafios" || hasChallenges),
  );
  const requested = searchParams.get("aba") as Tab | null;
  const activeTab: Tab =
    requested && visibleTabs.includes(requested) ? requested : DEFAULT_TAB;

  /**
   * A aba vai para a URL com `pushState`: o Next sincroniza o
   * `useSearchParams`, o link fica compartilhável e o botão voltar volta de
   * aba, sem buscar a página de novo.
   */
  function changeTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === DEFAULT_TAB) params.delete("aba");
    else params.set("aba", tab);
    const query = params.toString();
    window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
  }

  /**
   * Sugestão de conclusão (D11): tudo visto e o quiz passou (ou não há quiz).
   * Só convida; quem conclui é a pessoa, no botão.
   */
  const quizSettled = quiz.isSuccess && (!hasQuiz || quizPassed);
  const suggest = !topic.isCompleted && materialsSeen && quizSettled;
  const suggestion = suggest
    ? next
      ? `Tudo visto por aqui. Concluir e seguir para ${next.title}?`
      : "Tudo visto por aqui. Concluir esta parada?"
    : null;

  /** Conclusão com o retorno da D12: toast, ou o resumo ao fechar uma estação. */
  function toggleTopic() {
    return completion.toggleTopic(topic.id);
  }

  /**
   * Concluir com a sugestão na tela responde a ela: conclui e segue. Se a
   * conclusão fecha a estação (ou a rota), fica aqui para o resumo abrir;
   * a próxima estação é uma das ações dele.
   */
  function handleBarComplete() {
    const reached = toggleTopic();
    if (suggest && next && !reached) router.push(studyHref(roadmap.id, next.id));
  }

  /** Recursos concluídos nesta visita: só eles ganham o `station-pop`. */
  const [freshlyDone, setFreshlyDone] = useState<Set<string>>(new Set());

  function report(body: UpdateResourceProgressRequestDto & { resourceId: string }) {
    progress.mutate(body, {
      onSuccess: (result) => {
        if (result.status === "completed") {
          setFreshlyDone((ids) => new Set(ids).add(result.resourceId));
        }
      },
      onError: () =>
        toast.error("Não foi possível salvar seu progresso.", {
          id: "progress-error",
          action: { label: "Tentar de novo", onClick: () => report(body) },
        }),
    });
  }

  function markCompleted(resource: ResourceDto, watchedSeconds?: number) {
    if (resource.status === "completed") return;
    report({
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
    const now = clock();
    const last = lastReport.current.get(resource.id) ?? 0;
    if (now - last < PROGRESS_REPORT_MS || current <= resource.watchedSeconds)
      return;
    lastReport.current.set(resource.id, now);
    report({
      resourceId: resource.id,
      status: "in_progress",
      watchedSeconds: Math.floor(current),
    });
  }

  function openReading(resource: ResourceDto) {
    if (resource.status === "not_started") {
      report({ resourceId: resource.id, status: "in_progress" });
    }
  }

  function selectVideo(resourceId: string, fromSheet = false) {
    setSelectedId(resourceId);
    setEndedId(null);
    if (fromSheet) {
      setSheetOpen(false);
      window.scrollTo({ top: 0 });
    }
  }

  function toggleList() {
    if (window.matchMedia(DESKTOP_QUERY).matches && !focus) {
      setCollapsed(!collapsed);
    } else {
      setSheetOpen((open) => !open);
    }
  }

  useStudyShortcuts({
    onPrevious: previous
      ? () => router.push(studyHref(roadmap.id, previous.id))
      : undefined,
    onNext: next ? () => router.push(studyHref(roadmap.id, next.id)) : undefined,
    onToggleFocus: () => setFocus(!focus),
    onToggleList: toggleList,
    onEscape: focus ? () => setFocus(false) : undefined,
  });

  const docItems = docs.map((resource) => (
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
      freshlyDone={freshlyDone.has(resource.id)}
    />
  ));
  const readingItems = readings.map((resource) => (
    <ReadingItem
      key={resource.id}
      resource={resource}
      onOpen={() => openReading(resource)}
      onMarkRead={() => markCompleted(resource)}
      freshlyDone={freshlyDone.has(resource.id)}
    />
  ));

  /** Materiais da parada atual dentro da lista lateral (o que antes era a aside). */
  function currentDetail(fromSheet: boolean) {
    if (resources.length === 0) return null;
    return (
      <div className="flex flex-col gap-3">
        {playable.length > 0 && (
          <ResourceGroup title="Aulas">
            {playable.map((resource) => (
              <VideoItem
                key={resource.id}
                resource={resource}
                active={resource.id === selectedId}
                freshlyDone={freshlyDone.has(resource.id)}
                onSelect={() => selectVideo(resource.id, fromSheet)}
              />
            ))}
          </ResourceGroup>
        )}
        {docs.length > 0 && (
          <ResourceGroup title="Documentação oficial">{docItems}</ResourceGroup>
        )}
        {readings.length > 0 && (
          <ResourceGroup title="Leituras">{readingItems}</ResourceGroup>
        )}
      </div>
    );
  }

  const done = moduleTopics.filter((item) => item.isCompleted).length;
  const stationLabel = `Estação ${moduleIndex + 1} · ${done}/${moduleTopics.length}`;
  const showAside = !focus;

  return (
    <div
      className={cn(
        TRACK_CLASS[roadmap.targetArea],
        "flex flex-1 flex-col gap-4 pt-2 duration-300 animate-in fade-in-0 lg:pt-4",
        BOTTOM_BAR_PADDING,
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <StudyBreadcrumb
          trackHref={`/roadmaps/${roadmap.id}`}
          trackLabel={`Trilha ${AREA_LABELS[roadmap.targetArea]}`}
          station={`Estação ${moduleIndex + 1}: ${module.title}`}
          items={[{ label: topic.title }]}
          actions={
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-pressed={focus}
                      aria-label={focus ? "Sair do modo foco" : "Modo foco"}
                      onClick={() => setFocus(!focus)}
                    />
                  }
                >
                  {focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </TooltipTrigger>
                <TooltipContent>
                  {focus ? "Sair do modo foco" : "Modo foco"}
                  <Kbd>{focus ? "Esc" : "F"}</Kbd>
                </TooltipContent>
              </Tooltip>
              {showAside && !collapsed && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Recolher lista de paradas"
                        onClick={() => setCollapsed(true)}
                        className="hidden lg:inline-flex"
                      />
                    }
                  >
                    <PanelRightClose className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Recolher lista <Kbd>[</Kbd>
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          }
        />
      </div>

      <div
        className={cn(
          "mx-auto grid w-full max-w-7xl gap-8 lg:px-6",
          showAside &&
            (collapsed
              ? "lg:grid-cols-[minmax(0,1fr)_3.5rem]"
              : "lg:grid-cols-[minmax(0,1fr)_20rem]"),
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">
          {selected ? (
            <section
              aria-label="Aula"
              className="bg-stage text-stage-foreground relative overflow-hidden lg:rounded-lg"
            >
              {unavailable.has(selected.id) ? (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <p>Este vídeo não pode ser exibido aqui.</p>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={() => openReading(selected)}
                    className={cn(buttonVariants({ variant: "outline" }), "text-foreground")}
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
                  onEnded={() => {
                    markCompleted(selected);
                    setEndedId(selected.id);
                  }}
                  onUnavailable={() =>
                    setUnavailable((ids) => new Set(ids).add(selected.id))
                  }
                />
              )}
              {endedId === selected.id && nextVideo && (
                <NextLessonCard
                  title={nextVideo.title}
                  onPlay={() => selectVideo(nextVideo.id)}
                  onDismiss={() => setEndedId(null)}
                />
              )}
            </section>
          ) : (
            !isProject && (
              <p className="border-border bg-card text-muted-foreground mx-4 rounded-lg border border-dashed p-6 text-sm sm:mx-6 lg:mx-0">
                Ainda não há aulas em vídeo para este tópico. Os materiais são
                buscados aos poucos e aparecem aqui assim que estiverem prontos.
              </p>
            )
          )}

          <div className="flex flex-col gap-6 px-4 sm:px-6 lg:px-0">
            {selected && (
              <div className="-mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-muted-foreground text-sm">
                  <span className="sr-only">Aula em exibição: </span>
                  {selected.title}
                </p>
                {selected.status === "completed" ? (
                  <p className="text-muted-foreground flex min-h-9 items-center gap-1.5 text-sm">
                    <Check className="text-line size-4" strokeWidth={3} />
                    Aula vista
                  </p>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => markCompleted(selected)}>
                    <Check className="size-4" />
                    Marcar aula como vista
                  </Button>
                )}
              </div>
            )}

            <header className="flex flex-col gap-2">
              {isProject && (
                <span className="border-line text-foreground w-fit rounded-sm border px-1.5 py-0.5 text-sm font-semibold">
                  Projeto
                </span>
              )}
              <h1>{topic.title}</h1>
              <p className="data-label text-ink-faint">
                {/* No checkpoint, as horas ficam no bloco "O que construir". */}
                {[
                  !isProject && topic.estimatedHours !== undefined && `~${topic.estimatedHours}h`,
                  resources.length > 0 &&
                    `${seen} de ${resources.length} ${resources.length === 1 ? "material" : "materiais"}`,
                  isProject ? "checkpoint da estação" : null,
                  topic.isCompleted && (isProject ? "concluído" : "parada concluída"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSheetOpen(true)}
                className={cn("mt-1 w-fit", !focus && "lg:hidden")}
                aria-label={`${stationLabel}: ver as paradas da estação`}
              >
                <ListOrdered className="size-4" />
                {stationLabel}
              </Button>
            </header>

            <Tabs value={activeTab} onValueChange={(value) => changeTab(value as Tab)}>
              <TabsList className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                <TabsTrigger value="materiais">
                  Materiais
                  {materialsSeen && <TabCheck label="tudo visto" />}
                </TabsTrigger>
                {hasQuiz && (
                  <TabsTrigger value="exercicios">
                    Exercícios
                    {quizPassed && <TabCheck label="aprovado" />}
                  </TabsTrigger>
                )}
                {hasChallenges && (
                  <TabsTrigger value="desafios">
                    Desafios
                    {challengesPassed && <TabCheck label="resolvidos" />}
                  </TabsTrigger>
                )}
                <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
              </TabsList>

              {/* Painéis fora da aba ativa não montam (padrão do Base UI):
                  o Sandpack só é baixado quando a aba Desafios abre. */}
              <TabsContent value="materiais" className="flex flex-col gap-6">
                {isProject && (
                  <ProjectBrief
                    description={topic.description}
                    estimatedHours={topic.estimatedHours}
                  />
                )}
                {/* Sem a lista lateral (celular ou foco), as aulas ficam aqui. */}
                {playable.length > 1 && (
                  <ResourceGroup title="Aulas" className={cn(!focus && "lg:hidden")}>
                    {playable.map((resource) => (
                      <VideoItem
                        key={resource.id}
                        resource={resource}
                        active={resource.id === selectedId}
                        freshlyDone={freshlyDone.has(resource.id)}
                        onSelect={() => {
                          selectVideo(resource.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      />
                    ))}
                  </ResourceGroup>
                )}
                {docs.length > 0 && (
                  <ResourceGroup title="Documentação oficial">{docItems}</ResourceGroup>
                )}
                {readings.length > 0 && (
                  <ResourceGroup title="Leituras">{readingItems}</ResourceGroup>
                )}
                {docs.length === 0 && readings.length === 0 && !isProject && (
                  <p className="text-muted-foreground text-sm">
                    Esta parada ainda não tem leituras. As aulas ficam no vídeo acima.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="exercicios">
                <TopicQuiz
                  roadmapId={roadmap.id}
                  topicId={topic.id}
                  topicCompleted={topic.isCompleted}
                  onCompleteTopic={() => {
                    if (!topic.isCompleted) toggleTopic();
                  }}
                />
              </TabsContent>

              <TabsContent value="desafios">
                <TopicChallenges roadmapId={roadmap.id} topicId={topic.id} />
              </TabsContent>

              <TabsContent value="anotacoes">
                <TopicNoteEditor roadmapId={roadmap.id} topicId={topic.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {showAside && (
          <aside className="hidden lg:block">
            <div className="sticky top-4">
              {collapsed ? (
                <StationRail
                  roadmapId={roadmap.id}
                  location={location}
                  onExpand={() => setCollapsed(false)}
                />
              ) : (
                <ScrollArea className="h-[calc(100dvh-4rem-env(safe-area-inset-bottom)-2rem)]">
                  <div className="pr-3 pb-4">
                    <StationList
                      roadmapId={roadmap.id}
                      location={location}
                      currentDetail={currentDetail(false)}
                      justCompleted={completion.justCompleted}
                    />
                  </div>
                </ScrollArea>
              )}
            </div>
          </aside>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className={TRACK_CLASS[roadmap.targetArea]}>
          <SheetHeader className="pb-0">
            <SheetTitle>Paradas da estação</SheetTitle>
            <SheetDescription className="sr-only">
              Todas as paradas da estação {moduleIndex + 1}, com o estado de cada uma.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            <StationList
              roadmapId={roadmap.id}
              location={location}
              currentDetail={currentDetail(true)}
              justCompleted={completion.justCompleted}
              onNavigate={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <StudyBottomBar
        previous={
          previous && {
            href: studyHref(roadmap.id, previous.id),
            label: "Anterior",
            title: previous.title,
            shortcut: true,
          }
        }
        next={
          next && {
            href: studyHref(roadmap.id, next.id),
            label: "Próximo",
            title: next.title,
            shortcut: true,
          }
        }
        completed={topic.isCompleted}
        justCompleted={completion.justCompleted === topic.id && topic.isCompleted}
        onToggleComplete={handleBarComplete}
        suggestion={suggestion}
      />

      <CompletionDialog
        roadmap={roadmap}
        milestone={completion.milestone}
        onClose={completion.closeMilestone}
      />

    </div>
  );
}

/**
 * Fim de um vídeo com outra aula no tópico (D12): um cartão no palco oferece a
 * próxima. Sem autoplay: quem decide é a pessoa.
 */
function NextLessonCard({
  title,
  onPlay,
  onDismiss,
}: {
  title: string;
  onPlay: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="bg-stage/90 absolute inset-0 flex items-center justify-center p-4"
    >
      <div className="border-border bg-card text-card-foreground flex w-full max-w-sm flex-col gap-3 rounded-lg border p-4 shadow-[0_3px_0_var(--border)]">
        <p className="data-label text-ink-faint">Próxima aula</p>
        <p className="font-semibold">{title}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onPlay}>
            <Play className="size-4" />
            Assistir
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Check pequeno na cor da linha no rótulo da aba, com o estado em texto. */
function TabCheck({ label }: { label: string }) {
  return (
    <>
      <Check className="text-line size-3.5" strokeWidth={3} aria-hidden="true" />
      <span className="sr-only">({label})</span>
    </>
  );
}

function StudySkeleton() {
  return (
    <div
      className="mx-auto grid w-full max-w-7xl gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-6"
      aria-busy="true"
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="mx-4 h-5 w-64 rounded-md sm:mx-6 lg:mx-0" />
        <Skeleton className="aspect-video w-full rounded-none lg:rounded-lg" />
        <div className="flex flex-col gap-3 px-4 sm:px-6 lg:px-0">
          <Skeleton className="h-10 w-2/3 rounded-md" />
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="mt-4 h-11 w-full rounded-md" />
        </div>
      </div>
      <div className="hidden flex-col gap-3 lg:flex">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-6 w-48 rounded-md" />
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

function StudyError({ roadmapId }: { roadmapId: string }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-5 py-10 sm:px-10 sm:py-14">
      <h1 className="text-2xl">Tópico não encontrado</h1>
      <Alert className="max-w-md">
        <AlertCircle />
        <AlertDescription>
          Este tópico não está disponível. Ele pode ter mudado num reajuste da
          trilha.
        </AlertDescription>
      </Alert>
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
