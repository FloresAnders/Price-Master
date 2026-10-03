import type { FondoEntry } from "../../types";
import { roundMoney2 } from "../helpers";
import { getCostaRicaCurrentDateKey } from "../costaRicaDay";

type RoundingEntry = Partial<FondoEntry> & Pick<FondoEntry, "createdAt">;

export const resolveIndividualMovementRoundingAdjustment = (
  entry: RoundingEntry,
): number => {
  if (
    typeof entry.roundingAdjustment === "number" &&
    Number.isFinite(entry.roundingAdjustment)
  ) {
    return roundMoney2(entry.roundingAdjustment);
  }

  // Los movimientos nuevos con corrección grupal separan expresamente ese
  // ajuste del redondeo individual. Si no hubo redondeo individual, no se debe
  // reconstruir a partir del monto pagado porque ese monto ya incluye el grupo.
  if (
    typeof entry.totalRoundingAdjustment === "number" &&
    Number.isFinite(entry.totalRoundingAdjustment) &&
    roundMoney2(entry.totalRoundingAdjustment) !== 0
  ) {
    return 0;
  }

  const absorbed = Math.max(0, roundMoney2(entry.roundingAbsorbed));
  if (absorbed > 0) return -absorbed;
  if (
    entry.invoiceDocType !== "FCR" &&
    roundMoney2(entry.amountEgreso) > 0 &&
    entry.amountPayment !== undefined
  ) {
    const appliedCreditNotes = Array.isArray(entry.appliedCreditNotes)
      ? entry.appliedCreditNotes.reduce(
          (sum, note) =>
            sum + Math.max(0, roundMoney2(note?.appliedAmount)),
          0,
        )
      : 0;
    const beforeRounding = Math.max(
      0,
      roundMoney2(roundMoney2(entry.amountEgreso) - appliedCreditNotes),
    );
    return roundMoney2(roundMoney2(entry.amountPayment) - beforeRounding);
  }
  return 0;
};

export const resolveTotalMovementRoundingAdjustment = (
  entry: RoundingEntry,
): number => roundMoney2(entry.totalRoundingAdjustment);

export const resolveMovementRoundingAdjustment = (
  entry: RoundingEntry,
): number => {
  const individualAdjustment = resolveIndividualMovementRoundingAdjustment(entry);
  const totalAdjustment = resolveTotalMovementRoundingAdjustment(entry);
  return roundMoney2(individualAdjustment + totalAdjustment);
};

export const calculateFondoGeneralDailyRounding = (
  entries: ReadonlyArray<RoundingEntry>,
  dateKey: string,
): { total: number; movementCount: number } => {
  let total = 0;
  let movementCount = 0;
  entries.forEach((entry) => {
    if ((entry.accountId ?? "FondoGeneral") !== "FondoGeneral") return;
    if ((entry.currency ?? "CRC") !== "CRC") return;
    const createdAt = new Date(entry.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    if (getCostaRicaCurrentDateKey(createdAt) !== dateKey) return;
    const adjustment = resolveMovementRoundingAdjustment(entry);
    if (adjustment === 0) return;
    total = roundMoney2(total + adjustment);
    movementCount += 1;
  });
  return { total, movementCount };
};
