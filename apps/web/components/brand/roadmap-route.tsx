import { cn } from "@/lib/utils";

/**
 * Motivo visual central da identidade: o roadmap desenhado como uma rota.
 * Trecho percorrido no acento da marca, trecho pendente em traço neutro, e o
 * destino final pontilhado (ainda não alcançado). O mesmo motivo reaparece no
 * dashboard, então a metáfora se sustenta entre a landing e o produto.
 */
export function RoadmapRouteHero({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 860 170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Rota do roadmap: diagnóstico, fundamentos, trilha escolhida entre frontend, backend ou fullstack, e o primeiro projeto"
      className={cn("h-auto w-full", className)}
    >
      {/* trecho já percorrido */}
      <path d="M40 85 C 130 85, 150 85, 230 85" className="stroke-brand" strokeWidth="2" />
      <path d="M230 85 C 300 85, 300 85, 360 85" className="stroke-brand" strokeWidth="2" />

      {/* leque das três trilhas */}
      <path d="M360 85 C 420 85, 430 30, 500 30" className="stroke-border" strokeWidth="2" />
      <path d="M360 85 C 420 85, 430 85, 500 85" className="stroke-border" strokeWidth="2" />
      <path d="M360 85 C 420 85, 430 140, 500 140" className="stroke-border" strokeWidth="2" />
      <path d="M500 30 C 570 30, 580 85, 650 85" className="stroke-border" strokeWidth="2" />
      <path d="M500 85 C 570 85, 580 85, 650 85" className="stroke-border" strokeWidth="2" />
      <path d="M500 140 C 570 140, 580 85, 650 85" className="stroke-border" strokeWidth="2" />
      <path d="M650 85 C 720 85, 740 85, 800 85" className="stroke-border" strokeWidth="2" />

      <circle cx="40" cy="85" r="6" className="fill-brand" />
      <circle cx="230" cy="85" r="6" className="fill-brand" />
      <circle cx="360" cy="85" r="5.5" className="fill-card stroke-ink-faint" strokeWidth="2" />
      <circle cx="500" cy="30" r="5" className="fill-card stroke-ink-faint" strokeWidth="2" />
      <circle cx="500" cy="85" r="5" className="fill-card stroke-ink-faint" strokeWidth="2" />
      <circle cx="500" cy="140" r="5" className="fill-card stroke-ink-faint" strokeWidth="2" />
      <circle cx="650" cy="85" r="5.5" className="fill-card stroke-ink-faint" strokeWidth="2" />
      <circle
        cx="800"
        cy="85"
        r="6"
        className="stroke-ink-faint"
        strokeWidth="2"
        strokeDasharray="2 3"
      />

      {/* Abaixo de `sm` a escala derruba os rótulos para ~6px: some com eles e
          deixa o traçado falar sozinho, em vez de exibir texto ilegível. */}
      <g className="fill-ink-faint font-mono text-[11px] max-sm:hidden">
        <text x="40" y="112" textAnchor="middle">
          diagnóstico
        </text>
        <text x="230" y="112" textAnchor="middle">
          fundamentos
        </text>
        <text x="500" y="20" textAnchor="middle">
          frontend
        </text>
        <text x="500" y="108" textAnchor="middle">
          backend
        </text>
        <text x="500" y="163" textAnchor="middle">
          fullstack
        </text>
        <text x="800" y="112" textAnchor="middle">
          1º projeto
        </text>
      </g>
    </svg>
  );
}

/**
 * Variante do estado vazio: a mesma rota, ainda não percorrida — só o ponto de
 * partida está aceso. Comunica "você está no começo" sem precisar de texto.
 */
export function RoadmapRouteEmpty({ className }: { className?: string }) {
  return (
    <svg
      /* Folga lateral no viewBox: os rótulos das pontas são centralizados nos
         nós extremos e vazariam a caixa, ficando cortados. */
      viewBox="-35 0 480 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Rota ainda não iniciada: você está no ponto de partida"
      className={cn("h-auto w-full", className)}
    >
      <path
        d="M20 45 C 90 45, 100 45, 160 45"
        className="stroke-border"
        strokeWidth="2"
        strokeDasharray="1 6"
        strokeLinecap="round"
      />
      <path
        d="M160 45 C 220 45, 230 45, 290 45"
        className="stroke-border"
        strokeWidth="2"
        strokeDasharray="1 6"
        strokeLinecap="round"
      />
      <path
        d="M290 45 C 340 45, 350 45, 400 45"
        className="stroke-border"
        strokeWidth="2"
        strokeDasharray="1 6"
        strokeLinecap="round"
      />

      <circle cx="20" cy="45" r="6" className="fill-brand" />
      <circle cx="160" cy="45" r="5" className="fill-card stroke-ink-faint" strokeWidth="2" />
      <circle cx="290" cy="45" r="5" className="fill-card stroke-ink-faint" strokeWidth="2" />
      <circle
        cx="400"
        cy="45"
        r="5"
        className="stroke-ink-faint"
        strokeWidth="2"
        strokeDasharray="2 3"
      />

      <g className="fill-ink-faint font-mono text-[10.5px]">
        <text x="20" y="68" textAnchor="middle">
          você está aqui
        </text>
        <text x="400" y="68" textAnchor="middle">
          1º projeto
        </text>
      </g>
    </svg>
  );
}
