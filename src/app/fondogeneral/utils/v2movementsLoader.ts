import {
  MovimientosFondosService,
  type MovementAccountKey,
} from "../../../services/movimientos-fondos";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import type { FondoEntry } from "../types";
import { buildV2MovementsCacheKey } from "../utils/v2movements";
import { resolveActiveMovementsQuery } from "../utils/v2movements";

type V2MovementsCacheEntry = {
  loaded: boolean;
  movements: FondoEntry[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  exhausted: boolean;
  loading: boolean;
  queryKey?: string;
  startIso?: string;
  endIsoExclusive?: string;
};

export interface EnsureV2LoadedDeps {
  rebuildEntriesFromV2Cache: (docKey: string, targetAccountKey: MovementAccountKey) => void;
  beginMovementsLoading: () => void;
  endMovementsLoading: () => void;
  pageSize: "daily" | number | "all";
  currentDailyKey: string;
  todayKey: string;
  fromFilter: string | null;
  toFilter: string | null;
  accountKeyRef: { current: MovementAccountKey };
  v2MovementsCacheRef: { current: Record<string, V2MovementsCacheEntry> };
}

export async function ensureV2MovementsLoaded(
  docKey: string,
  options: { append?: boolean } | undefined,
  deps: EnsureV2LoadedDeps,
): Promise<void> {
  const {
    rebuildEntriesFromV2Cache,
    beginMovementsLoading,
    endMovementsLoading,
    pageSize,
    currentDailyKey,
    todayKey,
    fromFilter,
    toFilter,
    accountKeyRef,
    v2MovementsCacheRef,
  } = deps;

  if (!docKey) return;

  const targetAccountKey = accountKeyRef.current;
  const cacheKey = buildV2MovementsCacheKey(docKey, targetAccountKey);
  const { queryKey, startIso, endIsoExclusive } = resolveActiveMovementsQuery({
    fromFilter,
    toFilter,
    pageSize,
    currentDailyKey,
    todayKey,
  });

  const cached = v2MovementsCacheRef.current[cacheKey] ?? {
    loaded: false,
    movements: [] as FondoEntry[],
    cursor: null as QueryDocumentSnapshot<DocumentData> | null,
    exhausted: false,
    loading: false,
    queryKey: undefined as string | undefined,
    startIso: undefined as string | undefined,
    endIsoExclusive: undefined as string | undefined,
  };

  if (cached.loading) return;

  const queryUnchanged =
    cached.loaded &&
    cached.queryKey === queryKey &&
    cached.startIso === startIso &&
    cached.endIsoExclusive === endIsoExclusive;

  const append = Boolean(options?.append);
  // If query params changed, we must reset regardless of append intent.
  if (queryUnchanged && !append) {
    rebuildEntriesFromV2Cache(docKey, targetAccountKey);
    return;
  }

  const computeRemoteBatchSize = () => {
    // Hard cap for daily mode per requirement.
    if (pageSize === "daily") return 100;
    // Never do unbounded reads; treat "all" as a capped batch.
    if (pageSize === "all") return 100;
    if (typeof pageSize === "number") {
      // Fetch a bit more than one UI page to reduce roundtrips, but keep it bounded.
      return Math.max(1, Math.min(100, Math.trunc(pageSize) * 3));
    }
    return 100;
  };

  const remoteBatchSize = computeRemoteBatchSize();

  console.log("[FG-QUERY] MovimientosFondos v2 query", {
    docKey,
    accountKey: targetAccountKey,
    queryKey,
    createdAt: {
      gte: startIso,
      lt: endIsoExclusive,
    },
    orderBy: "createdAt desc",
    pageSize: remoteBatchSize,
    append,
    ui: {
      pageSizeMode: pageSize,
      currentDailyKey,
      todayKey,
      fromFilter,
      toFilter,
    },
  });

  const shouldReset = !queryUnchanged || !append;
  const nextCache = {
    ...cached,
    loaded: false,
    movements: shouldReset ? ([] as FondoEntry[]) : cached.movements,
    cursor: shouldReset
      ? (null as QueryDocumentSnapshot<DocumentData> | null)
      : cached.cursor,
    exhausted: shouldReset ? false : cached.exhausted,
    loading: true,
    queryKey,
    startIso,
    endIsoExclusive,
  };

  v2MovementsCacheRef.current[cacheKey] = nextCache;
  beginMovementsLoading();

  try {
    const pageResult = await MovimientosFondosService.listMovementsPageByCreatedAtRange(
      docKey,
      {
        startIso,
        endIsoExclusive,
        pageSize: remoteBatchSize,
        cursor: shouldReset ? null : nextCache.cursor,
        accountId: targetAccountKey,
      },
    );

    const mergedMovements = shouldReset
      ? (pageResult.items as FondoEntry[])
      : [...nextCache.movements, ...(pageResult.items as FondoEntry[])];

    v2MovementsCacheRef.current[cacheKey] = {
      ...nextCache,
      loaded: true,
      movements: mergedMovements,
      cursor: pageResult.cursor,
      exhausted: pageResult.exhausted,
      loading: false,
    };
  } finally {
    const latest = v2MovementsCacheRef.current[cacheKey];
    if (latest) {
      v2MovementsCacheRef.current[cacheKey] = {
        ...latest,
        loading: false,
      };
    }
    endMovementsLoading();
  }

  rebuildEntriesFromV2Cache(docKey, targetAccountKey);
}
