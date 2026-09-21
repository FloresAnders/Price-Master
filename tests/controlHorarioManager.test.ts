import { describe, expect, it } from "vitest";
import { getCashOpeningAvailabilityAfterDailyClosing } from "@/utils/controlHorarioManager";

describe("apertura posterior al cierre nocturno", () => {
  it("permanece bloqueada durante la tolerancia y se habilita al iniciar el horario de apertura", () => {
    const closingContext = {
      horarioApertura: "06:00",
      horarioCierre: "00:00",
      latestDailyClosing: {
        turno: "N" as const,
        closingDate: "2026-09-13T05:59:00.000Z",
      },
      cierreFondoVentasMinutesBeforeEnd: 15,
      cierreFondoVentasMinutesAfterEnd: 45,
    };

    expect([
      getCashOpeningAvailabilityAfterDailyClosing({
        ...closingContext,
        nowISO: "2026-09-13T06:04:00.000Z",
      }),
      getCashOpeningAvailabilityAfterDailyClosing({
        ...closingContext,
        nowISO: "2026-09-13T12:00:00.000Z",
      }),
    ]).toEqual([
      {
        allowed: false,
        closingTurno: "N",
        waitUntilLabel: "06:00",
        reason: "next_day_shift_not_started",
      },
      { allowed: true },
    ]);
  });
});
