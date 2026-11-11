import type { FondoAccountTab } from "@/lib/fondoAccountTabs";
import type { MovementAccountKey } from "@/services/movimientos-fondos";
import type { CashCounterData } from "./types";
import { calcTotal } from "./utils";
import {
  getOrCreateCashCounterSnapshot,
  updateCashCounterSnapshotAtomically,
  type CashCounterSnapshot,
} from "@/services/cashCounterDb";

export type AccountCashCounterTotal = {
  total: number;
  currency: CashCounterData["currency"];
};

export const OPEN_CASH_COUNTER_EVENT = "price-master:open-cash-counter";

export function openCashCounterForAccount(accountId: MovementAccountKey): void {
  window.dispatchEvent(
    new CustomEvent(OPEN_CASH_COUNTER_EVENT, { detail: { accountId } }),
  );
}

export function reconcileAccountCashCounters(
  counters: CashCounterData[],
  activeAccounts: readonly FondoAccountTab[],
): CashCounterData[] {
  const claimedAccountIds = new Set<MovementAccountKey>();
  let changed = false;

  const reconciled = counters.map((counter) => {
    const matchingAccount = activeAccounts.find(
      (account) => account.accountId === counter.accountId,
    );

    if (!matchingAccount || claimedAccountIds.has(matchingAccount.accountId)) {
      return counter;
    }

    claimedAccountIds.add(matchingAccount.accountId);
    if (
      counter.accountId === matchingAccount.accountId &&
      counter.name === matchingAccount.label
    ) {
      return counter;
    }

    changed = true;
    return {
      ...counter,
      accountId: matchingAccount.accountId,
      name: matchingAccount.label,
    };
  });

  for (const account of activeAccounts) {
    if (claimedAccountIds.has(account.accountId)) continue;
    changed = true;
    reconciled.push({
      accountId: account.accountId,
      name: account.label,
      bills: {},
      extraAmount: 0,
      currency: "CRC",
      aperturaCaja: 0,
      ventaActual: 0,
    });
  }

  return changed ? reconciled : counters;
}

export function getAccountCashCounterTotals(
  counters: readonly CashCounterData[],
): Partial<Record<MovementAccountKey, AccountCashCounterTotal>> {
  return counters.reduce<Partial<Record<MovementAccountKey, AccountCashCounterTotal>>>(
    (totals, counter) => {
      if (!counter.accountId || totals[counter.accountId]) return totals;
      totals[counter.accountId] = {
        total: calcTotal(counter.bills, counter.extraAmount),
        currency: counter.currency,
      };
      return totals;
    },
    {},
  );
}

export function formatAccountCashCounterAmount(
  value: AccountCashCounterTotal | undefined,
): string {
  const currency = value?.currency ?? "CRC";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value?.total ?? 0);
}

export type CashTransferBreakdown = {
  bills: Record<number, number>;
  total: number;
};

export function resolveCashTransferBreakdown(
  counter: CashCounterData | undefined,
  amount: number,
): CashTransferBreakdown | null {
  if (!counter || !Number.isFinite(amount) || amount <= 0) return null;
  let remaining = Math.round(amount * 100) / 100;
  const bills: Record<number, number> = {};
  const denominations = Object.keys(counter.bills)
    .map(Number)
    .filter((denomination) => denomination > 0 && Number.isFinite(denomination))
    .sort((a, b) => b - a);

  for (const denomination of denominations) {
    const available = Math.max(0, Math.trunc(counter.bills[denomination] ?? 0));
    const needed = Math.min(
      available,
      Math.floor((remaining + 0.0001) / denomination),
    );
    if (needed > 0) {
      bills[denomination] = needed;
      remaining = Math.round((remaining - needed * denomination) * 100) / 100;
    }
  }

  return remaining > 0.001
    ? null
    : { bills, total: Math.round(amount * 100) / 100 };
}

export async function transferCashCounterAmount(input: {
  sourceAccountId: MovementAccountKey;
  destinationAccountId: MovementAccountKey;
  amount: number;
  breakdown: Record<number, number>;
}): Promise<CashCounterSnapshot> {
  const saved = await updateCashCounterSnapshotAtomically((current) => {
    const sourceIndex = current.counters.findIndex(
      (counter) => counter.accountId === input.sourceAccountId,
    );
    const destinationIndex = current.counters.findIndex(
      (counter) => counter.accountId === input.destinationAccountId,
    );
    if (sourceIndex < 0 || destinationIndex < 0 || sourceIndex === destinationIndex) {
      return null;
    }

    const source = current.counters[sourceIndex];
    const destination = current.counters[destinationIndex];
    const nextSourceBills = { ...source.bills };
    const nextDestinationBills = { ...destination.bills };
    for (const [rawDenomination, rawCount] of Object.entries(input.breakdown)) {
      const denomination = Number(rawDenomination);
      const count = Math.max(0, Math.trunc(rawCount));
      if (
        !Number.isFinite(denomination) ||
        count > Math.max(0, Math.trunc(nextSourceBills[denomination] ?? 0))
      ) {
        return null;
      }
      nextSourceBills[denomination] =
        (nextSourceBills[denomination] ?? 0) - count;
      nextDestinationBills[denomination] =
        (nextDestinationBills[denomination] ?? 0) + count;
    }

    const counters = [...current.counters];
    counters[sourceIndex] = { ...source, bills: nextSourceBills };
    counters[destinationIndex] = {
      ...destination,
      bills: nextDestinationBills,
      currency: source.currency,
    };
    return { ...current, counters };
  });

  if (!saved) {
    throw new Error("CASH_COUNTER_TRANSFER_FAILED");
  }
  return getOrCreateCashCounterSnapshot();
}
