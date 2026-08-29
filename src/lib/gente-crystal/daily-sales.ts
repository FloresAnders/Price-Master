import {
  buildGenteCrystalDailyResult,
  GENTE_CRYSTAL_TIMEZONE,
  readGenteCrystalDate,
  type GenteCrystalDailyResult,
} from "./read-sales.ts";
import type { GenteCrystalSaleRecord } from "./sales.ts";

export type GenteCrystalDailySaleEntry = {
  sorteo: string;
  captureOrigin: "local_button" | "indirect";
  monto: number;
  saleAt: Date;
  status: "active";
};

export type GenteCrystalDailyMutation = {
  remove?: { date: string; ticketId: string };
  upsert?: {
    date: string;
    ticketId: string;
    entry: GenteCrystalDailySaleEntry;
  };
};

type GenteCrystalDailyRecord = GenteCrystalSaleRecord | Record<string, unknown>;

const costaRicaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GENTE_CRYSTAL_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isTicketId(value: unknown): value is string {
  return typeof value === "string" && /^\d{4,}-\d{2,}-\d{5,}$/.test(value);
}

export function genteCrystalCostaRicaDateKey(value: unknown): string | null {
  const date = readGenteCrystalDate(value);
  if (!date) return null;

  const parts = costaRicaDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function buildGenteCrystalDailyEntry(
  record: GenteCrystalDailyRecord | undefined,
): GenteCrystalDailySaleEntry | null {
  if (record?.status !== "active") return null;

  const sorteo = typeof record.sorteo === "string" ? record.sorteo.trim() : "";
  const saleAt = readGenteCrystalDate(record.saleAt);
  if (
    !sorteo ||
    typeof record.monto !== "number" ||
    !Number.isFinite(record.monto) ||
    record.monto <= 0 ||
    !saleAt
  ) {
    return null;
  }

  return {
    sorteo,
    captureOrigin:
      record.captureOrigin === "local_button" ? "local_button" : "indirect",
    monto: record.monto,
    saleAt,
    status: "active",
  };
}

function dailyLocation(
  record: GenteCrystalDailyRecord | undefined,
): { date: string; ticketId: string } | null {
  if (
    record?.status !== "active" ||
    !isTicketId(record.ticketId) ||
    !buildGenteCrystalDailyEntry(record)
  ) {
    return null;
  }

  const date = genteCrystalCostaRicaDateKey(record.saleAt);
  return date ? { date, ticketId: record.ticketId } : null;
}

export function planGenteCrystalDailyMutation(
  existing: GenteCrystalDailyRecord | undefined,
  resulting: GenteCrystalDailyRecord | undefined,
): GenteCrystalDailyMutation {
  const oldLocation = dailyLocation(existing);
  const resultingEntry = buildGenteCrystalDailyEntry(resulting);
  const newLocation = dailyLocation(resulting);
  const mutation: GenteCrystalDailyMutation = {};

  if (
    oldLocation &&
    (resulting?.status === "deleted" ||
      (newLocation && oldLocation.date !== newLocation.date))
  ) {
    mutation.remove = oldLocation;
  }

  if (resultingEntry && newLocation) {
    mutation.upsert = {
      ...newLocation,
      entry: resultingEntry,
    };
  }

  return mutation;
}

export function buildGenteCrystalDailyResultFromDocument(
  data: unknown,
): GenteCrystalDailyResult {
  const sales =
    data &&
    typeof data === "object" &&
    "sales" in data &&
    data.sales &&
    typeof data.sales === "object" &&
    !Array.isArray(data.sales)
      ? Object.entries(data.sales).flatMap(([ticketId, entry]) =>
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? [{ ...entry, ticketId }]
            : [],
        )
      : [];

  return buildGenteCrystalDailyResult(sales);
}
