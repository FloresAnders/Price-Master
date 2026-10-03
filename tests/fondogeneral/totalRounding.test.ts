import { describe, expect, it } from "vitest";

import { calculateTotalRoundingSummary } from "@/app/fondogeneral/utils/fondo/totalRounding";

describe("redondeo del total de varias facturas", () => {
  it("redondea el total exacto hacia abajo por defecto", () => {
    const summary = calculateTotalRoundingSummary({
      amountsBeforeRounding: [3_139.34, 46_963.89, 85_545.14],
      individualRoundedAmounts: [3_000, 47_000, 86_000],
      roundTotalUp: false,
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(summary).toMatchObject({
      exactTotal: 135_648.37,
      individualRoundedTotal: 136_000,
      finalTotal: 135_000,
      cashDifference: -648.37,
      allocationAdjustments: [0, 0, -1_000],
    });
  });

  it("redondea hacia abajo el total exacto cuando su residuo no supera 500", () => {
    const summary = calculateTotalRoundingSummary({
      amountsBeforeRounding: [3_139.34, 46_663.89, 85_545.14],
      individualRoundedAmounts: [3_000, 47_000, 86_000],
      roundTotalUp: true,
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(summary).toEqual({
      exactTotal: 135_348.37,
      individualRoundedTotal: 136_000,
      finalTotal: 135_000,
      cashDifference: -348.37,
      allocationAdjustments: [0, 0, -1_000],
      effectiveRoundedAmounts: [3_000, 47_000, 85_000],
    });
  });

  it("redondea hacia arriba el total exacto cuando su residuo supera 500", () => {
    const summary = calculateTotalRoundingSummary({
      amountsBeforeRounding: [3_139.34, 46_963.89, 85_545.14],
      individualRoundedAmounts: [3_000, 47_000, 86_000],
      roundTotalUp: true,
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(summary).toMatchObject({
      exactTotal: 135_648.37,
      finalTotal: 136_000,
      cashDifference: 351.63,
      allocationAdjustments: [0, 0, 0],
    });
  });
});
