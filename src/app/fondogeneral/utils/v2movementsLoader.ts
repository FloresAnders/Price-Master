import {
  MovimientosFondosService,
  type MovementAccountKey,
} from "../../../services/movimientos-fondos";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import type { FondoEntry } from "../types";
import { buildV2MovementsCacheKey } from "../utils/v2movements";
import { resolveActiveMovementsQuery } from "../utils/v2movements";
import {
  readFondoCache,
  writeFondoCache,
  type FondoCacheHit,
  type FondoCacheScope,
} from "../../../services/fondo-cache";

type V2MovementsCacheEntry = {
  loaded: boolean;
  movements: FondoEntry[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  exhausted: boolean;
  loading: boolean;
  queryKey?: string;
  startIso?: string;
  endIsoExclusive?: string;
  revision?: number;
};

type MovementPageResult = Awaited<
  ReturnType<typeof MovimientosFondosService.listMovementsPageByCreatedAtRange>
>;

const inFlightV2Reads = new Map<string, Promise<void>>();

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
  persistentCacheScope?: FondoCacheScope;
  readPersistentCache?: (
    scope: FondoCacheScope,
  ) => Promise<FondoCacheHit<FondoEntry[]> | null>;
  writePersistentCache?: (
    scope: FondoCacheScope,
    data: FondoEntry[],
    ttlMs: number,
  ) => Promise<void>;
  loadRemotePage?: (
    docKey: string,
    options: Parameters<
      typeof MovimientosFondosService.listMovementsPageByCreatedAtRange
    >[1],
  ) => Promise<MovementPageResult>;
  movementLoadTimeoutMs?: number;
  onLoadError?: (error: Error | null) => void;
}

const CURRENT_DAY_MOVEMENTS_TTL_MS = 45_000;

const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error || "Error desconocido"));

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("La carga de movimientos superó 15 segundos.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

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
    persistentCacheScope,
    readPersistentCache = readFondoCache,
    writePersistentCache = writeFondoCache,
    loadRemotePage = MovimientosFondosService.listMovementsPageByCreatedAtRange.bind(
      MovimientosFondosService,
    ),
    movementLoadTimeoutMs = 15_000,
    onLoadError,
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

  let cached = v2MovementsCacheRef.current[cacheKey] ?? {
    loaded: false,
    movements: [] as FondoEntry[],
    cursor: null as QueryDocumentSnapshot<DocumentData> | null,
    exhausted: false,
    loading: false,
    queryKey: undefined as string | undefined,
    startIso: undefined as string | undefined,
    endIsoExclusive: undefined as string | undefined,
    revision: 0,
  };

  if (cached.loading) return;

  const append = Boolean(options?.append);
  const persistentCacheEligible = Boolean(
    !append &&
      persistentCacheScope &&
      pageSize === "daily" &&
      currentDailyKey === todayKey &&
      !fromFilter &&
      !toFilter,
  );
  let hydratedStalePersistentCache = false;

  if (persistentCacheEligible && !cached.loaded && persistentCacheScope) {
    const persistentHit = await readPersistentCache(persistentCacheScope);
    if (persistentHit && Array.isArray(persistentHit.data)) {
      cached = {
        ...cached,
        loaded: true,
        movements: persistentHit.data,
        cursor: null,
        exhausted: persistentHit.data.length < 50,
        loading: false,
        queryKey,
        startIso,
        endIsoExclusive,
      };
      v2MovementsCacheRef.current[cacheKey] = cached;
      rebuildEntriesFromV2Cache(docKey, targetAccountKey);
      if (persistentHit.freshness === "fresh") return;
      hydratedStalePersistentCache = true;
    }
  }

  const startRevision = cached.revision ?? 0;

  const queryUnchanged =
    cached.loaded &&
    cached.queryKey === queryKey &&
    cached.startIso === startIso &&
    cached.endIsoExclusive === endIsoExclusive;

  // If query params changed, we must reset regardless of append intent.
  if (queryUnchanged && !append && !hydratedStalePersistentCache) {
    rebuildEntriesFromV2Cache(docKey, targetAccountKey);
    return;
  }

  const requestKey = [
    docKey,
    targetAccountKey,
    queryKey,
    startIso,
    endIsoExclusive,
    append ? "append" : "base",
  ].join("::");

  const existingInFlight = inFlightV2Reads.get(requestKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const computeRemoteBatchSize = () => {
    // Hard cap for daily mode per requirement.
    if (pageSize === "daily") return 50;
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
  onLoadError?.(null);
  beginMovementsLoading();

  const requestPromise = (async () => {
    try {
      const pageResult = await withTimeout(
        loadRemotePage(docKey, {
          startIso,
          endIsoExclusive,
          pageSize: remoteBatchSize,
          cursor: shouldReset ? null : nextCache.cursor,
          accountId: targetAccountKey,
        }),
        movementLoadTimeoutMs,
      );

      const latestCache = v2MovementsCacheRef.current[cacheKey] ?? cached;
      const latestRevision = latestCache.revision ?? 0;
      const isStale = latestRevision !== startRevision;
      const baseMovements = isStale && latestCache.loaded ? latestCache.movements : nextCache.movements;
      const mergedById = new Map<string, FondoEntry>();

      for (const movement of baseMovements) {
        mergedById.set(movement.id, movement);
      }
      for (const movement of pageResult.items as FondoEntry[]) {
        mergedById.set(movement.id, movement);
      }

      const mergedMovements = Array.from(mergedById.values());

      v2MovementsCacheRef.current[cacheKey] = {
        ...latestCache,
        loaded: true,
        movements: mergedMovements,
        cursor: pageResult.cursor,
        exhausted: pageResult.exhausted,
        loading: false,
        revision: latestRevision,
      };
      if (
        persistentCacheEligible &&
        persistentCacheScope &&
        !append
      ) {
        await writePersistentCache(
          persistentCacheScope,
          pageResult.items as FondoEntry[],
          CURRENT_DAY_MOVEMENTS_TTL_MS,
        );
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      onLoadError?.(normalizedError);
      throw normalizedError;
    } finally {
      const latest = v2MovementsCacheRef.current[cacheKey];
      if (latest) {
        v2MovementsCacheRef.current[cacheKey] = {
          ...latest,
          loading: false,
        };
      }
      endMovementsLoading();
      inFlightV2Reads.delete(requestKey);
    }

    rebuildEntriesFromV2Cache(docKey, targetAccountKey);
  })();

  inFlightV2Reads.set(requestKey, requestPromise);
  return requestPromise;
}
