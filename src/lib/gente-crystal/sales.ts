export const GENTE_CRYSTAL_WRITE_PERMISSION =
  "gentecrystal.sales.write" as const;

export type GenteCrystalSaleStatus = "active" | "deleted";

export interface ActiveGenteCrystalSaleInput {
  ticketId: string;
  sorteo: string;
  monto: number;
  saleAt: Date;
  status: "active";
}

export interface DeletedGenteCrystalSaleInput {
  ticketId: string;
  status: "deleted";
}

export type GenteCrystalSaleInput =
  | ActiveGenteCrystalSaleInput
  | DeletedGenteCrystalSaleInput;

export type GenteCrystalSaleAction =
  | "created"
  | "already_exists"
  | "updated"
  | "deleted";

export interface GenteCrystalSaleRecord extends Record<string, unknown> {
  ticketId: string;
  status: GenteCrystalSaleStatus;
  receivedAt: unknown;
  updatedAt: Date;
  deviceId: string;
  source: "gente-crystal";
  sorteo?: string;
  monto?: number;
  saleAt?: unknown;
}

export class GenteCrystalSaleError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "GenteCrystalSaleError";
    this.status = status;
    this.code = code;
  }
}

function invalid(code: string, field: string): never {
  throw new GenteCrystalSaleError(400, code, `Invalid ${field}.`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseGenteCrystalSale(body: unknown): GenteCrystalSaleInput {
  if (!isPlainObject(body)) invalid("invalid_body", "body");

  const rawTicketId = body.ticketId;
  if (
    typeof rawTicketId !== "string" ||
    rawTicketId.length > 80 ||
    !/^\d{4,}-\d{2,}-\d{5,}$/.test(rawTicketId)
  ) {
    invalid("invalid_ticket_id", "ticketId");
  }

  if (body.status !== "active" && body.status !== "deleted") {
    invalid("invalid_status", "status");
  }

  if (body.status === "deleted") {
    return { ticketId: rawTicketId, status: "deleted" };
  }

  if (typeof body.sorteo !== "string") {
    invalid("invalid_sorteo", "sorteo");
  }
  const sorteo = body.sorteo.trim();
  if (!sorteo || sorteo.length > 160) {
    invalid("invalid_sorteo", "sorteo");
  }

  if (
    typeof body.monto !== "number" ||
    !Number.isFinite(body.monto) ||
    body.monto <= 0 ||
    body.monto > 1_000_000_000_000
  ) {
    invalid("invalid_monto", "monto");
  }

  if (typeof body.saleAt !== "string") {
    invalid("invalid_sale_at", "saleAt");
  }
  const saleAt = new Date(body.saleAt);
  if (!Number.isFinite(saleAt.getTime())) {
    invalid("invalid_sale_at", "saleAt");
  }

  return {
    ticketId: rawTicketId,
    sorteo,
    monto: body.monto,
    saleAt,
    status: "active",
  };
}

export function readBearerToken(authorization: string | null): string {
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    throw new GenteCrystalSaleError(
      401,
      "missing_or_invalid_authorization",
      "Invalid authorization header.",
    );
  }
  return match[1];
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
}

function activeFieldsEqual(
  existing: Record<string, unknown>,
  sale: ActiveGenteCrystalSaleInput,
): boolean {
  return (
    existing.ticketId === sale.ticketId &&
    existing.status === "active" &&
    existing.sorteo === sale.sorteo &&
    existing.monto === sale.monto &&
    timestampMillis(existing.saleAt) === sale.saleAt.getTime()
  );
}

export function mergeGenteCrystalSale(
  existing: Record<string, unknown> | undefined,
  sale: GenteCrystalSaleInput,
  deviceId: string,
  now: Date,
): { action: GenteCrystalSaleAction; record?: GenteCrystalSaleRecord } {
  if (sale.status === "deleted") {
    return {
      action: "deleted",
      record: {
        ...existing,
        ticketId: sale.ticketId,
        status: "deleted",
        receivedAt: existing?.receivedAt ?? now,
        updatedAt: now,
        deviceId,
        source: "gente-crystal",
      },
    };
  }

  if (existing && activeFieldsEqual(existing, sale)) {
    return { action: "already_exists" };
  }

  return {
    action: existing ? "updated" : "created",
    record: {
      ticketId: sale.ticketId,
      sorteo: sale.sorteo,
      monto: sale.monto,
      saleAt: sale.saleAt,
      receivedAt: existing?.receivedAt ?? now,
      updatedAt: now,
      status: "active",
      deviceId,
      source: "gente-crystal",
    },
  };
}
