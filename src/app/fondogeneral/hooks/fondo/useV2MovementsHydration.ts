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
import { buildV2MovementsCacheKey, resolveV2DocKey } from "../../utils/v2movements";
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
  const storageSnapshotRef = useRef<MovementStorage<FondoEntry> | null>(null);
  const accountKeyRef = useRef<MovementAccountKey>(accountKey);
  const v2MovementsCacheRef = useRef<
    Record<
      string,
      {
        loaded: boolean;
        movements: FondoEntry[];
        cursor: QueryDocumentSnapshot<DocumentData> | null;
        exhausted: boolean;
        loading: boolean;
        queryKey?: string;
        startIso?: string;
        endIsoExclusive?: string;
      }
    >
  >({});

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
    (docKey: string, options?: { append?: boolean }) =>
      ensureV2MovementsLoadedFn(docKey, options, {
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
        onLoadError: setMovementLoadError,
      }),
    [
      rebuildEntriesFromV2Cache,
      beginMovementsLoading,
      endMovementsLoading,
      pageSize,
      currentDailyKey,
      todayKey,
      fromFilter,
      toFilter,
      persistentCacheScope,
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

  return {
    storageSnapshotRef,
    v2MovementsCacheRef,
    applyLedgerStateFromStorage,
    rebuildEntriesFromV2Cache,
    ensureV2MovementsLoaded,
    movementLoadError,
    retryMovements,
  };
}
