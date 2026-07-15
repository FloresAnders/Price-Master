import type { AccountingDate, AccountingInvoice } from "@/types/accounting";

export type AccountSide = "cliente" | "proveedor";

export const money = (value: number, currency = "CRC") =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CRC" ? 0 : 2,
  }).format(Number(value) || 0);

const toDate = (value: AccountingDate) => {
  if (typeof value === "string") return new Date(`${value.slice(0, 10)}T12:00:00`);
  if (value instanceof Date) return value;
  return value.toDate();
};

export const dateLabel = (value: AccountingDate) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeZone: "America/Costa_Rica" }).format(
    toDate(value),
  );
};

export const dateKey = (value: AccountingDate) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toDate(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const todayKey = () => dateKey(new Date());

export type CurrencyTotals = { CRC: number; USD: number };
export const emptyCurrencyTotals = (): CurrencyTotals => ({ CRC: 0, USD: 0 });
export const sumByCurrency = (invoices: AccountingInvoice[], select: (invoice: AccountingInvoice) => number = (invoice) => invoice.saldo) =>
  invoices.reduce<CurrencyTotals>((totals, invoice) => {
    totals[invoice.moneda] += select(invoice);
    return totals;
  }, emptyCurrencyTotals());

export const effectiveStatus = (invoice: AccountingInvoice) => {
  if (invoice.estado !== "Pagada" && dateKey(invoice.fechaVencimiento) < todayKey()) {
    return "Vencida" as const;
  }
  return invoice.estado;
};

export const statusClass: Record<string, string> = {
  Pagada: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  Parcial: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Vencida: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  Pendiente: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

export const fieldClass =
  "w-full rounded-xl border border-[var(--input-border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

export const primaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50";
