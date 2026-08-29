export const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";

export type FondoDayRange = {
  dateKey: string;
  startIso: string;
  endIsoExclusive: string;
};

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateKey = (dateKey: string) => {
  const match = DATE_KEY_PATTERN.exec(String(dateKey || "").trim());
  if (!match) {
    throw new Error("Fecha de Fondo General inválida");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
  ) {
    throw new Error("Fecha de Fondo General inválida");
  }

  return { year, month, day };
};

const formatDateKey = (date: Date): string => {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha de Fondo General inválida");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COSTA_RICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export function buildCostaRicaDayRange(dateKey: string): FondoDayRange {
  const { year, month, day } = parseDateKey(dateKey);
  const start = new Date(`${dateKey}T00:00:00.000-06:00`);
  const nextUtcDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDateKey = [
    nextUtcDate.getUTCFullYear(),
    String(nextUtcDate.getUTCMonth() + 1).padStart(2, "0"),
    String(nextUtcDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
  const end = new Date(`${nextDateKey}T00:00:00.000-06:00`);

  return {
    dateKey,
    startIso: start.toISOString(),
    endIsoExclusive: end.toISOString(),
  };
}

export function buildCostaRicaCurrentDayRange(now: Date): FondoDayRange {
  return buildCostaRicaDayRange(formatDateKey(now));
}

export function getCostaRicaCurrentDateKey(now = new Date()): string {
  return buildCostaRicaCurrentDayRange(now).dateKey;
}
