import { describe, expect, it } from "vitest";
import {
  buildGenteCrystalDailyEntry,
  buildGenteCrystalDailyResultFromDocument,
  genteCrystalCostaRicaDateKey,
  planGenteCrystalDailyMutation,
} from "@/lib/gente-crystal/daily-sales";
import { readGenteCrystalDate } from "@/lib/gente-crystal/read-sales";

const active = {
  ticketId: "42148-2204-59468315",
  sorteo: "LOTERIA",
  captureOrigin: "local_button",
  monto: 2000,
  saleAt: new Date("2026-08-24T00:02:00.000Z"),
  status: "active",
};

describe("Gente Crystal daily sales", () => {
  it("reads Firestore-compatible timestamps before deriving a day", () => {
    expect(
      readGenteCrystalDate({
        toDate: () => new Date("2026-08-24T00:02:00.000Z"),
      }),
    ).toEqual(new Date("2026-08-24T00:02:00.000Z"));
  });

  it("uses the Costa Rica day and stores only the minimal active fields", () => {
    expect(genteCrystalCostaRicaDateKey(active.saleAt)).toBe("2026-08-23");
    expect(
      genteCrystalCostaRicaDateKey(new Date("2026-08-24T06:00:00.000Z")),
    ).toBe("2026-08-24");
    expect(buildGenteCrystalDailyEntry(active)).toEqual({
      sorteo: "LOTERIA",
      captureOrigin: "local_button",
      monto: 2000,
      saleAt: active.saleAt,
      status: "active",
    });
  });

  it("upserts a valid active ticket on its Costa Rica day", () => {
    expect(planGenteCrystalDailyMutation(undefined, active)).toEqual({
      upsert: {
        date: "2026-08-23",
        ticketId: "42148-2204-59468315",
        entry: {
          sorteo: "LOTERIA",
          captureOrigin: "local_button",
          monto: 2000,
          saleAt: active.saleAt,
          status: "active",
        },
      },
    });
  });

  it("upserts an active ticket update without removing its unchanged day", () => {
    const resulting = {
      ...active,
      monto: 3000,
      captureOrigin: "indirect",
    };

    expect(planGenteCrystalDailyMutation(active, resulting)).toEqual({
      upsert: {
        date: "2026-08-23",
        ticketId: "42148-2204-59468315",
        entry: {
          sorteo: "LOTERIA",
          captureOrigin: "indirect",
          monto: 3000,
          saleAt: active.saleAt,
          status: "active",
        },
      },
    });
  });

  it("removes an active ticket when the result is deleted", () => {
    const resulting = { ...active, status: "deleted" };
    expect(planGenteCrystalDailyMutation(active, resulting)).toEqual({
      remove: { date: "2026-08-23", ticketId: active.ticketId },
    });
  });

  it("removes the old day and upserts the new day when an active ticket moves", () => {
    const resulting = {
      ...active,
      saleAt: new Date("2026-08-24T06:00:00.000Z"),
    };

    expect(planGenteCrystalDailyMutation(active, resulting)).toEqual({
      remove: { date: "2026-08-23", ticketId: active.ticketId },
      upsert: {
        date: "2026-08-24",
        ticketId: active.ticketId,
        entry: {
          sorteo: "LOTERIA",
          captureOrigin: "local_button",
          monto: 2000,
          saleAt: resulting.saleAt,
          status: "active",
        },
      },
    });
  });

  it("rebuilds daily results from sales keyed by ticket id", () => {
    expect(
      buildGenteCrystalDailyResultFromDocument({
        sales: {
          "42148-2204-59468315": {
            sorteo: "LOTERIA",
            captureOrigin: "local_button",
            monto: 2000,
            saleAt: new Date("2026-08-24T00:02:00.000Z"),
            status: "active",
          },
          "42148-2204-59468316": {
            sorteo: "NUEVOS TIEMPOS",
            captureOrigin: "indirect",
            monto: 500,
            saleAt: new Date("2026-08-24T06:00:00.000Z"),
            status: "active",
          },
          ignored: { status: "deleted" },
        },
      }),
    ).toEqual({
      summary: {
        count: 2,
        total: 2500,
        indirectCount: 1,
        indirectTotal: 500,
      },
      sales: [
        {
          ticketId: "42148-2204-59468316",
          sorteo: "NUEVOS TIEMPOS",
          monto: 500,
          saleAt: "2026-08-24T06:00:00.000Z",
          captureOrigin: "indirect",
        },
        {
          ticketId: "42148-2204-59468315",
          sorteo: "LOTERIA",
          monto: 2000,
          saleAt: "2026-08-24T00:02:00.000Z",
          captureOrigin: "local_button",
        },
      ],
    });
  });
});
