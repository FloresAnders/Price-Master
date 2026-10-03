import type { MovementCurrencyKey } from "@/services/movimientos-fondos";

type TotalRoundingInput = {
  amountsBeforeRounding: number[];
  individualRoundedAmounts: number[];
  roundTotalUp: boolean;
  currency: MovementCurrencyKey;
  accountKey?: string;
};

export type TotalRoundingSummary = {
  exactTotal: number;
  individualRoundedTotal: number;
  finalTotal: number;
  cashDifference: number;
  allocationAdjustments: number[];
  effectiveRoundedAmounts: number[];
};

const toCents = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
};

const fromCents = (value: number): number => Math.round(value) / 100;

const distributeTotalCents = (
  individualCents: number[],
  targetTotalCents: number,
): number[] => {
  const effective = [...individualCents];
  const adjustment =
    targetTotalCents - effective.reduce((sum, amount) => sum + amount, 0);
  if (adjustment === 0 || effective.length === 0) return effective;

  const indexesByLargestAmount = effective
    .map((amount, index) => ({ amount, index }))
    .sort((a, b) => b.amount - a.amount)
    .map(({ index }) => index);

  if (adjustment > 0) {
    effective[indexesByLargestAmount[0]] += adjustment;
    return effective;
  }

  let remaining = Math.abs(adjustment);
  indexesByLargestAmount.forEach((index) => {
    if (remaining <= 0) return;
    const reduction = Math.min(effective[index], remaining);
    effective[index] -= reduction;
    remaining -= reduction;
  });
  return effective;
};

export const calculateTotalRoundingSummary = ({
  amountsBeforeRounding,
  individualRoundedAmounts,
  roundTotalUp,
  currency,
  accountKey,
}: TotalRoundingInput): TotalRoundingSummary => {
  const beforeCents = amountsBeforeRounding.map(toCents);
  const individualCents = beforeCents.map((_, index) =>
    toCents(individualRoundedAmounts[index]),
  );
  const exactTotalCents = beforeCents.reduce((sum, amount) => sum + amount, 0);
  const individualTotalCents = individualCents.reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const canRoundTotal =
    beforeCents.length > 1 &&
    currency === "CRC" &&
    (!accountKey || accountKey === "FondoGeneral");
  const totalRemainderCents = exactTotalCents % 100_000;
  const shouldRoundTotalUp = roundTotalUp && totalRemainderCents > 50_000;
  const finalTotalCents = canRoundTotal
    ? shouldRoundTotalUp
      ? exactTotalCents + (100_000 - totalRemainderCents)
      : exactTotalCents - totalRemainderCents
    : individualTotalCents;
  const effectiveCents = distributeTotalCents(
    individualCents,
    finalTotalCents,
  );

  return {
    exactTotal: fromCents(exactTotalCents),
    individualRoundedTotal: fromCents(individualTotalCents),
    finalTotal: fromCents(finalTotalCents),
    cashDifference: fromCents(finalTotalCents - exactTotalCents),
    allocationAdjustments: effectiveCents.map((amount, index) =>
      fromCents(amount - individualCents[index]),
    ),
    effectiveRoundedAmounts: effectiveCents.map(fromCents),
  };
};
