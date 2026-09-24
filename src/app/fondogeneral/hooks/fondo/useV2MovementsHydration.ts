import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import {
  MovimientosFondosService,
  type MovementAccountKey,
  type MovementCurrencyKey,
  type MovementStorage,
  type MovementStorageState,
} from "../../../../services/movimientos-fondos";
import type { FondoEntry } from "../../types";
import { ensureV2MovementsLoaded as ensureV2MovementsLoadedFn } from "../../utils/v2movementsLoader";
import { buildV2MovementsCacheKey, resolveV2DocKey, resolveActiveMovementsQuery } from "../../utils/v2movements";
import { decideLedgerRevisionSync, movementMatchesActiveQuery } from "./ledgerRevisionSync";
import { sanitizeFondoEntries, isMovementAccountKey } from "../../utils/helpers";
import {
  subscribeFondoCacheInvalidation,
  type FondoCacheIdentity,
  type FondoCacheScope,
} from "../../../../services/fondo-cache";

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
  movementVersions?: Record<string, number>;
};

interface UseV2MovementsHydrationProps {
  company: string;
  resolvedOwnerId: string;
  accountKey: MovementAccountKey;
  pageSize: "daily" | number | "all";
  pageIndex: number;
  entriesHydrated: boolean;
  movementCurrency: MovementCurrencyKey;
  currencyEnabled: Record<MovementCurrencyKey, boolean>;
  currentDailyKey: string;
  todayKey: string;
  fromFilter: string | null;
  toFilter: string | null;
  providerCode?: string | null;
  paymentType?: string | null;
  invoiceNumber?: string | null;
  fondoEntriesLength: number;
  beginMovementsLoading: () => void;
  endMovementsLoading: () => void;
  setFondoEntries: (entries: FondoEntry[]) => void;
  setCurrencyEnabled: (value: Record<MovementCurrencyKey, boolean>) => void;
  setInitialAmount: (value: string) => void;
  setInitialAmountUSD: (value: string) => void;
  setLedgerSnapshot: (value: {
    initialCRC: number;
    currentCRC: number;
    initialUSD: number;
    currentUSD: number;
  }) => void;
  setMovementCurrency: (value: MovementCurrencyKey) => void;
  cacheIdentity?: FondoCacheIdentity;
}

export function useV2MovementsHydration({
  company,
  resolvedOwnerId,
  accountKey,
  pageSize,
  pageIndex,
  entriesHydrated,
  movementCurrency,
  currencyEnabled,
  currentDailyKey,
  todayKey,
  fromFilter,
  toFilter,
  providerCode,
  paymentType,
  invoiceNumber,
  fondoEntriesLength,
  beginMovementsLoading,
  endMovementsLoading,
  setFondoEntries,
  setCurrencyEnabled,
  setInitialAmount,
  setInitialAmountUSD,
  setLedgerSnapshot,
  setMovementCurrency,
  cacheIdentity,
}: UseV2MovementsHydrationProps) {
  const [movementLoadError, setMovementLoadError] = useState<Error | null>(null);
  const [ledgerSyncStatus, setLedgerSyncStatus] = useState<"connecting" | "synced" | "offline" | "error">("connecting");
  const observedRevisionsRef = useRef(new Map<string, number>());
  const synchronizedRevisionsRef = useRef(new Map<string, number>());
  const dirtyAccountsRef = useRef(new Map<string, number>());
  const failedAccountsRef = useRef(new Map<string, Error>());
  const dirtySequenceRef = useRef(0);
  const localMutationIdsRef = useRef(new Set<string>());
  const context = useMemo(() => ({}), [company, resolvedOwnerId, accountKey]);
  const contextRef = useRef(context);
  contextRef.current = context;
  const registerLocalMutation = useCallback((clientMutationId: string) => {
    const ids = localMutationIdsRef.current;
    ids.add(clientMutationId);
    if (ids.size > 100) ids.delete(ids.values().next().value!);
  }, []);
  const storageSnapshotRef = useRef<MovementStorage<FondoEntry> | null>(null);
  const accountKeyRef = useRef<MovementAccountKey>(accountKey);
  const v2MovementsCacheRef = useRef<Record<string, V2MovementsCacheEntry>>({});
  const rangeLoadsRef = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    accountKeyRef.current = accountKey;
  }, [accountKey]);

  const persistentCacheScope = useMemo<FondoCacheScope | undefined>(() => {
    const normalizedCompany = company.trim();
    if (
      !normalizedCompany ||
      !cacheIdentity?.userId?.trim() ||
      !cacheIdentity.ownerId?.trim()
    ) {
      return undefined;
    }
    return {
      ...cacheIdentity,
      companyId: normalizedCompany,
      accountId: accountKey,
      resource: "movements",
      dateKey: todayKey,
    };
  }, [accountKey, cacheIdentity, company, todayKey]);

  const applyLedgerStateFromStorage = useCallback(
    (state?: MovementStorageState | null) => {
      if (!state) return;

      const parseBalance = (value: unknown) => {
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
      };

      const resolveSettings = (currency: MovementCurrencyKey) => {
        const accountBalance = state.balancesByAccount?.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === currency,
        );
        return {
          enabled: accountBalance?.enabled ?? true,
          initialBalance: parseBalance(accountBalance?.initialBalance ?? 0),
          currentBalance: parseBalance(accountBalance?.currentBalance ?? 0),
        };
      };

      const crcSettings = resolveSettings("CRC");
      const usdSettings = resolveSettings("USD");

      setCurrencyEnabled({
        CRC: crcSettings.enabled,
        USD: usdSettings.enabled,
      });

      setInitialAmount(crcSettings.initialBalance.toString());
      setInitialAmountUSD(usdSettings.initialBalance.toString());

      setLedgerSnapshot({
        initialCRC: crcSettings.initialBalance,
        currentCRC: crcSettings.currentBalance,
        initialUSD: usdSettings.initialBalance,
        currentUSD: usdSettings.currentBalance,
      });
    },
    [accountKey, setCurrencyEnabled, setInitialAmount, setInitialAmountUSD, setLedgerSnapshot],
  );

  const rebuildEntriesFromV2Cache = useCallback(
    (docKey: string, targetAccountKey: MovementAccountKey) => {
      const cacheKey = buildV2MovementsCacheKey(docKey, targetAccountKey);
      const cached = v2MovementsCacheRef.current[cacheKey];
      if (!cached?.loaded) return;

      const scopedEntries = cached.movements.filter((rawEntry) => {
        const candidate = rawEntry as Partial<FondoEntry>;
        const movementAccount = isMovementAccountKey(candidate.accountId)
          ? candidate.accountId
          : targetAccountKey;
        return movementAccount === targetAccountKey;
      });

      const entries = sanitizeFondoEntries(
        scopedEntries,
        undefined,
        targetAccountKey,
      ).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setFondoEntries(entries);

      const state = storageSnapshotRef.current?.state;
      if (state) {
        applyLedgerStateFromStorage(state);
      }
    },
    [applyLedgerStateFromStorage, setFondoEntries],
  );

  const ensureV2MovementsLoaded = useCallback(
    async (
      docKey: string,
      options?: { append?: boolean; forceRefresh?: boolean },
    ) => {
      const cacheKey = buildV2MovementsCacheKey(docKey, accountKey);
      const pending = rangeLoadsRef.current.get(cacheKey);
      if (pending) {
        if (!options?.forceRefresh) return pending;
        // The loader skips requests while loading; a gap must refresh after that read.
        await pending.catch(() => undefined);
        if (contextRef.current !== context) return;
      }
      const dirtyVersion = dirtyAccountsRef.current.get(cacheKey);
      const observedRevision = observedRevisionsRef.current.get(docKey);
      const request = ensureV2MovementsLoadedFn(docKey, options, {
        rebuildEntriesFromV2Cache: (key, account) => {
          if (contextRef.current === context) rebuildEntriesFromV2Cache(key, account);
        },
        beginMovementsLoading,
        endMovementsLoading,
        pageSize,
        currentDailyKey,
        todayKey,
        fromFilter,
        toFilter,
        providerCode,
        paymentType,
        invoiceNumber,
        accountKeyRef: { current: accountKey },
        v2MovementsCacheRef,
        persistentCacheScope,
        onLoadError: (error) => {
          if (contextRef.current === context) setMovementLoadError(error);
        },
      });
      rangeLoadsRef.current.set(cacheKey, request);
      try {
        await request;
        if (options?.forceRefresh && contextRef.current === context &&
          dirtyAccountsRef.current.get(cacheKey) === dirtyVersion) {
          dirtyAccountsRef.current.delete(cacheKey);
          failedAccountsRef.current.delete(cacheKey);
          if (observedRevision !== undefined) {
            synchronizedRevisionsRef.current.set(cacheKey, observedRevision);
            setMovementLoadError(null);
            setLedgerSyncStatus("synced");
          }
        }
      } finally {
        if (rangeLoadsRef.current.get(cacheKey) === request) rangeLoadsRef.current.delete(cacheKey);
      }
    },
    [
      rebuildEntriesFromV2Cache,
      beginMovementsLoading,
      endMovementsLoading,
      pageSize,
      currentDailyKey,
      todayKey,
      fromFilter,
      toFilter,
      providerCode,
      paymentType,
      invoiceNumber,
      persistentCacheScope,
      accountKey,
      context,
    ],
  );

  const retryMovements = useCallback(() => {
    const docKey = resolveV2DocKey({
      company,
      resolvedOwnerId,
      v2MovementsCache: v2MovementsCacheRef.current,
      accountKey: accountKeyRef.current,
      MovimientosFondosService,
    });
    if (!docKey) return Promise.resolve();
    const cacheKey = buildV2MovementsCacheKey(docKey, accountKeyRef.current);
    if (dirtyAccountsRef.current.has(cacheKey)) {
      return ensureV2MovementsLoaded(docKey, { forceRefresh: true });
    }
    const cached = v2MovementsCacheRef.current[cacheKey];
    if (cached) {
      v2MovementsCacheRef.current[cacheKey] = {
        ...cached,
        loaded: false,
        loading: false,
      };
    }
    return ensureV2MovementsLoaded(docKey);
  }, [company, ensureV2MovementsLoaded, resolvedOwnerId]);

  const refreshMovements = useCallback(() => {
    const docKey = resolveV2DocKey({
      company,
      resolvedOwnerId,
      v2MovementsCache: v2MovementsCacheRef.current,
      accountKey: accountKeyRef.current,
      MovimientosFondosService,
    });
    if (!docKey) return Promise.resolve();
    return ensureV2MovementsLoaded(docKey, { forceRefresh: true });
  }, [company, ensureV2MovementsLoaded, resolvedOwnerId]);

  useEffect(() => {
    if (!persistentCacheScope) return;
    return subscribeFondoCacheInvalidation((match) => {
      if (
        match.resource !== "movements" ||
        (match.companyId && match.companyId !== persistentCacheScope.companyId) ||
        (match.accountId && match.accountId !== persistentCacheScope.accountId) ||
        (match.databaseId && match.databaseId !== persistentCacheScope.databaseId)
      ) {
        return;
      }
      void retryMovements();
    });
  }, [persistentCacheScope, retryMovements]);

  useEffect(() => {
    if (!entriesHydrated) return;
    const docKey = resolveV2DocKey({
      company,
      resolvedOwnerId,
      v2MovementsCache: v2MovementsCacheRef.current,
      accountKey: accountKeyRef.current,
      MovimientosFondosService,
    });
    if (!docKey) return;
    const cacheKey = buildV2MovementsCacheKey(docKey, accountKey);
    const cached = v2MovementsCacheRef.current[cacheKey];
    if (!cached?.loaded || cached.loading || cached.exhausted) return;

    if (pageSize === "daily") return;

    if (pageSize === "all") {
      void ensureV2MovementsLoaded(docKey, { append: true });
      return;
    }

    if (typeof pageSize !== "number" || pageSize <= 0) return;

    const needed = (pageIndex + 1) * pageSize;
    if (cached.movements.length >= needed) return;

    void ensureV2MovementsLoaded(docKey, { append: true });
  }, [
    entriesHydrated,
    company,
    resolvedOwnerId,
    accountKey,
    pageSize,
    pageIndex,
    fondoEntriesLength,
    ensureV2MovementsLoaded,
  ]);

  useEffect(() => {
    setCurrencyEnabled({ CRC: true, USD: true });
    setMovementCurrency("CRC");
    setInitialAmount("0");
    setInitialAmountUSD("0");
    storageSnapshotRef.current = null;
  }, [company, accountKey, setCurrencyEnabled, setInitialAmount, setInitialAmountUSD, setMovementCurrency]);

  useEffect(() => {
    if (currencyEnabled[movementCurrency]) return;
    if (currencyEnabled.CRC) {
      setMovementCurrency("CRC");
      return;
    }
    if (currencyEnabled.USD) {
      setMovementCurrency("USD");
    }
  }, [currencyEnabled, movementCurrency, setMovementCurrency]);

  useEffect(() => {
    const docKey = resolveV2DocKey({ company, resolvedOwnerId, accountKey,
      v2MovementsCache: v2MovementsCacheRef.current, MovimientosFondosService });
    if (!docKey || (!company.trim() && !resolvedOwnerId)) return;
    const cacheKey = buildV2MovementsCacheKey(docKey, accountKey);
    const activeQuery = resolveActiveMovementsQuery({ fromFilter, toFilter, pageSize,
      currentDailyKey, todayKey, providerCode, paymentType, invoiceNumber });
    let online = navigator.onLine;
    let unsubscribe: (() => void) | undefined;
    let generation = 0;
    let disposed = false;
    const stop = () => {
      generation++;
      unsubscribe?.();
      unsubscribe = undefined;
    };
    const start = () => {
      if (disposed || unsubscribe || !online || document.visibilityState !== "visible") return;
      const session = ++generation;
      const current = () => !disposed && generation === session && contextRef.current === context;
      let previousRevision = observedRevisionsRef.current.get(docKey) ?? 0;
      let firstSnapshot = true;
      let queue = Promise.resolve();
      setLedgerSyncStatus("connecting");
      unsubscribe = MovimientosFondosService.subscribeToLedger<FondoEntry>(docKey, (snapshot) => {
        if (!current() || snapshot.hasPendingWrites || snapshot.fromCache) return;
        // Maintenance writes may change lock state without changing the movement revision.
        storageSnapshotRef.current = snapshot.storage;
        applyLedgerStateFromStorage(snapshot.storage.state);
        const nextRevision = snapshot.storage.state.revision ?? 0;
        const lastChange = snapshot.storage.state.lastChange;
        const markDirty = (key: string) => {
          dirtyAccountsRef.current.set(key, ++dirtySequenceRef.current);
        };
        if (nextRevision > previousRevision + 1) {
          // A gap can include changes to any account, including cached inactive tabs.
          for (const balance of snapshot.storage.state.balancesByAccount) {
            markDirty(buildV2MovementsCacheKey(docKey, balance.accountId));
          }
        } else if (nextRevision > previousRevision && lastChange?.accountId !== accountKey && lastChange) {
          markDirty(buildV2MovementsCacheKey(docKey, lastChange.accountId));
        }
        const action = firstSnapshot && dirtyAccountsRef.current.has(cacheKey)
          ? { type: "refresh-range" as const }
          : decideLedgerRevisionSync({ previousRevision, nextRevision, lastChange,
          activeAccountId: accountKey, locallyAppliedMutationIds: localMutationIdsRef.current });
        firstSnapshot = false;
        previousRevision = Math.max(previousRevision, nextRevision);
        observedRevisionsRef.current.set(docKey, previousRevision);
        if (action.type !== "ignore" && action.type !== "ledger-only") markDirty(cacheKey);
        const dirtyVersion = dirtyAccountsRef.current.get(cacheKey);
        if (action.type === "ledger-only" && lastChange?.clientMutationId) {
          localMutationIdsRef.current.delete(lastChange.clientMutationId);
        }
        queue = queue.then(async () => {
          if (!current()) return;
          const updateCache = (movementId: string, entry?: FondoEntry) => {
            const cached = v2MovementsCacheRef.current[cacheKey];
            const movements = (cached?.movements ?? []).filter((item) => item.id !== movementId);
            if (entry) movements.push(entry);
            v2MovementsCacheRef.current[cacheKey] = {
              ...(cached ?? { loaded: true, cursor: null, exhausted: false, loading: false }),
              movements, revision: (cached?.revision ?? 0) + 1,
              movementVersions: { ...cached?.movementVersions, [movementId]: (cached?.revision ?? 0) + 1 },
            };
            rebuildEntriesFromV2Cache(docKey, accountKey);
          };
          try {
            // A later movement cannot certify an earlier failed read. Repair the range.
            const repair = action.type === "refresh-range" ||
              (failedAccountsRef.current.has(cacheKey) && (action.type === "fetch-one" || action.type === "remove-one"));
            if (repair) {
              await ensureV2MovementsLoaded(docKey, { forceRefresh: true });
            } else if (action.type === "remove-one") {
              updateCache(action.movementId);
            } else if (action.type === "fetch-one") {
              const entry = await MovimientosFondosService.getMovementById<FondoEntry>(docKey, action.movementId, accountKey);
              if (!current()) return;
              if (!entry) await ensureV2MovementsLoaded(docKey, { forceRefresh: true });
              else updateCache(action.movementId, entry.accountId === accountKey && movementMatchesActiveQuery(entry, activeQuery) ? entry : undefined);
            }
            if (!current()) return;
            if (repair) failedAccountsRef.current.delete(cacheKey);
            if (action.type !== "ignore" && action.type !== "ledger-only" &&
              !failedAccountsRef.current.has(cacheKey) && dirtyAccountsRef.current.get(cacheKey) === dirtyVersion) {
              dirtyAccountsRef.current.delete(cacheKey);
            }
            if (!dirtyAccountsRef.current.has(cacheKey) && !failedAccountsRef.current.has(cacheKey)) {
              synchronizedRevisionsRef.current.set(cacheKey, nextRevision);
              setMovementLoadError(null);
              setLedgerSyncStatus("synced");
            } else if (failedAccountsRef.current.has(cacheKey)) {
              setMovementLoadError(failedAccountsRef.current.get(cacheKey)!);
              setLedgerSyncStatus("error");
            }
          } catch (error) {
            if (current()) {
              const failure = error instanceof Error ? error : new Error(String(error));
              failedAccountsRef.current.set(cacheKey, failure);
              markDirty(cacheKey);
              setMovementLoadError(failure);
              setLedgerSyncStatus("error");
            }
          }
        });
      }, (error) => {
        if (!current() || !online) return;
        setMovementLoadError(error);
        setLedgerSyncStatus("error");
      });
    };
    const onVisibility = () => { if (document.visibilityState === "visible") start(); else stop(); };
    const onOnline = () => { online = true; start(); };
    const onOffline = () => { online = false; stop(); setLedgerSyncStatus("offline"); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (!online) setLedgerSyncStatus("offline");
    start();
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [company, resolvedOwnerId, accountKey, context, fromFilter, toFilter, pageSize,
    currentDailyKey, todayKey, providerCode, paymentType, invoiceNumber,
    applyLedgerStateFromStorage, ensureV2MovementsLoaded, rebuildEntriesFromV2Cache]);

  return {
    storageSnapshotRef,
    v2MovementsCacheRef,
    applyLedgerStateFromStorage,
    rebuildEntriesFromV2Cache,
    ensureV2MovementsLoaded,
    movementLoadError,
    retryMovements,
    refreshMovements,
    ledgerSyncStatus,
    registerLocalMutation,
  };
}
