import { describe, expect, it } from "vitest";
import {
  buildCostaRicaCurrentDayRange,
  buildCostaRicaDayRange,
} from "@/app/fondogeneral/utils/costaRicaDay";

describe("Fondo Costa Rica calendar day", () => {
  it("keeps 05:59:59 UTC in the previous Costa Rica day", () => {
    expect(
      buildCostaRicaCurrentDayRange(
        new Date("2026-08-29T05:59:59.000Z"),
      ),
    ).toEqual({
      dateKey: "2026-08-28",
      startIso: "2026-08-28T06:00:00.000Z",
      endIsoExclusive: "2026-08-29T06:00:00.000Z",
    });
  });

  it("starts a new Costa Rica day at 06:00:00 UTC", () => {
    expect(
      buildCostaRicaCurrentDayRange(
        new Date("2026-08-29T06:00:00.000Z"),
      ),
    ).toEqual({
      dateKey: "2026-08-29",
      startIso: "2026-08-29T06:00:00.000Z",
      endIsoExclusive: "2026-08-30T06:00:00.000Z",
    });
  });

  it("rejects calendar dates that normalize into another day", () => {
    expect(() => buildCostaRicaDayRange("2026-02-30")).toThrow(
      "Fecha de Fondo General inválida",
    );
  });
});
