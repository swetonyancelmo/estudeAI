import { cn } from "@/lib/utils";

/**
 * Ícones próprios da marca, no mesmo traço da rota (2px, pontas redondas).
 * Substituem os clichês de "produto com IA" (faíscas, varinha): aqui o
 * vocabulário é o do mapa — bifurcação, desvio, destino.
 */
interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

/** Bifurcação: um caminho que se abre em dois — "gerar a rota". */
export function ForkIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 12h5c4 0 4-6 8-6h2M8 12c4 0 4 6 8 6h2" />
      <circle cx="20" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Desvio: a linha contorna um ponto e segue — "reajustar a rota". */
export function RerouteIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 17h4c3 0 3-9 6-9s3 9 6 9h2" />
      <path d="m18.5 14 2.5 3-2.5 3" />
    </Svg>
  );
}

/** Destino: estação final com anel. */
export function DestinationIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 12h8" />
      <circle cx="16" cy="12" r="5" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}
