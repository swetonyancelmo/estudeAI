import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** Estações do painel lateral: a mesma linha que o usuário vai percorrer. */
const STATIONS = [
  { label: "Diagnóstico", hint: "até 6 perguntas, 2 minutos", state: "done" },
  { label: "Sua trilha", hint: "Frontend, Backend ou Fullstack", state: "current" },
  { label: "Módulos e tópicos", hint: "com horas e materiais", state: "upcoming" },
  { label: "1º projeto", hint: "o destino da rota", state: "destination" },
] as const;

/**
 * Login e cadastro em layout dividido: formulário à esquerda e, no desktop, um
 * painel de marca com a linha do produto. No celular o painel some e o
 * formulário ocupa a tela.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <div className="flex flex-col">
        <header className="flex items-center justify-between px-5 py-3 sm:px-10">
          <Wordmark href="/" />
          <ThemeToggle className="-mr-2.5" />
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-5 pt-6 pb-20 sm:px-10">
          {children}
        </main>
      </div>

      <aside
        className="bg-foreground text-background dark:bg-card dark:text-foreground dark:border-border hidden flex-col justify-center gap-12 px-14 py-16 lg:flex dark:border-l"
        aria-hidden="true"
      >
        <p className="font-heading max-w-md text-3xl font-extrabold tracking-tight">
          Sua rota fica salva aqui.{" "}
          <span className="text-brand">Volte e siga da última parada.</span>
        </p>

        <ol className="flex flex-col">
          {STATIONS.map((station, index) => {
            const isLast = index === STATIONS.length - 1;
            return (
              <li key={station.label} className="flex gap-5">
                <div className="flex w-6 flex-col items-center">
                  <span
                    className={
                      station.state === "done"
                        ? "bg-brand size-6 shrink-0 rounded-full"
                        : station.state === "current"
                          ? "border-brand size-6 shrink-0 rounded-full border-[3px]"
                          : station.state === "destination"
                            ? "size-6 shrink-0 rounded-full border-[3px] border-dashed border-current opacity-50"
                            : "size-6 shrink-0 rounded-full border-[3px] border-current opacity-50"
                    }
                  />
                  {!isLast && (
                    <span
                      className={
                        station.state === "done"
                          ? "border-brand my-1 min-h-10 flex-1 border-l-[3px]"
                          : "my-1 min-h-10 flex-1 border-l-[3px] border-dashed border-current opacity-30"
                      }
                    />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 pb-6">
                  <span className="font-heading text-xl font-bold">
                    {station.label}
                  </span>
                  <span className="font-mono text-xs opacity-70">
                    {station.hint}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
