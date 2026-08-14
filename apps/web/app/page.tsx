import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/brand/wordmark";
import { RoadmapRouteHero } from "@/components/brand/roadmap-route";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** CTA principal: mesmo peso visual nos dois pontos de conversão da página. */
const ctaClass = cn(
  buttonVariants(),
  "h-11 rounded-md px-5 text-[15px] font-semibold",
);

/** Os quatro eixos do diagnóstico (FR-01) — a landing promete exatamente isto. */
const WIZARD_STEPS = [
  {
    title: "Objetivo",
    description:
      "O que te move a programar: carreira, projeto próprio, freelas ou curiosidade.",
  },
  {
    title: "Tempo semanal",
    description:
      "Quantas horas por semana você realmente consegue dedicar aos estudos.",
  },
  {
    title: "Afinidade",
    description:
      "O que te atrai mais: interface e interação, lógica de sistemas, ou os dois.",
  },
  {
    title: "Estilo de aprendizado",
    description:
      "Visual, teórico ou prático — o roadmap se organiza em torno disso.",
  },
];

const TRACKS = [
  {
    name: "Frontend",
    description:
      "Interfaces, interação e a camada que o usuário vê. HTML, CSS, JavaScript e React — e a arte de fazer a experiência funcionar bem.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 6 3 12l5 6M16 6l5 6-5 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "Backend",
    description:
      "A lógica por trás: APIs, banco de dados, autenticação e a infraestrutura que sustenta o produto.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="2" />
        <path
          d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    name: "Fullstack",
    description:
      "As duas pontas. Você monta o produto inteiro — do banco de dados até o último pixel da tela.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 6 3 12l5 6M16 6l5 6-5 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="bg-card flex flex-1 flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4 sm:px-10">
        <Wordmark href="/" />
        <nav className="text-muted-foreground flex items-center gap-5 text-sm sm:gap-6">
          <a href="#como-funciona" className="hover:text-foreground hidden sm:inline">
            Como funciona
          </a>
          <a href="#trilhas" className="hover:text-foreground hidden sm:inline">
            Trilhas
          </a>
          <Link href="/login" className="hover:text-foreground">
            Entrar
          </Link>
          <ThemeToggle className="-mr-1" />
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="dot-grid px-6 pt-16 pb-14 sm:px-10 sm:pt-20">
          <div className="max-w-[680px]">
            <span className="eyebrow text-muted-foreground">
              4 perguntas · roadmap gerado por IA
            </span>
            <h1 className="mt-4 text-[clamp(2.125rem,6vw,3.375rem)] leading-[1.06] font-extrabold">
              Pare de adivinhar
              <br />o que estudar.
            </h1>
            <p className="text-muted-foreground mt-5 max-w-[520px] text-[17px]">
              Responda sobre seu objetivo, tempo disponível e jeito de aprender. A IA
              organiza um roadmap completo — Frontend, Backend ou Fullstack — em módulos
              e tópicos, e reajusta conforme você avança.
            </p>
            <div className="mt-8 flex items-center gap-6">
              <Link href="/register" className={ctaClass}>
                Montar meu roadmap
              </Link>
              <a
                href="#como-funciona"
                className="text-muted-foreground hover:text-foreground rounded-sm text-sm font-medium"
              >
                Como funciona ↓
              </a>
            </div>

            <figure className="border-border bg-background mt-14 rounded-2xl border px-6 py-7 sm:px-8">
              <RoadmapRouteHero />
              <figcaption className="text-ink-faint mt-0.5 flex justify-between font-mono text-[11.5px]">
                <span>seu roadmap, em rota</span>
                <span className="hidden sm:inline">a IA escolhe a trilha por você</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="como-funciona" className="border-border border-t px-6 py-20 sm:px-10">
          <div className="mb-11 max-w-[560px]">
            <span className="eyebrow text-muted-foreground">Como funciona</span>
            <h2 className="mt-3 mb-2.5 text-[clamp(1.5rem,3vw,2rem)] font-bold">
              Quatro perguntas. Um roadmap sob medida.
            </h2>
            <p className="text-muted-foreground text-[15px]">
              Sem escolher trilha na mão — o diagnóstico decide isso por você, e explica
              o porquê.
            </p>
          </div>

          {/* A numeração é literal: o wizard é sequencial, uma pergunta por passo. */}
          <ol className="border-border bg-border grid grid-cols-1 gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-4">
            {WIZARD_STEPS.map((step, index) => (
              <li key={step.title} className="bg-card p-6">
                <span className="text-brand mb-3.5 block font-mono text-[13px]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mb-2 text-[15.5px] font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-[13.5px]">{step.description}</p>
              </li>
            ))}
          </ol>

          <div className="border-brand-line bg-brand-soft mt-4 flex items-center gap-4 rounded-2xl border px-6 py-5">
            <Sparkles className="text-brand size-6 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="mb-1 text-[15px] font-bold">
                A IA monta seu roadmap — com justificativa
              </h3>
              <p className="text-muted-foreground text-[13.5px]">
                Trilha escolhida, dividida em módulos e tópicos, com a explicação de por
                que essa é a rota certa pra você agora.
              </p>
            </div>
          </div>
        </section>

        <section id="trilhas" className="border-border border-t px-6 py-20 sm:px-10">
          <div className="mb-11 max-w-[560px]">
            <span className="eyebrow text-muted-foreground">Trilhas</span>
            <h2 className="mt-3 mb-2.5 text-[clamp(1.5rem,3vw,2rem)] font-bold">
              Três caminhos. Um escolhido pra você.
            </h2>
            <p className="text-muted-foreground text-[15px]">
              Você não precisa saber se é mais front ou back — isso sai do diagnóstico.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4.5 md:grid-cols-3">
            {TRACKS.map((track) => (
              <article
                key={track.name}
                className="border-border bg-card flex flex-col gap-3.5 rounded-2xl border p-6"
              >
                <span className="border-border bg-background flex size-9.5 items-center justify-center rounded-[9px] border">
                  {track.icon}
                </span>
                <h3 className="text-[16.5px] font-bold">{track.name}</h3>
                <p className="text-muted-foreground text-[13.5px]">{track.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* No tema claro a faixa é uma lâmina escura invertida. No escuro, inverter
            devolveria uma lâmina branca ofuscante: lá ela vira superfície elevada
            com filete, mantendo o corte visual sem estourar o brilho. */}
        <section className="bg-foreground text-background dark:bg-secondary dark:text-foreground dark:border-border flex flex-wrap items-center justify-between gap-8 px-6 py-18 sm:px-10 dark:border-y">
          <h2 className="max-w-[520px] text-[clamp(1.375rem,3vw,1.875rem)] font-bold">
            Seu roadmap está a quatro perguntas de distância.
          </h2>
          <div className="flex flex-col items-start gap-2.5">
            <Link href="/register" className={ctaClass}>
              Montar meu roadmap
            </Link>
            <span className="text-background/55 dark:text-muted-foreground text-[12.5px]">
              Grátis para começar · leva cerca de 2 minutos
            </span>
          </div>
        </section>
      </main>

      <footer className="border-border text-ink-faint flex items-center justify-between border-t px-6 py-6 text-[12.5px] sm:px-10">
        <span>© estudeAI</span>
        <span className="flex gap-4.5">
          <Link href="/login" className="hover:text-foreground">
            Entrar
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Criar conta
          </Link>
        </span>
      </footer>
    </div>
  );
}
