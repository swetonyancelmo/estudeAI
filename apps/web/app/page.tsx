import Link from "next/link";
import { Check, FileText, Play } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ForkIcon } from "@/components/brand/icons";
import { RouteLine } from "@/components/brand/route-line";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { STEP_SHORT_LABELS, WIZARD_STEPS } from "@/lib/wizard/steps";

/**
 * Landing desenhada como uma LINHA de mapa (docs/REDESIGN.md §4.1): um trilho
 * vertical atravessa a página e cada seção é uma estação. O trecho até "Como
 * funciona" já vem percorrido; o resto é tracejado e termina no destino, onde
 * está o CTA final.
 *
 * As perguntas e opções de "Como funciona" saem de `WIZARD_STEPS` — a landing
 * não pode prometer uma opção que o diagnóstico não tem.
 */

const TRACKS = [
  {
    className: "track-frontend",
    name: "Frontend",
    description: "A parte que as pessoas veem e usam: páginas, interação e interface.",
    stops: ["HTML semântico", "CSS e layout", "JavaScript", "React", "Projeto no ar"],
  },
  {
    className: "track-backend",
    name: "Backend",
    description: "O que roda por trás: regras de negócio, dados e segurança.",
    stops: ["Lógica e Node.js", "APIs REST", "Banco de dados", "Autenticação", "Deploy"],
  },
  {
    className: "track-fullstack",
    name: "Fullstack",
    description: "As duas pontas, para quem quer construir o produto inteiro.",
    stops: ["Fundamentos web", "React", "APIs e banco", "Autenticação", "Produto completo"],
  },
  {
    className: "track-devops",
    name: "DevOps",
    description: "O caminho do código até a produção: servidores, automação e nuvem.",
    stops: ["Linux e redes", "Docker", "CI/CD", "Nuvem", "Observabilidade"],
  },
] as const;

/** Quantas opções de uma pergunta a landing mostra antes de resumir em "+N". */
const MAX_OPTIONS_SHOWN = 6;

/** Módulo de exemplo da seção "O que você recebe". Ilustrativo, não é dado real. */
const EXAMPLE_TOPICS = [
  { title: "Box model e unidades", hours: 2, done: true },
  {
    title: "Flexbox na prática",
    hours: 3,
    done: true,
    resource: { icon: Play, title: "Flexbox do zero em um projeto", host: "youtube.com" },
  },
  {
    title: "CSS Grid",
    hours: 3,
    done: false,
    resource: { icon: FileText, title: "Guia de layout em grade", host: "developer.mozilla.org" },
  },
  { title: "Layout responsivo", hours: 4, done: false },
] as const;

const DELIVERABLES = [
  {
    title: "Horas estimadas por tópico",
    description: "Você sabe quanto cabe na sua semana antes de começar.",
  },
  {
    title: "Material gratuito já com link",
    description: "Vídeos e artigos por tópico, no formato em que você aprende melhor.",
  },
  {
    title: "Reajuste quando a rotina mudar",
    description:
      "Escreva o que mudou e o restante da rota é recalculado. O que você concluiu fica intacto.",
  },
] as const;

type StationState = "done" | "upcoming" | "destination";

/** Uma seção-estação: desenha seu trecho do trilho e o marcador ao lado do título. */
function RailSection({
  id,
  state,
  isLast = false,
  children,
}: {
  id?: string;
  state: StationState;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  const reached = state === "done";

  return (
    <section id={id} className="flex scroll-mt-4 gap-4 sm:gap-8">
      <div className="flex w-6 shrink-0 flex-col items-center" aria-hidden="true">
        <span
          className={cn(
            "h-16 w-0 border-l-[3px]",
            reached ? "border-brand rail-grow" : "border-input border-dashed",
          )}
        />
        <span
          className={cn(
            "size-6 shrink-0 rounded-full",
            state === "done" && "bg-brand",
            state === "upcoming" && "border-foreground bg-background border-[3px]",
            state === "destination" &&
              "border-foreground bg-background border-[3px] border-dashed",
          )}
        />
        {!isLast && <span className="border-input w-0 flex-1 border-l-[3px] border-dashed" />}
      </div>
      <div className={cn("min-w-0 flex-1 pt-15", isLast ? "pb-24" : "pb-10")}>
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-10">
        <Wordmark href="/" />
        <nav className="text-muted-foreground flex items-center gap-1 text-sm font-medium sm:gap-6">
          <a href="#como-funciona" className="hover:text-foreground hidden min-h-11 items-center md:flex">
            Como funciona
          </a>
          <a href="#exemplo" className="hover:text-foreground hidden min-h-11 items-center md:flex">
            Exemplo
          </a>
          <a href="#trilhas" className="hover:text-foreground hidden min-h-11 items-center md:flex">
            Trilhas
          </a>
          <Link href="/login" className="hover:text-foreground flex min-h-11 items-center px-2">
            Entrar
          </Link>
          <ThemeToggle className="-mr-2.5" />
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pt-10 pb-16 sm:px-10 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <div className="flex flex-col items-start gap-7">
            <h1 className="text-display font-extrabold tracking-[-0.035em]">
              Saiba exatamente o que estudar{" "}
              <span className="text-brand">amanhã.</span>
            </h1>
            <p className="text-muted-foreground max-w-xl text-lg">
              Algumas perguntas sobre seu objetivo, seu tempo e o que você já
              sabe. Você recebe uma trilha de programação em módulos, com horas
              estimadas e links gratuitos para estudar cada tópico.
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/register" className={buttonVariants({ size: "lg" })}>
                Montar meu roadmap
              </Link>
              <span className="data-label text-ink-faint">grátis · ~2 min</span>
            </div>
          </div>

          <HeroPreview />
        </section>

        {/* A linha: cada seção é uma estação */}
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-10">
          <RailSection id="como-funciona" state="done">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2>Você responde isto. Só isto.</h2>
              <p className="text-muted-foreground text-lg">
                Não precisa saber se você é &ldquo;mais front ou mais back&rdquo;.
                A trilha sai das suas respostas, e vem com a explicação do porquê.
              </p>
            </div>

            <ol className="mt-10 grid gap-x-0 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {WIZARD_STEPS.map((step, index) => (
                <li key={step.field} className="flex flex-col gap-4 pr-6">
                  <div className="flex items-center" aria-hidden="true">
                    <span className="bg-foreground text-background data-label flex size-7 shrink-0 items-center justify-center rounded-full">
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "border-foreground -mr-6 flex-1 border-t-[3px]",
                        index === WIZARD_STEPS.length - 1 && "border-input border-dashed",
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="data-label text-ink-faint">
                      {STEP_SHORT_LABELS[step.field]}
                    </span>
                    <h3>{step.title}</h3>
                    {"note" in step && (
                      <p className="text-ink-faint text-sm">{step.note}</p>
                    )}
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {step.options.slice(0, MAX_OPTIONS_SHOWN).map((option) => (
                      <li
                        key={option.value}
                        className="border-input bg-card rounded-sm border px-2 py-1 text-sm"
                      >
                        {option.label}
                      </li>
                    ))}
                    {step.options.length > MAX_OPTIONS_SHOWN && (
                      <li className="text-ink-faint data-label px-1 py-1.5">
                        +{step.options.length - MAX_OPTIONS_SHOWN}
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ol>

            <p className="border-border mt-10 flex max-w-2xl items-start gap-3 border-t pt-6">
              <ForkIcon className="text-brand-ink mt-0.5 size-6" />
              <span>
                <strong className="font-semibold">Aí a rota se abre.</strong>{" "}
                <span className="text-muted-foreground">
                  Com as suas respostas, o estudeAI define a trilha (Frontend,
                  Backend, Fullstack ou DevOps) e monta os módulos na ordem certa,
                  no tamanho do seu tempo.
                </span>
              </span>
            </p>
          </RailSection>

          <RailSection id="exemplo" state="upcoming">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2>O que chega na sua tela</h2>
              <p className="text-muted-foreground text-lg">
                Nada de lista genérica de tecnologias. Cada módulo vem quebrado em
                tópicos que você marca conforme avança.
              </p>
            </div>

            <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <ExampleModule />

              <dl className="flex flex-col gap-7">
                {DELIVERABLES.map((item) => (
                  <div key={item.title} className="flex flex-col gap-1.5">
                    <dt className="font-heading text-xl font-bold">{item.title}</dt>
                    <dd className="text-muted-foreground">{item.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </RailSection>

          <RailSection id="trilhas" state="upcoming">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2>Quatro linhas no mapa</h2>
              <p className="text-muted-foreground text-lg">
                Você segue uma delas. Estas são paradas de exemplo: as suas
                dependem do que você responder.
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-12">
              {TRACKS.map((track) => (
                <article
                  key={track.name}
                  className={cn(
                    track.className,
                    "grid gap-6 lg:grid-cols-[0.34fr_1fr] lg:items-start lg:gap-8",
                  )}
                >
                  <div className="flex flex-col gap-1.5">
                    <h3 className="flex items-center gap-2.5">
                      <span className="bg-line size-3.5 shrink-0 rounded-full" aria-hidden="true" />
                      {track.name}
                    </h3>
                    <p className="text-muted-foreground text-sm">{track.description}</p>
                  </div>

                  <ol className="border-line ml-2 border-l-[3px] sm:mt-2.5 sm:ml-0 sm:grid sm:grid-cols-5 sm:border-l-0">
                    {track.stops.map((stop) => (
                      <li
                        key={stop}
                        className="sm:border-line relative py-1.5 pl-5 text-sm font-medium sm:border-t-[3px] sm:py-0 sm:pt-4 sm:pr-3 sm:pl-0"
                      >
                        <span
                          className="border-line bg-background absolute top-1/2 -left-[9px] size-[15px] -translate-y-1/2 rounded-full border-[3px] sm:-top-[9px] sm:left-0 sm:translate-y-0"
                          aria-hidden="true"
                        />
                        {stop}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </RailSection>

          <RailSection state="destination" isLast>
            <div className="flex flex-col items-start gap-6">
              <h2 className="max-w-xl text-3xl font-extrabold">
                Próxima parada: o seu roadmap.
              </h2>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link href="/register" className={buttonVariants({ size: "lg" })}>
                  Montar meu roadmap
                </Link>
                <span className="data-label text-ink-faint">
                  grátis · até 6 perguntas · ~2 min
                </span>
              </div>
            </div>
          </RailSection>
        </div>
      </main>

      <footer className="border-border border-t">
        <div className="text-ink-faint mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 text-sm sm:px-10">
          <span>
            estudeAI · feito por{" "}
            <a
              href="https://github.com/swetonyancelmo"
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground hover:text-foreground font-medium underline underline-offset-4"
            >
              Swetony Ancelmo
            </a>
          </span>
          <span className="flex gap-5">
            <Link href="/login" className="hover:text-foreground flex min-h-11 items-center">
              Entrar
            </Link>
            <Link href="/register" className="hover:text-foreground flex min-h-11 items-center">
              Criar conta
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Prévia do produto no hero: um roadmap em andamento, do jeito que ele aparece. */
function HeroPreview() {
  return (
    <div
      role="img"
      aria-label="Prévia de um roadmap: trilha Frontend com 38% concluído, parada atual CSS e layout, próxima parada JavaScript"
      className="track-frontend border-foreground bg-card flex flex-col gap-6 rounded-lg border-2 p-6 shadow-[6px_6px_0_var(--brand)] sm:p-7 lg:rotate-1"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2.5">
            <span className="bg-line size-3 rounded-full" />
            <span className="font-heading text-xl font-bold">Trilha Frontend</span>
          </span>
          <span className="data-label text-ink-faint">2/6 módulos · ~41h pela frente</span>
        </div>
        <span className="font-heading text-3xl leading-none font-extrabold">
          38<span className="text-xl">%</span>
        </span>
      </div>

      <RouteLine stops={7} reached={2} />

      <div className="border-border flex flex-col gap-3 border-t pt-5">
        <span className="text-brand-ink text-xs font-semibold">Você está aqui</span>
        <span className="font-heading text-xl font-bold">CSS e layout</span>
        <ul className="flex flex-col">
          {EXAMPLE_TOPICS.slice(0, 3).map((topic) => (
            <li
              key={topic.title}
              className="border-border flex items-center gap-3 border-b py-2.5 last:border-0"
            >
              <Station done={topic.done} />
              <span className={cn("flex-1", topic.done && "text-muted-foreground line-through")}>
                {topic.title}
              </span>
              <span className="data-label text-ink-faint">~{topic.hours}h</span>
            </li>
          ))}
        </ul>
      </div>

      <span className="data-label text-ink-faint">próxima parada: JavaScript</span>
    </div>
  );
}

/** Um módulo inteiro, com recursos, como na tela de detalhe. */
function ExampleModule() {
  return (
    <figure className="track-frontend flex flex-col gap-3">
      <div
        role="img"
        aria-label="Exemplo de módulo: CSS e layout, com quatro tópicos, horas estimadas e materiais sugeridos"
        className="border-border bg-card overflow-hidden rounded-lg border shadow-[0_3px_0_var(--border)]"
      >
        <div className="bg-line h-2" />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="data-label text-ink-faint">módulo 02 · Trilha Frontend</span>
              <span className="font-heading text-xl font-bold">CSS e layout</span>
            </div>
            <span className="data-label text-ink-faint">2/4</span>
          </div>

          <ul className="flex flex-col">
            {EXAMPLE_TOPICS.map((topic) => (
              <li key={topic.title} className="border-border border-b py-2.5 last:border-0">
                <div className="flex items-center gap-3">
                  <Station done={topic.done} />
                  <span className={cn("flex-1", topic.done && "text-muted-foreground line-through")}>
                    {topic.title}
                  </span>
                  <span className="data-label text-ink-faint">~{topic.hours}h</span>
                </div>
                {"resource" in topic && (
                  <div className="mt-2 ml-9 flex items-center gap-3">
                    <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-sm">
                      <topic.resource.icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{topic.resource.title}</span>
                      <span className="text-ink-faint font-mono text-xs">
                        {topic.resource.host}
                      </span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="text-ink-faint text-sm">
        Exemplo ilustrativo de um módulo da trilha Frontend.
      </figcaption>
    </figure>
  );
}

/** Marcador de tópico (parada), igual ao do produto, sem interação. */
function Station({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
        done ? "border-line bg-line text-white" : "border-input bg-card",
      )}
    >
      {done && <Check className="size-3.5" strokeWidth={3.5} />}
    </span>
  );
}
