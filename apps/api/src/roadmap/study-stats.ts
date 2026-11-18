/**
 * Cálculos da evolução (Fase 5). Funções puras sobre datas no formato
 * YYYY-MM-DD — o dia LOCAL de quem estuda —, sem Nest e sem banco, para
 * serem testadas por tabela.
 */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Semanas mostradas no gráfico semanal. */
export const STATS_WEEKS = 8;
/** Semanas usadas para medir o ritmo recente. */
export const PACE_WEEKS = 4;

export function isValidDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  return new Date(date.getTime() + amount * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** Segunda-feira da semana do dia (semana de segunda a domingo). */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDays(day, -((weekday + 6) % 7));
}

/**
 * O dia aceito como "hoje" de quem pediu: no máximo 1 dia de distância do dia
 * UTC do servidor (cobre todos os fusos). Fora disso o relógio do cliente
 * está errado, e o dia não vale.
 */
export function isPlausibleToday(day: string, now: Date = new Date()): boolean {
  if (!isValidDay(day)) return false;
  const utcToday = now.toISOString().slice(0, 10);
  return day >= addDays(utcToday, -1) && day <= addDays(utcToday, 1);
}

/** Dia local de um instante num fuso IANA ("America/Sao_Paulo"). */
export function localDay(instant: Date, timeZone: string): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sequência atual e melhor sequência de dias com estudo.
 *
 * A atual conta até hoje; se hoje ainda não teve estudo, conta até ontem —
 * de manhã cedo a sequência não "quebra" só porque o dia ainda não começou.
 */
export function streaks(
  studiedDays: Iterable<string>,
  today: string,
): { current: number; best: number } {
  const days = new Set(studiedDays);

  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // não é início de sequência
    let length = 0;
    let next = day;
    while (days.has(next)) {
      length++;
      next = addDays(next, 1);
    }
    best = Math.max(best, length);
  }

  return { current, best };
}

/**
 * As últimas `count` semanas (segunda a domingo), da mais antiga à atual, com
 * os minutos estudados e os tópicos concluídos em cada uma.
 */
export function weekly(
  today: string,
  minutesByDay: Map<string, number>,
  completedDays: string[],
  count: number = STATS_WEEKS,
): { weekStart: string; minutes: number; topicsCompleted: number }[] {
  const currentMonday = mondayOf(today);
  const weeks = Array.from({ length: count }, (_, index) => ({
    weekStart: addDays(currentMonday, -7 * (count - 1 - index)),
    minutes: 0,
    topicsCompleted: 0,
  }));
  const byStart = new Map(weeks.map((week) => [week.weekStart, week]));

  for (const [day, minutes] of minutesByDay) {
    const week = byStart.get(mondayOf(day));
    if (week) week.minutes += minutes;
  }
  for (const day of completedDays) {
    const week = byStart.get(mondayOf(day));
    if (week) week.topicsCompleted++;
  }
  return weeks;
}

/**
 * Ritmo recente (média de minutos por semana nas últimas `PACE_WEEKS`,
 * contando a atual) e quantas semanas faltam nesse ritmo.
 */
export function pace(
  weeks: { minutes: number }[],
  remainingHours: number,
): { recentWeeklyMinutes: number; weeksAtRecentPace: number | null } {
  const recent = weeks.slice(-PACE_WEEKS);
  const total = recent.reduce((sum, week) => sum + week.minutes, 0);
  const recentWeeklyMinutes = Math.round(total / Math.max(recent.length, 1));
  return {
    recentWeeklyMinutes,
    weeksAtRecentPace:
      recentWeeklyMinutes > 0 && remainingHours > 0
        ? Math.ceil((remainingHours * 60) / recentWeeklyMinutes)
        : remainingHours === 0
          ? 0
          : null,
  };
}
