export type ReconciliationStatus =
  | "MATCHED"
  | "TEMPORARY_PENDING"
  | "PARTIALLY_RESOLVED"
  | "RESOLVED"
  | "REAL_DIFFERENCE"
  | "DAILY_UNRESOLVED";

export const RECONCILIATION_TOLERANCE = 0;

export type ClosingReconciliation = {
  contica: { r08: number; t11: number };
  externalSnapshots: { tucanCumulative: number; tiemposCumulative: number };
  calculated: {
    previousTucanCumulative: number; previousTiemposCumulative: number;
    tucanForShift: number; tiemposForShift: number; tucanDifference: number;
    tiemposRawDifference: number; previousTiemposPending: number;
    compensatedTiemposAmount: number; tiemposRealShiftDifference: number;
    tiemposPendingAfterClosing: number; cumulativeR08: number; cumulativeT11: number;
    cumulativeTucanDifference: number; cumulativeTiemposDifference: number;
  };
  tiemposStatus: ReconciliationStatus;
};

export type ReconciliationInput = {
  r08: number; t11: number; tucanCumulative: number; tiemposCumulative: number;
  previous?: ClosingReconciliation | null; cumulativeR08?: number; cumulativeT11?: number;
  isFinalShift: boolean;
};

const money = (value: number) => Math.trunc(Number.isFinite(value) ? value : 0);
const matched = (value: number) => Math.abs(value) <= RECONCILIATION_TOLERANCE;

export function reconcileClosing(input: ReconciliationInput): ClosingReconciliation {
  const previous = input.previous;
  const prevTucan = money(previous?.externalSnapshots.tucanCumulative ?? 0);
  const prevTiempos = money(previous?.externalSnapshots.tiemposCumulative ?? 0);
  const prevPending = money(previous?.calculated.tiemposPendingAfterClosing ?? 0);
  const r08 = money(input.r08), t11 = money(input.t11);
  const tucan = money(input.tucanCumulative), tiempos = money(input.tiemposCumulative);
  if (tucan < prevTucan || tiempos < prevTiempos) throw new Error("Reporte acumulado actual no puede ser menor al anterior.");
  const tucanForShift = tucan - prevTucan;
  const tiemposForShift = tiempos - prevTiempos;
  const tucanDifference = r08 - tucanForShift;
  const tiemposRawDifference = t11 - tiemposForShift;
  const compensation = prevPending > 0 && tiemposRawDifference < 0 ? Math.min(prevPending, Math.abs(tiemposRawDifference)) : 0;
  const afterCompensation = tiemposRawDifference + compensation;
  const pendingAfter = prevPending - compensation + Math.max(afterCompensation, 0);
  const realDifference = Math.min(afterCompensation, 0);
  const cumulativeR08 = money(input.cumulativeR08 ?? r08);
  const cumulativeT11 = money(input.cumulativeT11 ?? t11);
  const cumulativeTiemposDifference = cumulativeT11 - tiempos;
  let tiemposStatus: ReconciliationStatus = "MATCHED";
  if (input.isFinalShift && !matched(cumulativeTiemposDifference)) tiemposStatus = "DAILY_UNRESOLVED";
  else if (!matched(realDifference)) tiemposStatus = "REAL_DIFFERENCE";
  else if (compensation > 0 && matched(pendingAfter)) tiemposStatus = "RESOLVED";
  else if (compensation > 0) tiemposStatus = "PARTIALLY_RESOLVED";
  else if (!matched(pendingAfter)) tiemposStatus = "TEMPORARY_PENDING";
  return { contica: { r08, t11 }, externalSnapshots: { tucanCumulative: tucan, tiemposCumulative: tiempos }, calculated: { previousTucanCumulative: prevTucan, previousTiemposCumulative: prevTiempos, tucanForShift, tiemposForShift, tucanDifference, tiemposRawDifference, previousTiemposPending: prevPending, compensatedTiemposAmount: compensation, tiemposRealShiftDifference: realDifference, tiemposPendingAfterClosing: pendingAfter, cumulativeR08, cumulativeT11, cumulativeTucanDifference: cumulativeR08 - tucan, cumulativeTiemposDifference }, tiemposStatus };
}
