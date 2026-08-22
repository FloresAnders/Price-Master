import type { Empresas, User } from "../../../types/firestore.ts";
import type {
  GenteCrystalDailySale,
  GenteCrystalDailySalesResponse,
} from "../../../services/gente-crystal-sales.ts";

export type GenteCrystalCompanyOption = {
  value: string;
  label: string;
  aliases: string[];
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
      const lowerPartnerIndex =
        sequence === null
          ? -1
          : nextUnconsumedTicketIndex(
              partnerIndexes.get(sequence - 1),
              index,
              consumedIndexes,
            );
      const upperPartnerIndex =
        sequence === null
          ? -1
          : nextUnconsumedTicketIndex(
              partnerIndexes.get(sequence + 1),
              index,
              consumedIndexes,
            );
      const partnerIndex =
        lowerPartnerIndex < 0
          ? upperPartnerIndex
          : upperPartnerIndex < 0
            ? lowerPartnerIndex
            : Math.min(lowerPartnerIndex, upperPartnerIndex);

      const sameOriginIndexes = indexesByOrigin[sale.captureOrigin];
      const lowerSameOriginIndex =
        sequence === null
          ? -1
          : nextUnconsumedTicketIndex(
              sameOriginIndexes.get(sequence - 1),
              index,
              consumedIndexes,
            );
      const upperSameOriginIndex =
        sequence === null
          ? -1
          : nextUnconsumedTicketIndex(
              sameOriginIndexes.get(sequence + 1),
              index,
              consumedIndexes,
            );
      const sameOriginCandidateIndex =
        lowerSameOriginIndex < 0
          ? upperSameOriginIndex
          : upperSameOriginIndex < 0
            ? lowerSameOriginIndex
            : Math.min(lowerSameOriginIndex, upperSameOriginIndex);

      const sameOriginPartnerIndex =
        sale.captureOrigin === "local_button" && sameOriginCandidateIndex >= 0
          ? (() => {
              const candidate = result.sales[sameOriginCandidateIndex];
              // En Gente Crystal hay jugadas partidas en dos tiquetes locales
              // consecutivos (ej. NICA/NICA ESPECIAL) con el mismo instante
              // de venta pero montos distintos, y deben mostrarse juntas.
              const matchesComparableValues =
                canonicalSaleAt(candidate.saleAt) === canonicalSaleAt(sale.saleAt);
              return matchesComparableValues ? sameOriginCandidateIndex : -1;
            })()
          : -1;

      const effectivePartnerIndex =
        partnerIndex >= 0 ? partnerIndex : sameOriginPartnerIndex;

      consumedIndexes.add(index);
      if (effectivePartnerIndex >= 0) {
        const partner = result.sales[effectivePartnerIndex];
        consumedIndexes.add(effectivePartnerIndex);
        displaySales.push({
          ticketIds: [sale.ticketId, partner.ticketId],
          sorteo: mergedSorteoLabel(sale.sorteo, partner.sorteo),
          monto: sale.monto + partner.monto,
          saleAt: sale.saleAt,
          captureOrigin: "local_button",
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
