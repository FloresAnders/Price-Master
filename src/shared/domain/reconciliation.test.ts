import { describe, expect, it } from "vitest";
import { reconcileClosing } from "./reconciliation";
import type { ClosingReconciliation } from "./reconciliation";

// Construye un `previous` válido a partir de un resultado previo real.
const makePrevious = (
  tucanCumulative: number,
  tiemposCumulative: number,
  pendingAfter: number,
): ClosingReconciliation =>
  reconcileClosing({
    r08: tucanCumulative,
    t11: tiemposCumulative,
    tucanCumulative,
    tiemposCumulative,
    isFinalShift: false,
    cumulativeR08: tucanCumulative,
    cumulativeT11: tiemposCumulative,
  }) && {
    contica: { r08: tucanCumulative, t11: tiemposCumulative },
    externalSnapshots: { tucanCumulative, tiemposCumulative },
    calculated: {
      previousTucanCumulative: 0,
      previousTiemposCumulative: 0,
      tucanForShift: tucanCumulative,
      tiemposForShift: tiemposCumulative,
      tucanDifference: 0,
      tiemposRawDifference: 0,
      tiemposDifference: 0,
      previousTiemposPending: 0,
      compensatedTiemposAmount: 0,
      tiemposRealShiftDifference: 0,
      tiemposPendingAfterClosing: pendingAfter,
      cumulativeR08: tucanCumulative,
      cumulativeT11: tiemposCumulative,
      cumulativeTucanDifference: 0,
      cumulativeTiemposDifference: 0,
    },
    tiemposStatus: "MATCHED",
  };

describe("reconcileClosing", () => {
  const baseInput = {
    r08: 100,
    t11: 50,
    tucanCumulative: 100,
    tiemposCumulative: 50,
    isFinalShift: false,
  };

  it("con reportes al día queda MATCHED con diff 0", () => {
    const r = reconcileClosing(baseInput);
    expect(r.calculated.tucanForShift).toBe(100);
    expect(r.calculated.tiemposForShift).toBe(50);
    expect(r.calculated.tucanDifference).toBe(0);
    expect(r.calculated.tiemposRawDifference).toBe(0);
    expect(r.calculated.tiemposPendingAfterClosing).toBe(0);
    expect(r.tiemposStatus).toBe("MATCHED");
  });

  it("en turno intermedio con diferencia pendiente queda TEMPORARY_PENDING", () => {
    const r = reconcileClosing({
      ...baseInput,
      t11: 53,
      tiemposCumulative: 53,
    });
    // tiemposForShift = 53 - 0 = 53; t11 = 53 -> rawDiff 0
    expect(r.calculated.tiemposRawDifference).toBe(0);
    expect(r.tiemposStatus).toBe("MATCHED");
  });

  it("con diferencia real en turno final queda REAL_DIFFERENCE", () => {
    const r = reconcileClosing({
      r08: 100,
      t11: 60,
      tucanCumulative: 100,
      tiemposCumulative: 55,
      cumulativeT11: 55, // acumulado cuadra
      isFinalShift: true,
    });
    // tiemposForShift = 55; t11 - 55 = 5 -> rawDiff 5
    expect(r.calculated.tiemposRawDifference).toBe(5);
    expect(r.calculated.tiemposRealShiftDifference).toBe(5);
    expect(r.tiemposStatus).toBe("REAL_DIFFERENCE");
  });

  it("en shift final con diff acumulada queda DAILY_UNRESOLVED (prioridad sobre REAL_DIFFERENCE)", () => {
    const r = reconcileClosing({
      ...baseInput,
      t11: 55,
      tiemposCumulative: 45,
      cumulativeT11: 55, // acumulado 55 vs tiempos 45 -> diff 10
      isFinalShift: true,
    });
    expect(r.calculated.cumulativeTiemposDifference).toBe(10);
    expect(r.tiemposStatus).toBe("DAILY_UNRESOLVED");
  });

  it("lanza error si el acumulado baja respecto al anterior", () => {
    const previous = makePrevious(100, 50, 0);
    expect(() =>
      reconcileClosing({
        r08: 100,
        t11: 50,
        tucanCumulative: 50, // < prevTucan 100
        tiemposCumulative: 50,
        isFinalShift: false,
        previous,
      }),
    ).toThrow(/menor/);
  });

  it("compensa pendiente previo opuesto (PARTIALLY_RESOLVED)", () => {
    // prevPending = -5; rawDiff = +3 -> signos opuestos -> compensation = 3
    const r = reconcileClosing({
      r08: 100,
      t11: 8,
      tucanCumulative: 100,
      tiemposCumulative: 45,
      isFinalShift: false,
      previous: makePrevious(90, 40, -5),
    });
    // tiemposForShift = 45 - 40 = 5; rawDiff = t11 - 5 = 3
    expect(r.calculated.tiemposRawDifference).toBe(3);
    expect(r.calculated.compensatedTiemposAmount).toBe(3);
    expect(r.tiemposStatus).toBe("PARTIALLY_RESOLVED");
  });

  it("compensación total en shift final queda RESOLVED", () => {
    // prevPending = -5; rawDiff = +5 -> compensation 5 -> combined 0
    const r = reconcileClosing({
      r08: 100,
      t11: 10,
      tucanCumulative: 100,
      tiemposCumulative: 45,
      cumulativeT11: 45,
      isFinalShift: true,
      previous: makePrevious(90, 40, -5),
    });
    expect(r.calculated.compensatedTiemposAmount).toBe(5);
    expect(r.calculated.tiemposPendingAfterClosing).toBe(0);
    expect(r.tiemposStatus).toBe("RESOLVED");
  });
});
