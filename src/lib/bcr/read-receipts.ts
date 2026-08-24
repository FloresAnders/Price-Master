import { normalizeUserPermissions } from "../../utils/permissions.ts";

export const BCR_TIMEZONE = "America/Costa_Rica" as const;

export type BcrReadUser = {
  id?: string;
  role?: "admin" | "user" | "superadmin";
  ownerId?: string;
  ownercompanie?: string;
  eliminate?: boolean;
  isActive?: boolean;
  permissions?: { reportetiempos?: unknown };
};

export type BcrReadCompany = {
  id: string;
  name?: string;
  ubicacion?: string;
  ownerId?: string;
  horarioApertura?: string;
  horarioCierre?: string;
  cierreFondoVentasMinutesBeforeEnd?: number;
  cierreFondoVentasMinutesAfterEnd?: number;
};

export type BcrDayRange = { date: string; start: Date; end: Date };

export type BcrPublicReceipt = {
  monto: number;
  paidAt: string;
};

export type BcrDailyResult = {
  summary: { count: number; total: number };
  receipts: BcrPublicReceipt[];
};

export class BcrReceiptsReadError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "BcrReceiptsReadError";
    this.status = status;
    this.code = code;
  }
}

function invalidQuery(code: string, field: string): never {
  throw new BcrReceiptsReadError(400, code, `Invalid ${field}.`);
}

const normalizeKey = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export function readBcrCompanyDocumentId(value: string | null): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || normalized.includes("/")) {
    invalidQuery("invalid_company_id", "companyId");
  }
  return normalized;
}

export function buildBcrCostaRicaDayRange(date: string): BcrDayRange {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) invalidQuery("invalid_date", "date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    invalidQuery("invalid_date", "date");
  }
  const start = new Date(Date.UTC(year, month - 1, day, 6));
  return { date, start, end: new Date(start.getTime() + 86_400_000) };
}

export function canReadBcrCompany(
  user: BcrReadUser,
  company: BcrReadCompany,
): boolean {
  const permissions = normalizeUserPermissions(user.permissions, user.role || "user");
  if (!permissions.reportetiempos) return false;
  if (user.role === "superadmin") return true;

  if (user.role === "admin") {
    const allowedOwners = new Set<string>();
    const ownerId = normalizeKey(user.ownerId);
    const userId = normalizeKey(user.id);
    if (ownerId) allowedOwners.add(ownerId);
    if (user.eliminate === false && userId) allowedOwners.add(userId);
    return allowedOwners.has(normalizeKey(company.ownerId));
  }

  if (user.role !== "user") return false;
  const assigned = normalizeKey(user.ownercompanie);
  if (!assigned) return false;
  return [company.id, company.name, company.ubicacion]
    .map(normalizeKey)
    .filter(Boolean)
    .includes(assigned);
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const converted = value.toDate();
    return converted instanceof Date && Number.isFinite(converted.getTime())
      ? converted
      : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const converted = new Date(value);
    return Number.isFinite(converted.getTime()) ? converted : null;
  }
  return null;
}

export function buildBcrDailyResult(
  records: Array<Record<string, unknown>>,
): BcrDailyResult {
  const receipts = records.reduce<BcrPublicReceipt[]>((result, record) => {
    const receiptId = typeof record.receiptId === "string" ? record.receiptId : "";
    const monto = record.monto;
    const paidAt = readDate(record.paidAt);
    if (
      !/^[a-f0-9]{64}$/.test(receiptId) ||
      typeof monto !== "number" ||
      !Number.isFinite(monto) ||
      monto <= 0 ||
      !paidAt
    ) {
      return result;
    }
    result.push({ monto, paidAt: paidAt.toISOString() });
    return result;
  }, []);

  receipts.sort((left, right) => right.paidAt.localeCompare(left.paidAt));
  return {
    summary: {
      count: receipts.length,
      total: receipts.reduce((total, receipt) => total + receipt.monto, 0),
    },
    receipts,
  };
}
