"use client";

import { useState } from "react";
import type { StudyWeekDto } from "@estudeai/shared-types";
import { cn } from "@/lib/utils";
import { formatMinutes, shortDate } from "@/lib/study/time";

const PLOT_HEIGHT = 160;

/**
 * Minutos por semana neste roadmap, nas últimas 8 semanas, contra a meta do
 * wizard (linha tracejada: aqui o tracejado diz exatamente "meta"). Uma série
 * só, então sem legenda: o título nomeia. Valor escrito só na semana atual; os
 * demais ficam no tooltip (mouse e teclado) e na tabela.
 */
export function WeeklyChart({
  weeks,
  goalMinutes,
}: {
  weeks: StudyWeekDto[];
  goalMinutes: number | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = Math.max(goalMinutes ?? 0, ...weeks.map((week) => week.minutes), 60) * 1.15;
  const heightOf = (minutes: number) => (minutes / top) * PLOT_HEIGHT;
  const current = weeks.length - 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative" style={{ height: PLOT_HEIGHT }} onPointerLeave={() => setActive(null)}>
        {/* Linha de base, sólida e discreta. */}
        <div className="bg-border absolute inset-x-0 bottom-0 h-px" aria-hidden="true" />
        {goalMinutes !== null && (
          <div
            className="border-ink-faint absolute inset-x-0 border-t border-dashed"
            style={{ bottom: heightOf(goalMinutes) }}
            aria-hidden="true"
          >
            <span className="text-ink-faint bg-card absolute -top-2.5 right-0 pl-1.5 text-xs">
              Meta {formatMinutes(goalMinutes)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 grid grid-cols-8 gap-0.5">
          {weeks.map((week, index) => (
            <button
              key={week.weekStart}
              type="button"
              className="group relative flex h-full items-end justify-center outline-none"
              aria-label={`Semana de ${shortDate(week.weekStart)}: ${formatMinutes(week.minutes)}, ${week.topicsCompleted} ${week.topicsCompleted === 1 ? "tópico concluído" : "tópicos concluídos"}`}
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <span
                className={cn(
                  "bg-line block w-full max-w-7 rounded-t-[4px] transition-[filter]",
                  index !== current && "opacity-60",
                  active === index && "brightness-110",
                  "group-focus-visible:outline-ring group-focus-visible:outline-2 group-focus-visible:outline-offset-2",
                )}
                style={{ height: Math.max(heightOf(week.minutes), week.minutes > 0 ? 2 : 0) }}
              />
              {index === current && week.minutes > 0 && active === null && (
                <span
                  className="text-foreground absolute right-0 text-xs font-semibold whitespace-nowrap"
                  style={{ bottom: heightOf(week.minutes) + 4 }}
                >
                  {formatMinutes(week.minutes)}
                </span>
              )}
              {active === index && (
                <span
                  role="tooltip"
                  className={cn(
                    "bg-foreground text-background pointer-events-none absolute z-10 rounded-md px-2 py-1 text-left text-xs whitespace-nowrap shadow",
                    // Perto das bordas a dica abre para dentro do gráfico.
                    index === 0 && "left-0",
                    index === weeks.length - 1 && "right-0",
                  )}
                  style={{ bottom: heightOf(week.minutes) + 6 }}
                >
                  <strong className="block font-semibold">{formatMinutes(week.minutes)}</strong>
                  {week.topicsCompleted}{" "}
                  {week.topicsCompleted === 1 ? "tópico concluído" : "tópicos concluídos"}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="text-ink-faint grid grid-cols-8 gap-0.5 text-center text-xs" aria-hidden="true">
        {weeks.map((week, index) => (
          <span key={week.weekStart} className={cn(index === current && "text-foreground font-medium")}>
            {index === current ? "esta" : shortDate(week.weekStart)}
          </span>
        ))}
      </div>
    </div>
  );
}
