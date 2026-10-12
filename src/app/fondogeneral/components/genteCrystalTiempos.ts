import type { Empresas, User } from "../../../types/firestore.ts";
import type {
  GenteCrystalDailySale,
  GenteCrystalDailySalesResponse,
} from "../../../services/gente-crystal-sales.ts";

export type GenteCrystalCompanyOption = {
  value: string;
  label: string;
  aliases: string[];
  horarioApertura?: string;
  horarioCierre?: string;
  cierreFondoVentasMinutesBeforeEnd?: number;
  cierreFondoVentasMinutesAfterEnd?: number;
};

export type GenteCrystalDisplaySale = Omit<
  GenteCrystalDailySale,
  "ticketId"
> & {
  ticketIds: string[];
};

export type GenteCrystalDisplayResult = Omit<
  GenteCrystalDailySalesResponse,
  "sales"
> & {
  sales: GenteCrystalDisplaySale[];
};

type GenteCrystalDailySalesLoader = (
  companyId: string,
  date: string,
  signal?: AbortSignal,
) => Promise<GenteCrystalDailySalesResponse>;

export function createGenteCrystalManualSalesQuery(
  loadDaily: GenteCrystalDailySalesLoader,
) {
  let controller: AbortController | null = null;

  return {
    refresh(companyId: string, date: string) {
      controller?.abort();
      controller = new AbortController();
      return loadDaily(companyId, date, controller.signal);
    },
    cancel() {
      controller?.abort();
      controller = null;
    },
  };
}

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

type TicketIndexQueue = {
  indexes: number[];
  cursor: number;
};

function nextUnconsumedTicketIndex(
  queue: TicketIndexQueue | undefined,
  currentIndex: number,
  consumedIndexes: Set<number>,
): number {
  if (!queue) return -1;
  while (
    queue.cursor < queue.indexes.length &&
    (queue.indexes[queue.cursor] <= currentIndex ||
      consumedIndexes.has(queue.indexes[queue.cursor]))
  ) {
    queue.cursor += 1;
  }
  return queue.indexes[queue.cursor] ?? -1;
}

function canonicalSaleAt(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? String(value || "") : new Date(parsed).toISOString();
}

function costaRicaSaleDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function isSpecialRaffle(value: string): boolean {
  return /\b(reventado|especial)\b/i.test(
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
}

function salePairPriority(
  left: GenteCrystalDailySale,
  right: GenteCrystalDailySale,
): number | null {
  const leftSequence = ticketSequence(left.ticketId);
  const rightSequence = ticketSequence(right.ticketId);
  if (leftSequence === null || rightSequence === null) return null;

  const gap = Math.abs(leftSequence - rightSequence);
  if (gap < 1 || gap > 2) return null;

  const normalAndSpecial = isSpecialRaffle(left.sorteo) !== isSpecialRaffle(right.sorteo);
  const sameOperationalDay =
    costaRicaSaleDate(left.saleAt) === costaRicaSaleDate(right.saleAt);
  if (!normalAndSpecial || !sameOperationalDay) return null;

  const sameInstant = canonicalSaleAt(left.saleAt) === canonicalSaleAt(right.saleAt);
  if (sameInstant) return gap - 1;
  return 10 + gap;
}

function earliestSaleAt(left: string, right: string): string {
  const leftTimestamp = Date.parse(left);
  const rightTimestamp = Date.parse(right);
  if (Number.isNaN(leftTimestamp)) return right;
  if (Number.isNaN(rightTimestamp)) return left;
  return leftTimestamp <= rightTimestamp ? left : right;
}

function mergedSorteoLabel(left: string, right: string): string {
  const first = String(left || "").trim();
  const second = String(right || "").trim();
  if (!first) return second;
  if (!second) return first;
  if (first.toLowerCase() === second.toLowerCase()) return first;
  return `${first} + ${second}`;
}

export function buildGenteCrystalDisplayResult(
  result: GenteCrystalDailySalesResponse,
): GenteCrystalDisplayResult {
  const consumedIndexes = new Set<number>();
  const indexesByOrigin: Record<
    GenteCrystalDailySale["captureOrigin"],
    Map<number, TicketIndexQueue>
  > = {
    local_button: new Map(),
    indirect: new Map(),
  };
  result.sales.forEach((sale, index) => {
    const sequence = ticketSequence(sale.ticketId);
    if (sequence === null) return;
    const originIndexes = indexesByOrigin[sale.captureOrigin];
    const queue = originIndexes.get(sequence) ?? { indexes: [], cursor: 0 };
    queue.indexes.push(index);
    originIndexes.set(sequence, queue);
  });
  const sales = result.sales.reduce<GenteCrystalDisplaySale[]>(
    (displaySales, sale, index) => {
      if (consumedIndexes.has(index)) return displaySales;

      const sequence = ticketSequence(sale.ticketId);
      const oppositeOrigin =
        sale.captureOrigin === "local_button" ? "indirect" : "local_button";
      const partnerIndexes = indexesByOrigin[oppositeOrigin];
      const sameOriginIndexes = indexesByOrigin[sale.captureOrigin];
      const candidateIndexes = sequence === null
        ? []
        : [-1, 1, -2, 2].flatMap((offset) => {
            const candidates = [
              nextUnconsumedTicketIndex(
                partnerIndexes.get(sequence + offset),
                index,
                consumedIndexes,
              ),
              nextUnconsumedTicketIndex(
                sameOriginIndexes.get(sequence + offset),
                index,
                consumedIndexes,
              ),
            ];
            return candidates.filter((candidateIndex) => candidateIndex >= 0);
          });
      const effectivePartnerIndex = [...new Set(candidateIndexes)]
        .map((candidateIndex) => ({
          candidateIndex,
          priority: salePairPriority(sale, result.sales[candidateIndex]),
        }))
        .filter(
          (candidate): candidate is { candidateIndex: number; priority: number } =>
            candidate.priority !== null,
        )
        .sort(
          (left, right) =>
            left.priority - right.priority ||
            left.candidateIndex - right.candidateIndex,
        )[0]?.candidateIndex ?? -1;

      consumedIndexes.add(index);
      if (effectivePartnerIndex >= 0) {
        const partner = result.sales[effectivePartnerIndex];
        consumedIndexes.add(effectivePartnerIndex);
        displaySales.push({
          ticketIds: [sale.ticketId, partner.ticketId],
          sorteo: mergedSorteoLabel(sale.sorteo, partner.sorteo),
          monto: sale.monto + partner.monto,
          saleAt: earliestSaleAt(sale.saleAt, partner.saleAt),
          captureOrigin:
            sale.captureOrigin === "indirect" &&
            partner.captureOrigin === "indirect"
              ? "indirect"
              : "local_button",
        });
        return displaySales;
      }

      displaySales.push({
        ticketIds: [sale.ticketId],
        sorteo: sale.sorteo,
        monto: sale.monto,
        saleAt: sale.saleAt,
        captureOrigin: sale.captureOrigin,
      });
      return displaySales;
    },
    [],
  );
  const indirectSales = sales.filter(
    (sale) => sale.captureOrigin === "indirect",
  );

  return {
    ...result,
    summary: {
      ...result.summary,
      count: sales.length,
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
      horarioApertura: company.horarioApertura,
      horarioCierre: company.horarioCierre,
      cierreFondoVentasMinutesBeforeEnd:
        company.cierreFondoVentasMinutesBeforeEnd,
      cierreFondoVentasMinutesAfterEnd:
        company.cierreFondoVentasMinutesAfterEnd,
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
