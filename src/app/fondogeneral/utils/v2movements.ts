import type { MovementAccountKey } from "@/services/movimientos-fondos";

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
  const [yStr, mStr, dStr] = String(isoDateKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startIso: start.toISOString(), endIsoExclusive: end.toISOString() };
  }

  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIsoExclusive: end.toISOString() };
}

export function resolveActiveMovementsQuery(params: {
  fromFilter: string | null;
  toFilter: string | null;
  pageSize: "daily" | number | "all";
  currentDailyKey: string;
  todayKey: string;
}): {
  queryKey: string;
  startIso: string;
  endIsoExclusive: string;
} {
  const { fromFilter, toFilter, pageSize, currentDailyKey, todayKey } = params;

  if (fromFilter && toFilter) {
    const fromKey = fromFilter.trim();
    const toKey = toFilter.trim();
    const startKey = fromKey > toKey ? toKey : fromKey;
    const endKey = fromKey > toKey ? fromKey : toKey;
    const startRange = buildLocalDayIsoRange(startKey);
    const endRange = buildLocalDayIsoRange(endKey);
    return {
      queryKey: `range:${startKey}..${endKey}`,
      startIso: startRange.startIso,
      endIsoExclusive: endRange.endIsoExclusive,
    };
  }

  const dayKey = pageSize === "daily" ? currentDailyKey : todayKey;
  const range = buildLocalDayIsoRange(dayKey);
  return {
    queryKey: `day:${dayKey}`,
    startIso: range.startIso,
    endIsoExclusive: range.endIsoExclusive,
  };
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
