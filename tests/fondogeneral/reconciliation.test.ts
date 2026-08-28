import { describe, expect, it } from "vitest";

import { reconcileClosing } from "@/domain/reconciliation";

describe("closing reconciliation", () => {
  it("ignores a Tucan difference smaller than one colon", () => {
    const result = reconcileClosing({
      r08: 111_111,
      t11: 500,
      tucanCumulative: 111_111.02,
      tiemposCumulative: 500,
      isFinalShift: false,
    });

    expect(result.calculated.tucanDifference).toBe(0);
  });

  it("does not carry a Tiempos difference smaller than one colon to the next shift", () => {
    const result = reconcileClosing({
      r08: 100,
      t11: 500,
      tucanCumulative: 100,
      tiemposCumulative: 500.99,
      isFinalShift: false,
    });

    expect(result.calculated.tiemposRawDifference).toBe(0);
    expect(result.calculated.tiemposPendingAfterClosing).toBe(0);
    expect(result.tiemposStatus).toBe("MATCHED");
  });

  it("keeps a difference of exactly one colon", () => {
    const result = reconcileClosing({
      r08: 100,
      t11: 500,
      tucanCumulative: 101,
      tiemposCumulative: 500,
      isFinalShift: false,
    });

    expect(result.calculated.tucanDifference).toBe(-1);
  });
});
