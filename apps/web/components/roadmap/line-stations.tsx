import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pontas da linha (D17), desenhadas à mão como o resto do trilho: o shadcn
 * não tem estação de metrô.
 */

/**
 * Estação terminal: círculo de 32px com anel duplo, neutro enquanto a rota
 * não termina e preenchido na cor da linha depois. O miolo usa tinta no
 * escuro, pelo mesmo motivo do check das paradas (contraste sobre `bg-line`).
 */
export function TerminalMarker({
  reached = false,
  small = false,
}: {
  reached?: boolean;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-background flex shrink-0 items-center justify-center rounded-full",
        small ? "size-5 border-2" : "size-8 border-[3px]",
        reached ? "border-line bg-line" : "border-input",
      )}
    >
      <span
        className={cn(
          "rounded-full",
          small ? "size-2 border-2" : "size-3.5 border-[3px]",
          reached ? "border-white dark:border-primary-foreground" : "border-input",
        )}
      />
    </span>
  );
}

/** Trecho do trilho até a próxima estação: cheio se já percorrido. */
export function RailSegment({ travelled }: { travelled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "my-1 w-0 flex-1 border-l-[3px]",
        travelled ? "border-line" : "border-input border-dashed",
      )}
    />
  );
}

/** Estação de origem: "Início", com a data em que o roadmap foi criado. */
export function OriginStation({
  createdAt,
  started,
}: {
  createdAt: string;
  started: boolean;
}) {
  const date = new Date(createdAt).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <li className="flex gap-4 sm:gap-6">
      <div className="flex w-8 shrink-0 flex-col items-center" aria-hidden="true">
        <span className="bg-line mt-1 size-4 shrink-0 rounded-full" />
        <RailSegment travelled={started} />
      </div>
      <div className="flex flex-col gap-0.5 pb-6">
        <p className="font-heading text-lg leading-tight font-bold">Início</p>
        <p className="data-label text-ink-faint">desde {date}</p>
      </div>
    </li>
  );
}

/**
 * Estação terminal: "Fim da linha" e o tamanho total da rota. Acende e ganha
 * o link para a evolução quando a rota termina. O objetivo do wizard não vem
 * no detalhe (pendência P8), então o nome fica genérico.
 */
export function TerminalStation({
  roadmapId,
  stations,
  totalHours,
  reached,
}: {
  roadmapId: string;
  stations: number;
  totalHours: number;
  reached: boolean;
}) {
  return (
    <li className="flex gap-4 sm:gap-6">
      <div className="flex w-8 shrink-0 flex-col items-center">
        <TerminalMarker reached={reached} />
      </div>
      <div className="flex flex-col gap-1 pt-0.5">
        <p className="font-heading text-xl leading-tight font-bold">
          Fim da linha
          {reached && <span className="sr-only"> (alcançado)</span>}
        </p>
        <p className="data-label text-ink-faint">
          {stations} {stations === 1 ? "estação" : "estações"} · ~{totalHours}h no total
        </p>
        {reached && (
          <Link
            href={`/roadmaps/${roadmapId}/evolucao`}
            className="text-brand-ink hover:bg-muted -ml-2 flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors"
          >
            Ver sua evolução
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </li>
  );
}
