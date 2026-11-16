import {
  CRC_DENOMS,
  USD_DENOMS,
} from "@/components/business/cash-counter-tabs/constants";
import type { CashCounterData } from "@/components/business/cash-counter-tabs/types";
import { calcTotal } from "@/components/business/cash-counter-tabs/utils";

export type DailyClosingCounterLoad = {
  currency: CashCounterData["currency"];
  counts: Record<number, string>;
};

export function resolveFondoGeneralCounterLoad(
  counters: readonly CashCounterData[],
  balances: Readonly<Record<CashCounterData["currency"], number>>,
): DailyClosingCounterLoad | null {
  const counter = counters.find((item) => item.accountId === "FondoGeneral");
  if (!counter) return null;

  const counterTotal = calcTotal(counter.bills, counter.extraAmount);
  if (
    Math.round(counterTotal * 100) !==
    Math.round(balances[counter.currency] * 100)
  ) {
    return null;
  }

  const denominations = counter.currency === "USD" ? USD_DENOMS : CRC_DENOMS;
  const counts = denominations.reduce<Record<number, string>>(
    (result, denomination) => {
      const count = Math.max(
        0,
        Math.trunc(counter.bills[denomination.value] ?? 0),
      );
      result[denomination.value] = count > 0 ? String(count) : "";
      return result;
    },
    {},
  );

  return { currency: counter.currency, counts };
}
