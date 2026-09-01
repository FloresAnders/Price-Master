import { describe, expect, it } from "vitest";

import { getCashOpeningAvailabilityAfterDailyClosing } from "@/utils/controlHorarioManager";

describe("getCashOpeningAvailabilityAfterDailyClosing", () => {
  const singleNightClosing = {
    turno: "D" as const,
    closingDate: "2026-08-26T05:52:00.000Z", // 25 Aug, 23:52 Costa Rica
    singleClosingReason: "El negocio realizó un único cierre nocturno.",
  };

  it("blocks reopening after a single night closing stored as shift D", () => {
    const availability = getCashOpeningAvailabilityAfterDailyClosing({
      nowISO: "2026-08-26T05:53:00.000Z", // 25 Aug, 23:53 Costa Rica
      horarioApertura: "06:00",
      horarioCierre: "00:00",
      latestDailyClosing: singleNightClosing,
      shiftChangeMin: 14 * 60,
      cierreFondoVentasMinutesBeforeEnd: 15,
      cierreFondoVentasMinutesAfterEnd: 90,
    });

    expect(availability).toEqual({
      allowed: false,
      closingTurno: "N",
      waitUntilLabel: "06:00",
      reason: "next_day_shift_not_started",
    });
  });

  it("allows opening at the start of the next operational day", () => {
    const availability = getCashOpeningAvailabilityAfterDailyClosing({
      nowISO: "2026-08-26T12:00:00.000Z", // 26 Aug, 06:00 Costa Rica
      horarioApertura: "06:00",
      horarioCierre: "00:00",
      latestDailyClosing: singleNightClosing,
      shiftChangeMin: 14 * 60,
      cierreFondoVentasMinutesBeforeEnd: 15,
      cierreFondoVentasMinutesAfterEnd: 90,
    });

    expect(availability).toEqual({ allowed: true });
  });
});
