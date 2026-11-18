"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { StudyDayDto } from "@estudeai/shared-types";
import { formatMinutes, shortDate } from "@/lib/study/time";

/** Semanas mostradas no mapa (pouco mais de 6 meses). */
const WEEKS = 26;
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Faixas de minutos por dia → intensidade (0 a 4). Escala de uma cor só, a da
 * trilha, do claro ao escuro; 0 é a superfície neutra.
 */
const LEVELS = [
  { min: 60, level: 4 },
  { min: 30, level: 3 },
  { min: 15, level: 2 },
  { min: 1, level: 1 },
];
const LEVEL_FILL = [
  "var(--muted)",
  "color-mix(in oklab, var(--line) 30%, var(--card))",
  "color-mix(in oklab, var(--line) 55%, var(--card))",
  "color-mix(in oklab, var(--line) 78%, var(--card))",
  "var(--line)",
];

function levelOf(minutes: number): number {
  return LEVELS.find((band) => minutes >= band.min)?.level ?? 0;
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

interface Tip {
  x: number;
  y: number;
  day: string;
  minutes: number;
}

/**
 * Mapa de dias estudados (Fase 5): uma coluna por semana, de segunda a
 * domingo, nas últimas 26 semanas, em todos os roadmaps da pessoa.
 */
export function StudyHeatmap({
  days,
  today,
}: {
  days: StudyDayDto[];
  today: string;
}) {
  const minutesByDay = useMemo(
    () => new Map(days.map((item) => [item.day, item.minutes])),
    [days],
  );
  const firstMonday = addDays(mondayOf(today), -7 * (WEEKS - 1));
  const columns = Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => addDays(firstMonday, week * 7 + weekday)),
  );
  const studiedDays = days.filter((item) => item.day >= firstMonday).length;
  // Rótulo do mês na primeira coluna de cada mês, pulando quando ficaria a
  // menos de 3 colunas do anterior (senão "mai" e "jun" se sobrepõem).
  const monthLabels: string[] = [];
  let lastLabeled = -3;
  columns.forEach((column, index) => {
    const month = Number(column[0].slice(5, 7)) - 1;
    const previous = index > 0 ? Number(columns[index - 1][0].slice(5, 7)) - 1 : -1;
    const startsMonth = month !== previous;
    const roomBefore = index - lastLabeled >= 3;
    const nextStartsSoon = index === 0 && Number(columns[2][0].slice(5, 7)) - 1 !== month;
    if (startsMonth && roomBefore && !nextStartsSoon) {
      monthLabels.push(MONTHS[month]);
      lastLabeled = index;
    } else {
      monthLabels.push("");
    }
  });
  const [tip, setTip] = useState<Tip | null>(null);
  // Em tela estreita o mapa rola; ele abre no fim, nas semanas recentes.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  function showTip(event: PointerEvent<HTMLDivElement>, day: string) {
    const box = event.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
    const cell = event.currentTarget.getBoundingClientRect();
    setTip({
      x: cell.left - box.left + cell.width / 2,
      y: cell.top - box.top,
      day,
      minutes: minutesByDay.get(day) ?? 0,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="relative w-max">
          {/* Meses: o rótulo aparece na primeira semana de cada mês. */}
          <div className="text-ink-faint mb-1 ml-8 flex gap-[3px] text-xs" aria-hidden="true">
            {columns.map((column, index) => (
              <span key={column[0]} className="w-3 overflow-visible whitespace-nowrap">
                {monthLabels[index]}
              </span>
            ))}
          </div>
          <div
            role="img"
            aria-label={`${studiedDays} ${studiedDays === 1 ? "dia" : "dias"} com estudo nas últimas ${WEEKS} semanas`}
            className="flex gap-[3px]"
            onPointerLeave={() => setTip(null)}
          >
            {/* Fixa à esquerda: com o mapa rolado, os dias da semana continuam visíveis. */}
            <div
              className="text-ink-faint bg-card sticky left-0 z-[1] mr-1 flex w-7 flex-col gap-[3px] text-xs"
              aria-hidden="true"
            >
              {WEEKDAYS.map((name, index) => (
                <span key={name} className="h-3 leading-3">
                  {index % 2 === 0 ? name : ""}
                </span>
              ))}
            </div>
            {columns.map((column) => (
              <div key={column[0]} className="flex flex-col gap-[3px]" aria-hidden="true">
                {column.map((day) =>
                  day > today ? (
                    <div key={day} className="size-3" />
                  ) : (
                    <div
                      key={day}
                      className="size-3 rounded-[3px] transition-[filter] hover:brightness-110 hover:outline hover:outline-1 hover:outline-[var(--foreground)]"
                      style={{ background: LEVEL_FILL[levelOf(minutesByDay.get(day) ?? 0)] }}
                      onPointerEnter={(event) => showTip(event, day)}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
          {tip && (
            <div
              className="bg-foreground text-background pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md px-2 py-1 text-xs whitespace-nowrap shadow"
              style={{ left: tip.x, top: tip.y - 6 }}
            >
              <strong className="font-semibold">
                {tip.minutes > 0 ? formatMinutes(tip.minutes) : "Sem estudo"}
              </strong>{" "}
              · {shortDate(tip.day)}
            </div>
          )}
        </div>
      </div>

      <div className="text-ink-faint flex items-center gap-2 text-xs">
        <span>Menos</span>
        {LEVEL_FILL.map((fill, index) => (
          <span
            key={index}
            className="size-3 rounded-[3px]"
            style={{ background: fill }}
            aria-hidden="true"
          />
        ))}
        <span>Mais</span>
        <span className="sr-only">
          Faixas: nenhum estudo, até 14 min, 15 a 29 min, 30 a 59 min, 1 h ou mais.
        </span>
      </div>
    </div>
  );
}
