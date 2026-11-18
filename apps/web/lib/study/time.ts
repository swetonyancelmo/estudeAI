/** Dia local do navegador (YYYY-MM-DD) — o "dia" de quem estuda. */
export function localToday(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fuso IANA do navegador ("America/Sao_Paulo"). */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Minutos por extenso curto: "45 min", "2 h", "2 h 15 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "16/11" a partir de YYYY-MM-DD, sem passar por Date (sem susto de fuso). */
export function shortDate(day: string): string {
  const [, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}`;
}
