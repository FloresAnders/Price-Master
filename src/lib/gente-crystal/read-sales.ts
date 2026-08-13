export const GENTE_CRYSTAL_TIMEZONE = "America/Costa_Rica" as const;

export type GenteCrystalReadUser = {
  id?: string;
  role?: "admin" | "user" | "superadmin";
  ownerId?: string;
  ownercompanie?: string;
  eliminate?: boolean;
  isActive?: boolean;
  permissions?: { tiempos?: boolean };
};

export type GenteCrystalReadCompany = {
  id: string;
  name?: string;
  ubicacion?: string;
  ownerId?: string;
};

export type GenteCrystalDayRange = {
  date: string;
  start: Date;
  end: Date;
};

export type GenteCrystalPublicSale = {
  ticketId: string;
  sorteo: string;
  monto: number;
  saleAt: string;
};

export type GenteCrystalDailyResult = {
  summary: { count: number; total: number };
  sales: GenteCrystalPublicSale[];
};

export class GenteCrystalSalesReadError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GenteCrystalSalesReadError";
    this.status = status;
    this.code = code;
  }
}

function invalidQuery(code: string, field: string): never {
  throw new GenteCrystalSalesReadError(400, code, `Invalid ${field}.`);
}

function normalizeKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function readCompanyDocumentId(value: string | null): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || normalized.includes("/")) {
    invalidQuery("invalid_company_id", "companyId");
  }
  return normalized;
}

export function buildCostaRicaDayRange(date: string): GenteCrystalDayRange {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) invalidQuery("invalid_date", "date");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    invalidQuery("invalid_date", "date");
  }

  const start = new Date(Date.UTC(year, month - 1, day, 6));
  return {
    date,
    start,
    end: new Date(start.getTime() + 86_400_000),
  };
}

export function canReadGenteCrystalCompany(
  user: GenteCrystalReadUser,
  company: GenteCrystalReadCompany,
): boolean {
  if (user.role === "superadmin") return true;

  if (user.role === "admin") {
    const allowedOwners = new Set<string>();
    const ownerId = normalizeKey(user.ownerId);
    const userId = normalizeKey(user.id);
    if (ownerId) allowedOwners.add(ownerId);
    if (user.eliminate === false && userId) allowedOwners.add(userId);
    return allowedOwners.has(normalizeKey(company.ownerId));
  }

  if (user.role !== "user" || user.permissions?.tiempos !== true) return false;
  const assigned = normalizeKey(user.ownercompanie);
  if (!assigned) return false;
  return [company.id, company.name, company.ubicacion]
    .map(normalizeKey)
    .filter(Boolean)
    .includes(assigned);
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
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

export function buildGenteCrystalDailyResult(
  records: Array<Record<string, unknown>>,
): GenteCrystalDailyResult {
  const sales = records.reduce<GenteCrystalPublicSale[]>((result, record) => {
    if (record.status !== "active") return result;
    const ticketId = typeof record.ticketId === "string" ? record.ticketId : "";
    const sorteo = typeof record.sorteo === "string" ? record.sorteo.trim() : "";
    const monto = record.monto;
    const saleAt = readDate(record.saleAt);
    if (
      !/^\d{4,}-\d{2,}-\d{5,}$/.test(ticketId) ||
      !sorteo ||
      typeof monto !== "number" ||
      !Number.isFinite(monto) ||
      monto <= 0 ||
      !saleAt
    ) {
      return result;
    }
    result.push({ ticketId, sorteo, monto, saleAt: saleAt.toISOString() });
    return result;
  }, []);

  sales.sort((left, right) => right.saleAt.localeCompare(left.saleAt));
  return {
    summary: {
      count: sales.length,
      total: sales.reduce((total, sale) => total + sale.monto, 0),
    },
    sales,
  };
}
