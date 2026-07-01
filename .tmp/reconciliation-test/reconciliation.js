"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECONCILIATION_TOLERANCE = void 0;
exports.reconcileClosing = reconcileClosing;
exports.RECONCILIATION_TOLERANCE = 0;
const money = (value) => (Number.isFinite(value) ? value : 0);
const matched = (value) => Math.abs(value) <= exports.RECONCILIATION_TOLERANCE;
function reconcileClosing(input) {
    const previous = input.previous;
    const prevTucan = money(previous?.externalSnapshots.tucanCumulative ?? 0);
    const prevTiempos = money(previous?.externalSnapshots.tiemposCumulative ?? 0);
    const prevPending = money(previous?.calculated.tiemposPendingAfterClosing ?? 0);
    const r08 = money(input.r08), t11 = money(input.t11);
    const tucan = money(input.tucanCumulative), tiempos = money(input.tiemposCumulative);
    if (tucan < prevTucan || tiempos < prevTiempos)
        throw new Error("Reporte acumulado actual no puede ser menor al anterior.");
    const tucanForShift = tucan - prevTucan;
    const tiemposForShift = tiempos - prevTiempos;
    const tucanDifference = r08 - tucanForShift;
    const tiemposRawDifference = t11 - tiemposForShift;
    const combinedTiemposDifference = prevPending + tiemposRawDifference;
    const hasOppositePending = prevPending !== 0 &&
        tiemposRawDifference !== 0 &&
        Math.sign(prevPending) !== Math.sign(tiemposRawDifference);
    const compensation = hasOppositePending
        ? Math.min(Math.abs(prevPending), Math.abs(tiemposRawDifference))
        : 0;
    const tiemposDifference = input.isFinalShift ? combinedTiemposDifference : tiemposRawDifference;
    const pendingAfter = input.isFinalShift ? 0 : tiemposDifference;
    const realDifference = input.isFinalShift ? tiemposDifference : 0;
    const cumulativeR08 = money(input.cumulativeR08 ?? r08);
    const cumulativeT11 = money(input.cumulativeT11 ?? t11);
    const cumulativeTiemposDifference = cumulativeT11 - tiempos;
    let tiemposStatus = "MATCHED";
    if (input.isFinalShift && !matched(cumulativeTiemposDifference))
        tiemposStatus = "DAILY_UNRESOLVED";
    else if (!matched(realDifference))
        tiemposStatus = "REAL_DIFFERENCE";
    else if (compensation > 0 && matched(pendingAfter))
        tiemposStatus = "RESOLVED";
    else if (compensation > 0)
        tiemposStatus = "PARTIALLY_RESOLVED";
    else if (!matched(pendingAfter))
        tiemposStatus = "TEMPORARY_PENDING";
    return { contica: { r08, t11 }, externalSnapshots: { tucanCumulative: tucan, tiemposCumulative: tiempos }, calculated: { previousTucanCumulative: prevTucan, previousTiemposCumulative: prevTiempos, tucanForShift, tiemposForShift, tucanDifference, tiemposRawDifference, tiemposDifference, previousTiemposPending: prevPending, compensatedTiemposAmount: compensation, tiemposRealShiftDifference: realDifference, tiemposPendingAfterClosing: pendingAfter, cumulativeR08, cumulativeT11, cumulativeTucanDifference: cumulativeR08 - tucan, cumulativeTiemposDifference }, tiemposStatus };
}
