import type { FondoAccountTab } from "@/lib/fondoAccountTabs";
import type { MovementAccountKey } from "@/services/movimientos-fondos";
import type { CashCounterData } from "./types";
import { calcTotal } from "./utils";
import {
  getOrCreateCashCounterSnapshot,
  updateCashCounterSnapshotAtomically,
  type CashCounterSnapshot,
} from "@/services/cashCounterDb";
import { CRC_CASH_BILL_DENOMINATIONS } from "./paymentSuggestion";

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

export type AvailableCashTransferBreakdown = CashTransferBreakdown & {
  shortfall: number;
  exact: boolean;
};

export function resolveAvailableCashTransferBreakdown(
  counter: CashCounterData | undefined,
  amount: number,
): AvailableCashTransferBreakdown | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const amountInCents = Math.round(amount * 100);
  const available = CRC_CASH_BILL_DENOMINATIONS.map((denomination) => ({
    denomination,
    denominationInCents: denomination * 100,
    count: Math.max(0, Math.trunc(counter?.bills[denomination] ?? 0)),
  }));
  type Selection = { totalInCents: number; bills: Record<number, number> };
  const memo = new Map<string, Selection>();
  const findClosest = (index: number, remainingInCents: number): Selection => {
    if (remainingInCents === 0 || index >= available.length) {
      return { totalInCents: 0, bills: {} };
    }
    const memoKey = `${index}:${remainingInCents}`;
    const memoized = memo.get(memoKey);
    if (memoized) return memoized;

    const { denomination, denominationInCents, count } = available[index];
    const maximum = Math.min(
      count,
      Math.floor(remainingInCents / denominationInCents),
    );
    let best: Selection = { totalInCents: 0, bills: {} };
    for (let used = maximum; used >= 0; used -= 1) {
      const lower = findClosest(
        index + 1,
        remainingInCents - used * denominationInCents,
      );
      const totalInCents = used * denominationInCents + lower.totalInCents;
      if (totalInCents > best.totalInCents) {
        best = {
          totalInCents,
          bills: used > 0
            ? { [denomination]: used, ...lower.bills }
            : lower.bills,
        };
      }
      if (best.totalInCents === remainingInCents) break;
    }
    memo.set(memoKey, best);
    return best;
  };

  const selection = findClosest(0, amountInCents);
  return {
    bills: selection.bills,
    total: selection.totalInCents / 100,
    shortfall: (amountInCents - selection.totalInCents) / 100,
    exact: selection.totalInCents === amountInCents,
  };
}

export function resolveCashTransferBreakdown(
  counter: CashCounterData | undefined,
  amount: number,
): CashTransferBreakdown | null {
  const resolved = resolveAvailableCashTransferBreakdown(counter, amount);
  return resolved?.exact
    ? { bills: resolved.bills, total: resolved.total }
    : null;
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
