import {
  getOrCreateCashCounterSnapshot,
  type CashCounterSnapshot,
  updateCashCounterSnapshotAtomically,
} from "@/services/cashCounterDb";
import type { BillsMap, CashCounterData } from "./types";
import { calcTotal } from "./utils";
import type { MovementAccountKey } from "@/services/movimientos-fondos";

export const CRC_CASH_BILL_DENOMINATIONS = [
  20000,
  10000,
  5000,
  2000,
  1000,
] as const;

export type FondoGeneralPaymentSuggestion = {
  accountId: MovementAccountKey;
  expectedCounterTotal: number;
  expectedCounterFingerprint: string;
  amount: number;
  suggestedAmount: number;
  changeRequired: number;
  bills: BillsMap;
  availableBills: BillsMap;
};

export type FondoGeneralIncomeSuggestion = {
  accountId: MovementAccountKey;
  amount: number;
  bills: BillsMap;
};

type BuildSuggestionInput = {
  snapshot: CashCounterSnapshot;
  currentBalance: number;
  paymentAmount: number;
  accountId?: MovementAccountKey;
};

type LoadSuggestionInput = Omit<BuildSuggestionInput, "snapshot">;

type BuildIncomeSuggestionInput = {
  snapshot: CashCounterSnapshot;
  currentBalance: number;
  incomeAmount: number;
  accountId: MovementAccountKey;
};

type LoadIncomeSuggestionInput = Omit<BuildIncomeSuggestionInput, "snapshot">;

function counterFingerprint(counter: CashCounterData): string {
  const bills = Object.entries(counter.bills)
    .map(([denomination, count]) => [
      Number(denomination),
      Math.max(0, Math.trunc(count)),
    ] as const)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left - right);

  return JSON.stringify({
    accountId: counter.accountId ?? null,
    currency: counter.currency,
    extraAmount: Math.round(counter.extraAmount * 100) / 100,
    bills,
  });
}

export function buildFondoGeneralPaymentSuggestion(
  input: BuildSuggestionInput,
): FondoGeneralPaymentSuggestion | null {
  const accountId = input.accountId ?? "FondoGeneral";
  const counter = input.snapshot.counters.find(
    (item) => item.accountId === accountId,
  );
  if (!counter || counter.currency !== "CRC") return null;

  const counterTotal = calcTotal(counter.bills, counter.extraAmount);
  const expectedCounterTotal = Math.round(input.currentBalance * 100) / 100;
  if (
    Math.round(counterTotal * 100) !== Math.round(expectedCounterTotal * 100)
  ) {
    return null;
  }

  const amount = Math.round(input.paymentAmount);
  if (
    amount <= 0 ||
    amount !== input.paymentAmount
  ) {
    return null;
  }

  const available = CRC_CASH_BILL_DENOMINATIONS.map((denomination) => ({
    denomination,
    count: Math.max(0, Math.trunc(counter.bills[denomination] ?? 0)),
  }));

  type BillSelection = { total: number; bills: BillsMap };
  const memo = new Map<string, BillSelection>();
  const findClosestBills = (
    index: number,
    remaining: number,
  ): BillSelection => {
    if (remaining === 0 || index >= available.length) {
      return { total: 0, bills: {} };
    }
    const memoKey = `${index}:${remaining}`;
    const memoized = memo.get(memoKey);
    if (memoized) return memoized;

    const { denomination, count } = available[index];
    const maximum = Math.min(count, Math.floor(remaining / denomination));
    let best: BillSelection = { total: 0, bills: {} };
    for (let used = maximum; used >= 0; used -= 1) {
      const lower = findClosestBills(
        index + 1,
        remaining - used * denomination,
      );
      const total = used * denomination + lower.total;
      if (total > best.total) {
        best = {
          total,
          bills: used > 0
            ? { [denomination]: used, ...lower.bills }
            : lower.bills,
        };
      }
      if (best.total === remaining) break;
    }
    memo.set(memoKey, best);
    return best;
  };

  const selection = findClosestBills(0, amount);
  const availableBills = Object.fromEntries(
    available
      .filter(({ count }) => count > 0)
      .map(({ denomination, count }) => [denomination, count]),
  ) as BillsMap;

  return {
    accountId,
    expectedCounterTotal,
    expectedCounterFingerprint: counterFingerprint(counter),
    amount,
    suggestedAmount: selection.total,
    changeRequired: amount - selection.total,
    bills: selection.bills,
    availableBills,
  };
}

export function applyFondoGeneralPaymentSuggestionToSnapshot(
  snapshot: CashCounterSnapshot,
  suggestion: FondoGeneralPaymentSuggestion,
): { snapshot: CashCounterSnapshot; applied: boolean } {
  const counterIndex = snapshot.counters.findIndex(
    (item) => item.accountId === suggestion.accountId,
  );
  const counter = snapshot.counters[counterIndex];
  if (
    !counter ||
    counter.currency !== "CRC" ||
    counterFingerprint(counter) !== suggestion.expectedCounterFingerprint ||
    Math.round(calcTotal(counter.bills, counter.extraAmount) * 100) !==
      Math.round(suggestion.expectedCounterTotal * 100)
  ) {
    return { snapshot, applied: false };
  }

  const suggestedTotal = Object.entries(suggestion.bills).reduce(
    (sum, [denomination, count]) =>
      sum + Number(denomination) * Math.max(0, Math.trunc(count)),
    0,
  );
  if (
    suggestedTotal !== suggestion.suggestedAmount ||
    suggestion.suggestedAmount < 0 ||
    suggestion.changeRequired < 0 ||
    suggestion.suggestedAmount + suggestion.changeRequired !== suggestion.amount
  ) {
    return { snapshot, applied: false };
  }

  const nextBills = { ...counter.bills };
  for (const [rawDenomination, rawCount] of Object.entries(suggestion.bills)) {
    const denomination = Number(rawDenomination);
    const count = Math.max(0, Math.trunc(rawCount));
    if (
      !CRC_CASH_BILL_DENOMINATIONS.includes(
        denomination as (typeof CRC_CASH_BILL_DENOMINATIONS)[number],
      ) ||
      count <= 0 ||
      Math.max(0, Math.trunc(nextBills[denomination] ?? 0)) < count
    ) {
      return { snapshot, applied: false };
    }
    nextBills[denomination] -= count;
  }

  const counters = [...snapshot.counters];
  counters[counterIndex] = { ...counter, bills: nextBills };
  return {
    applied: true,
    snapshot: { ...snapshot, counters },
  };
}

export async function loadFondoGeneralPaymentSuggestion(
  input: LoadSuggestionInput,
): Promise<FondoGeneralPaymentSuggestion | null> {
  const snapshot = await getOrCreateCashCounterSnapshot();
  return buildFondoGeneralPaymentSuggestion({ ...input, snapshot });
}

export async function applyFondoGeneralPaymentSuggestion(
  suggestion: FondoGeneralPaymentSuggestion,
): Promise<boolean> {
  return updateCashCounterSnapshotAtomically((current) => {
    const result = applyFondoGeneralPaymentSuggestionToSnapshot(
      current,
      suggestion,
    );
    return result.applied
      ? { ...result.snapshot, lastSaved: new Date().toISOString() }
      : null;
  });
}

export function buildFondoGeneralIncomeSuggestion(
  input: BuildIncomeSuggestionInput,
): FondoGeneralIncomeSuggestion | null {
  const counter = input.snapshot.counters.find(
    (item) => item.accountId === input.accountId,
  );
  if (!counter || counter.currency !== "CRC") return null;

  const counterTotal = calcTotal(counter.bills, counter.extraAmount);
  const expectedCounterTotal = Math.round(input.currentBalance * 100) / 100;
  if (
    Math.round(counterTotal * 100) !== Math.round(expectedCounterTotal * 100)
  ) {
    return null;
  }

  const amount = Math.round(input.incomeAmount);
  if (amount <= 0 || amount !== input.incomeAmount) return null;

  let remaining = amount;
  const bills: BillsMap = {};
  for (const denomination of CRC_CASH_BILL_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count <= 0) continue;
    bills[denomination] = count;
    remaining -= count * denomination;
  }
  if (remaining !== 0) return null;

  return { accountId: input.accountId, amount, bills };
}

export function applyFondoGeneralIncomeSuggestionToSnapshot(
  snapshot: CashCounterSnapshot,
  suggestion: FondoGeneralIncomeSuggestion,
): { snapshot: CashCounterSnapshot; applied: boolean } {
  const counterIndex = snapshot.counters.findIndex(
    (item) => item.accountId === suggestion.accountId,
  );
  const counter = snapshot.counters[counterIndex];
  if (!counter || counter.currency !== "CRC" || suggestion.amount <= 0) {
    return { snapshot, applied: false };
  }

  const normalizedBills: BillsMap = {};
  let total = 0;
  for (const [rawDenomination, rawCount] of Object.entries(suggestion.bills)) {
    const denomination = Number(rawDenomination);
    const count = Number(rawCount);
    if (
      !CRC_CASH_BILL_DENOMINATIONS.includes(
        denomination as (typeof CRC_CASH_BILL_DENOMINATIONS)[number],
      ) ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      return { snapshot, applied: false };
    }
    if (count === 0) continue;
    normalizedBills[denomination] = count;
    total += denomination * count;
  }
  if (total !== suggestion.amount) return { snapshot, applied: false };

  const nextBills = { ...counter.bills };
  for (const [rawDenomination, count] of Object.entries(normalizedBills)) {
    const denomination = Number(rawDenomination);
    nextBills[denomination] =
      Math.max(0, Math.trunc(nextBills[denomination] ?? 0)) + count;
  }

  const counters = [...snapshot.counters];
  counters[counterIndex] = { ...counter, bills: nextBills };
  return { snapshot: { ...snapshot, counters }, applied: true };
}

export async function loadFondoGeneralIncomeSuggestion(
  input: LoadIncomeSuggestionInput,
): Promise<FondoGeneralIncomeSuggestion | null> {
  const snapshot = await getOrCreateCashCounterSnapshot();
  return buildFondoGeneralIncomeSuggestion({ ...input, snapshot });
}

export async function applyFondoGeneralIncomeSuggestion(
  suggestion: FondoGeneralIncomeSuggestion,
): Promise<boolean> {
  return updateCashCounterSnapshotAtomically((current) => {
    const result = applyFondoGeneralIncomeSuggestionToSnapshot(
      current,
      suggestion,
    );
    return result.applied
      ? { ...result.snapshot, lastSaved: new Date().toISOString() }
      : null;
  });
}
