import type { MovementAccountKey } from "@/services/movimientos-fondos";
import { buildCostaRicaDayRange } from "./costaRicaDay";

export function shouldApplyAutomaticMovementRange(params: {
  accountKey: MovementAccountKey;
  hasFirestoreFilterDraft: boolean;
}): boolean {
  // A preset always loads its date range immediately. Pending provider/type/
  // invoice filters remain staged until the user presses Buscar.
  return params.accountKey === "FondoGeneral";
}

export function shouldShowMovementSearchButton(params: {
  accountKey: MovementAccountKey;
  entriesHydrated: boolean;
  fromFilter: string | null;
  toFilter: string | null;
  quickRange: string | null;
  hasFirestoreFilterDraft: boolean;
}): boolean {
  return Boolean(
    params.accountKey === "FondoGeneral" &&
      params.entriesHydrated &&
      params.fromFilter &&
      params.toFilter &&
      (params.quickRange === null || params.hasFirestoreFilterDraft),
  );
}

export function buildV2MovementsCacheKey(
  docKey: string,
  targetAccountKey: MovementAccountKey,
): string {
  return `${docKey}::${targetAccountKey}`;
}

export function buildLocalDayIsoRange(isoDateKey: string): {
  startIso: string;
  endIsoExclusive: string;
} {
  const { startIso, endIsoExclusive } = buildCostaRicaDayRange(isoDateKey);
  return { startIso, endIsoExclusive };
}

export function resolveActiveMovementsQuery(params: {
  fromFilter: string | null;
  toFilter: string | null;
  pageSize: "daily" | number | "all";
  currentDailyKey: string;
  todayKey: string;
  providerCode?: string | null;
  paymentType?: string | null;
  invoiceNumber?: string | null;
}): {
  queryKey: string;
  startIso: string;
  endIsoExclusive: string;
  providerCode?: string;
  paymentType?: string;
  invoiceNumber?: string;
} {
  const { fromFilter, toFilter, pageSize, currentDailyKey, todayKey } = params;
  const providerCode = String(params.providerCode || "").trim();
  const paymentType = String(params.paymentType || "").trim();
  const invoiceNumber = String(params.invoiceNumber || "").trim();
  const filtersKey = JSON.stringify({ providerCode, paymentType, invoiceNumber });

  const withFilters = (range: {
    queryKey: string;
    startIso: string;
    endIsoExclusive: string;
  }) => ({
    ...range,
    queryKey: `${range.queryKey}:filters:${filtersKey}`,
    ...(providerCode ? { providerCode } : {}),
    ...(paymentType ? { paymentType } : {}),
    ...(invoiceNumber ? { invoiceNumber } : {}),
  });

  if (fromFilter && toFilter) {
    const fromKey = fromFilter.trim();
    const toKey = toFilter.trim();
    const startKey = fromKey > toKey ? toKey : fromKey;
    const endKey = fromKey > toKey ? fromKey : toKey;
    const startRange = buildLocalDayIsoRange(startKey);
    const endRange = buildLocalDayIsoRange(endKey);
    return withFilters({
      queryKey: `range:${startKey}..${endKey}`,
      startIso: startRange.startIso,
      endIsoExclusive: endRange.endIsoExclusive,
    });
  }

  const dayKey = pageSize === "daily" ? currentDailyKey : todayKey;
  const range = buildLocalDayIsoRange(dayKey);
  return withFilters({
    queryKey: `day:${dayKey}`,
    startIso: range.startIso,
    endIsoExclusive: range.endIsoExclusive,
  });
}

export function resolveV2DocKey(params: {
  company: string;
  resolvedOwnerId: string;
  v2MovementsCache: Record<string, { loaded?: boolean }>;
  accountKey: MovementAccountKey;
  MovimientosFondosService: {
    buildCompanyMovementsKey: (name: string) => string;
    buildLegacyOwnerMovementsKey: (ownerId: string) => string;
  };
}): string {
  const { company, resolvedOwnerId, v2MovementsCache, accountKey, MovimientosFondosService } =
    params;

  const normalizedCompany = (company || "").trim();
  const companyKey = MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
  const legacyOwnerKey = resolvedOwnerId
    ? MovimientosFondosService.buildLegacyOwnerMovementsKey(resolvedOwnerId)
    : null;

  const targetAccountKey = accountKey;
  const companyCacheKey = buildV2MovementsCacheKey(companyKey, targetAccountKey);
  const legacyCacheKey = legacyOwnerKey
    ? buildV2MovementsCacheKey(legacyOwnerKey, targetAccountKey)
    : null;

  if (v2MovementsCache[companyCacheKey]?.loaded) return companyKey;
  if (legacyOwnerKey && legacyCacheKey && v2MovementsCache[legacyCacheKey]?.loaded)
    return legacyOwnerKey;

  return companyKey || legacyOwnerKey || "";
}
