import { describe, expect, it } from "vitest";
import { resolveActiveMovementsQuery } from "@/app/fondogeneral/utils/v2movements";

describe("Fondo V2 movement query", () => {
  it("uses Costa Rica midnight for the default day", () => {
    expect(
      resolveActiveMovementsQuery({
        fromFilter: null,
        toFilter: null,
        pageSize: "daily",
        currentDailyKey: "2026-08-29",
        todayKey: "2026-08-29",
      }),
    ).toEqual({
      queryKey: "day:2026-08-29",
      startIso: "2026-08-29T06:00:00.000Z",
      endIsoExclusive: "2026-08-30T06:00:00.000Z",
    });
  });

  it("uses inclusive selected dates and an exclusive next-day boundary", () => {
    expect(
      resolveActiveMovementsQuery({
        fromFilter: "2026-08-29",
        toFilter: "2026-08-27",
        pageSize: 25,
        currentDailyKey: "2026-08-29",
        todayKey: "2026-08-29",
      }),
    ).toEqual({
      queryKey: "range:2026-08-27..2026-08-29",
      startIso: "2026-08-27T06:00:00.000Z",
      endIsoExclusive: "2026-08-30T06:00:00.000Z",
    });
  });
});
