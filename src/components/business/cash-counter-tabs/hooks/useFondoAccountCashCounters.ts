"use client";

import { useEffect, useMemo, useState } from "react";
import type { FondoAccountTab } from "@/lib/fondoAccountTabs";
import type { MovementAccountKey } from "@/services/movimientos-fondos";
import {
  CASH_COUNTER_SNAPSHOT_EVENT,
  getOrCreateCashCounterSnapshot,
  saveCashCounterSnapshot,
  type CashCounterSnapshot,
} from "@/services/cashCounterDb";
import {
  getAccountCashCounterTotals,
  reconcileAccountCashCounters,
  type AccountCashCounterTotal,
} from "../accountCounters";

export function useFondoAccountCashCounters(
  activeAccounts: readonly FondoAccountTab[],
): Partial<Record<MovementAccountKey, AccountCashCounterTotal>> {
  const [totals, setTotals] = useState<
    Partial<Record<MovementAccountKey, AccountCashCounterTotal>>
  >({});
  const accountKey = useMemo(
    () => activeAccounts.map((account) => account.accountId).join("|"),
    [activeAccounts],
  );

  useEffect(() => {
    let cancelled = false;

    const applySnapshot = async (snapshot: CashCounterSnapshot) => {
      const counters = reconcileAccountCashCounters(snapshot.counters, activeAccounts);
      const reconciled = counters === snapshot.counters
        ? snapshot
        : { ...snapshot, counters };

      if (counters !== snapshot.counters) {
        await saveCashCounterSnapshot(reconciled);
      }
      if (!cancelled) setTotals(getAccountCashCounterTotals(reconciled.counters));
    };

    const load = async () => {
      try {
        await applySnapshot(await getOrCreateCashCounterSnapshot());
      } catch {
        // La burbuja conserva su valor inicial si el almacenamiento no está disponible.
      }
    };

    const handleSnapshot = (event: Event) => {
      const snapshot = (event as CustomEvent<CashCounterSnapshot>).detail;
      if (snapshot) void applySnapshot(snapshot);
    };

    window.addEventListener(CASH_COUNTER_SNAPSHOT_EVENT, handleSnapshot);
    void load();

    return () => {
      cancelled = true;
      window.removeEventListener(CASH_COUNTER_SNAPSHOT_EVENT, handleSnapshot);
    };
  }, [accountKey, activeAccounts]);

  return totals;
}
