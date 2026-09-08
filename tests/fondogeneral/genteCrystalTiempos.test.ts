import { describe, expect, test } from "vitest";
import { buildGenteCrystalDisplayResult } from "../../src/app/fondogeneral/components/genteCrystalTiempos.ts";
import type { GenteCrystalDailySalesResponse } from "../../src/services/gente-crystal-sales.ts";

describe("buildGenteCrystalDisplayResult", () => {
  test("groups both local tickets after the second half of the sale arrives", () => {
    const specialOnly: GenteCrystalDailySalesResponse = {
      ok: true,
      companyId: "DELIKOR PALMARES",
      date: "2026-09-08",
      timezone: "America/Costa_Rica",
      summary: {
        count: 1,
        total: 50,
        indirectCount: 0,
        indirectTotal: 0,
      },
      sales: [
        {
          ticketId: "42661-2204-59898072",
          sorteo: "Nica Especial 11:00 Am",
          monto: 50,
          saleAt: "2026-09-08T16:34:53.755Z",
          captureOrigin: "local_button",
        },
      ],
    };

    expect(buildGenteCrystalDisplayResult(specialOnly).sales).toHaveLength(1);

    const completeSale: GenteCrystalDailySalesResponse = {
      ...specialOnly,
      summary: {
        count: 2,
        total: 100,
        indirectCount: 0,
        indirectTotal: 0,
      },
      sales: [
        ...specialOnly.sales,
        {
          ticketId: "42662-2204-59898071",
          sorteo: "Nica 11:00 Am",
          monto: 50,
          saleAt: "2026-09-08T16:34:53.755Z",
          captureOrigin: "local_button",
        },
      ],
    };

    expect(buildGenteCrystalDisplayResult(completeSale)).toMatchObject({
      summary: {
        count: 1,
        total: 100,
        indirectCount: 0,
        indirectTotal: 0,
      },
      sales: [
        {
          ticketIds: [
            "42661-2204-59898072",
            "42662-2204-59898071",
          ],
          sorteo: "Nica Especial 11:00 Am + Nica 11:00 Am",
          monto: 100,
          saleAt: "2026-09-08T16:34:53.755Z",
          captureOrigin: "local_button",
        },
      ],
    });
  });
});
