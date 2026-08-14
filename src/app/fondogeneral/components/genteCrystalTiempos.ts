import type { Empresas, User } from "../../../types/firestore.ts";
import type { GenteCrystalDailySalesResponse } from "../../../services/gente-crystal-sales.ts";

export type GenteCrystalCompanyOption = {
  value: string;
  label: string;
  aliases: string[];
};

export function genteCrystalSaleOriginMarker(
  captureOrigin: "local_button" | "indirect",
): "" | "(i)" {
  return captureOrigin === "indirect" ? "(i)" : "";
}

function ticketSequence(ticketId: string): number | null {
  const match = /-(\d+)$/.exec(ticketId);
  const sequence = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(sequence) ? sequence : null;
}

export function buildGenteCrystalDisplayResult(
  result: GenteCrystalDailySalesResponse,
): GenteCrystalDailySalesResponse {
  const localSequences = new Set(
    result.sales
      .filter((sale) => sale.captureOrigin === "local_button")
      .map((sale) => ticketSequence(sale.ticketId))
      .filter((sequence): sequence is number => sequence !== null),
  );
  const sales = result.sales.map((sale) => {
    if (sale.captureOrigin !== "indirect") return sale;
    const sequence = ticketSequence(sale.ticketId);
    const hasLocalNeighbor =
      sequence !== null &&
      (localSequences.has(sequence - 1) || localSequences.has(sequence + 1));
    return hasLocalNeighbor
      ? { ...sale, captureOrigin: "local_button" as const }
      : sale;
  });
  const indirectSales = sales.filter(
    (sale) => sale.captureOrigin === "indirect",
  );

  return {
    ...result,
    summary: {
      ...result.summary,
      indirectCount: indirectSales.length,
      indirectTotal: indirectSales.reduce(
        (total, sale) => total + sale.monto,
        0,
      ),
    },
    sales,
  };
}

function normalizeKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function companyAliases(company: Empresas): string[] {
  const seen = new Set<string>();
  return [company.id, company.name, company.ubicacion].reduce<string[]>(
    (aliases, value) => {
      const display = typeof value === "string" ? value.trim() : "";
      const key = normalizeKey(display);
      if (display && !seen.has(key)) {
        seen.add(key);
        aliases.push(display);
      }
      return aliases;
    },
    [],
  );
}

function companyLabel(company: Empresas): string {
  const name = String(company.name || "").trim();
  const location = String(company.ubicacion || "").trim();
  if (name && location && normalizeKey(name) !== normalizeKey(location)) {
    return `${name} - ${location}`;
  }
  return name || location || String(company.id || "Empresa").trim();
}

export function buildGenteCrystalCompanyOptions(
  user: Partial<User>,
  companies: Empresas[],
  ownerIds: string[],
): GenteCrystalCompanyOption[] {
  const allowedOwners = new Set(
    ownerIds.map(normalizeKey).filter(Boolean),
  );
  const userOwnerId = normalizeKey(user.ownerId);
  const userId = normalizeKey(user.id);
  if (userOwnerId) allowedOwners.add(userOwnerId);
  if (user.eliminate === false && userId) allowedOwners.add(userId);
  const assigned = normalizeKey(user.ownercompanie);

  return companies.reduce<GenteCrystalCompanyOption[]>((options, company) => {
    const documentId = String(company.id || "").trim();
    if (!documentId) return options;
    const aliases = companyAliases(company);
    const allowed =
      user.role === "superadmin" ||
      (user.role === "admin" &&
        allowedOwners.has(normalizeKey(company.ownerId))) ||
      (user.role === "user" &&
        Boolean(assigned) &&
        aliases.map(normalizeKey).includes(assigned));
    if (!allowed) return options;

    options.push({
      value: documentId,
      label: companyLabel(company),
      aliases,
    });
    return options;
  }, []);
}

function findAllowedSelection(
  value: string,
  options: GenteCrystalCompanyOption[],
): GenteCrystalCompanyOption | undefined {
  const wanted = normalizeKey(value);
  if (!wanted) return undefined;
  return options.find(
    (option) =>
      normalizeKey(option.value) === wanted ||
      option.aliases.map(normalizeKey).includes(wanted),
  );
}

export function resolveGenteCrystalCompanySelection(
  stored: string,
  assigned: string,
  options: GenteCrystalCompanyOption[],
): string {
  return (
    findAllowedSelection(stored, options)?.value ||
    findAllowedSelection(assigned, options)?.value ||
    options[0]?.value ||
    ""
  );
}

export function currentCostaRicaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
