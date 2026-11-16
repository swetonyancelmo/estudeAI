import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
}

/**
 * Símbolo do estudeAI: uma linha de rota que desenha um "e", com duas
 * estações e um nó final com "raios" (a parte de IA).
 *
 * Inline (e não <img>) para seguir o tema: o traço usa --brand, as estações
 * usam --background e o nó final usa a cor do texto (currentColor).
 * Fonte: estudeai-logo/estudeai-icon-light.svg
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="14 14 126 92"
      className={cn("h-7 w-auto shrink-0 text-foreground", className)}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M26 60 H94 A34 34 0 1 0 86.05 81.85"
        stroke="var(--brand)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="26"
        cy="60"
        r="6"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="4"
      />
      <circle
        cx="60"
        cy="26"
        r="6"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="4"
      />
      <circle cx="86.05" cy="81.85" r="9" fill="currentColor" />
      <circle cx="86.05" cy="81.85" r="4.2" fill="var(--brand)" />
      <g stroke="currentColor" strokeWidth="4.5" strokeLinecap="round">
        <line x1="100.4" y1="83.87" x2="106.35" y2="84.71" />
        <line x1="97.15" y1="91.18" x2="101.75" y2="95.03" />
        <line x1="90.53" y1="95.65" x2="92.38" y2="101.35" />
      </g>
    </svg>
  );
}
