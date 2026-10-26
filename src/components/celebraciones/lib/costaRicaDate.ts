import type { CostaRicaDateParts } from "../types";

export const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: COSTA_RICA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getCostaRicaDateParts(date: Date): CostaRicaDateParts {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Fecha inválida");
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, Number(part.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function formatDateKey(parts: CostaRicaDateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function addCalendarDays(
  parts: CostaRicaDateParts,
  days: number,
): CostaRicaDateParts {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function toEpochDay(parts: CostaRicaDateParts): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

export function getNextCostaRicaMidnightTimestamp(date: Date): number {
  const start = date.getTime();
  const currentKey = formatDateKey(getCostaRicaDateParts(date));
  let low = start;
  let high = start + 30 * 60 * 60 * 1000;
  while (formatDateKey(getCostaRicaDateParts(new Date(high))) === currentKey) {
    high += 24 * 60 * 60 * 1000;
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (formatDateKey(getCostaRicaDateParts(new Date(middle))) === currentKey) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return high;
}
