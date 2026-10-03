import type { FondoAccountTab } from "@/lib/fondoAccountTabs";
import type { MovementAccountKey } from "@/services/movimientos-fondos";
import type { CashCounterData } from "./types";
import { calcTotal } from "./utils";

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
