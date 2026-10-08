import { describe, expect, it } from "vitest";
import {
  buildCashOpeningPersistenceTiming,
  isOpeningRequirementEligibleForEnforcement,
  resolveCashOpeningEnforcementWindow,
  resolveCashOpeningDayShiftHours,
} from "@/app/fondogeneral/utils/fondo/cashOpeningEnforcement";
import { sanitizeFondoEntries } from "@/app/fondogeneral/utils/helpers";

const baseConfig = {
  horarioApertura: "08:00",
  horarioCierre: "23:00",
  dayShiftHours: 8,
  minutesBeforeEnd: 15,
  minutesAfterEnd: 90,
};

describe("resolveCashOpeningEnforcementWindow", () => {
  it("uses configured or scheduled shift hours and never falls back to a fixed duration", () => {
    expect(
      resolveCashOpeningDayShiftHours({
        empresa: {
          configurarHorasTurno: true,
          horasTurnoD: 6,
          horasTurnoN: 8,
          horarioApertura: "08:00",
          horarioCierre: "22:00",
        },
      }),
    ).toBe(6);
    expect(
      resolveCashOpeningDayShiftHours({
        empresa: {
          empleados: [{ Empleado: "Ana", hoursPerShift: 7.5 }],
        },
        entryD: { employeeName: "Ana", horasPorDia: 8 },
      }),
    ).toBe(7.5);
    expect(
      resolveCashOpeningDayShiftHours({
        empresa: { empleados: [] },
        entryD: { employeeName: "Ana", horasPorDia: 6.25 },
      }),
    ).toBe(6.25);
    expect(
      resolveCashOpeningDayShiftHours({
        empresa: { empleados: [] },
      }),
    ).toBeNull();
  });

  it.each([
    ["2026-10-08T21:45:00.000Z", "normal"], // 15:45 CR
    ["2026-10-08T21:46:00.000Z", "required"], // 15:46 CR
    ["2026-10-08T22:00:59.000Z", "required"], // 16:00 CR
    ["2026-10-08T23:30:59.000Z", "required"], // 17:30 CR
    ["2026-10-08T23:31:00.000Z", "normal"], // 17:31 CR
  ])("respects the configured D boundaries at %s", (nowISO, status) => {
    expect(
      resolveCashOpeningEnforcementWindow({ nowISO, ...baseConfig }).status,
    ).toBe(status);
  });

  it("reports the next configured boundary without minute polling", () => {
    expect(
      resolveCashOpeningEnforcementWindow({
        nowISO: "2026-10-08T20:00:00.000Z", // 14:00 CR
        ...baseConfig,
      }),
    ).toEqual({
      status: "normal",
      nextTransitionISO: "2026-10-08T21:46:00.000Z",
    });
    expect(
      resolveCashOpeningEnforcementWindow({
        nowISO: "2026-10-08T23:31:00.000Z", // 17:31 CR
        ...baseConfig,
      }),
    ).toEqual({
      status: "normal",
      nextTransitionISO: "2026-10-09T04:46:00.000Z",
    });
  });

  it("keeps the real time through the D end minute and backdates later openings", () => {
    const onTime = resolveCashOpeningEnforcementWindow({
      nowISO: "2026-10-08T22:00:59.000Z",
      ...baseConfig,
    });
    const late = resolveCashOpeningEnforcementWindow({
      nowISO: "2026-10-08T22:01:00.000Z",
      ...baseConfig,
    });

    expect(onTime).toMatchObject({
      status: "required",
      turno: "D",
      isLate: false,
      effectiveOpeningISO: "2026-10-08T22:00:59.000Z",
    });
    expect(late).toMatchObject({
      status: "required",
      turno: "D",
      isLate: true,
      effectiveOpeningISO: "2026-10-08T21:58:00.000Z",
    });
  });

  it("derives D from the configured opening and shift duration instead of fixed hours", () => {
    const decision = resolveCashOpeningEnforcementWindow({
      nowISO: "2026-10-08T19:41:00.000Z", // 13:41 CR
      horarioApertura: "07:30",
      horarioCierre: "21:15",
      dayShiftHours: 6.5,
      minutesBeforeEnd: 20,
      minutesAfterEnd: 45,
    });

    expect(decision).toMatchObject({
      status: "required",
      turno: "D",
      shiftEndISO: "2026-10-08T20:00:00.000Z",
      mandatoryStartISO: "2026-10-08T19:41:00.000Z",
      releaseISO: "2026-10-08T20:46:00.000Z",
    });
  });

  it.each([
    ["2026-10-09T05:15:00.000Z", "normal"], // 23:15 CR
    ["2026-10-09T05:16:00.000Z", "required"], // 23:16 CR
    ["2026-10-09T07:00:59.000Z", "required"], // 01:00 CR
    ["2026-10-09T07:01:00.000Z", "normal"], // 01:01 CR
  ])("respects the configured N boundaries at %s", (nowISO, status) => {
    expect(
      resolveCashOpeningEnforcementWindow({
        nowISO,
        ...baseConfig,
        horarioCierre: "23:30",
      }).status,
    ).toBe(status);
  });

  it("backdates a late N opening to two minutes before its configured close", () => {
    expect(
      resolveCashOpeningEnforcementWindow({
        nowISO: "2026-10-09T05:31:00.000Z", // 23:31 CR
        ...baseConfig,
        horarioCierre: "23:30",
      }),
    ).toMatchObject({
      status: "required",
      turno: "N",
      isLate: true,
      effectiveOpeningISO: "2026-10-09T05:28:00.000Z",
    });
  });

  it("prefers the current N window when a long D tolerance overlaps it", () => {
    expect(
      resolveCashOpeningEnforcementWindow({
        nowISO: "2026-10-09T05:20:00.000Z", // 23:20 CR
        ...baseConfig,
        horarioCierre: "23:30",
        minutesAfterEnd: 500,
      }),
    ).toMatchObject({
      status: "required",
      turno: "N",
      isLate: false,
    });
  });

  it("assigns an overnight N close to the operational day that started before midnight", () => {
    expect(
      resolveCashOpeningEnforcementWindow({
        nowISO: "2026-10-09T09:30:00.000Z", // 03:30 CR
        horarioApertura: "10:00",
        horarioCierre: "02:00",
        dayShiftHours: 8,
        minutesBeforeEnd: 15,
        minutesAfterEnd: 90,
      }).status,
    ).toBe("required");
    expect(
      resolveCashOpeningEnforcementWindow({
        nowISO: "2026-10-09T09:31:00.000Z", // 03:31 CR
        horarioApertura: "10:00",
        horarioCierre: "02:00",
        dayShiftHours: 8,
        minutesBeforeEnd: 15,
        minutesAfterEnd: 90,
      }).status,
    ).toBe("normal");
  });

  it("does not apply a D window to an opening requirement created by the D close", () => {
    const window = resolveCashOpeningEnforcementWindow({
      nowISO: "2026-10-08T22:10:00.000Z",
      ...baseConfig,
    });

    expect(window.status).toBe("required");
    if (window.status !== "required") throw new Error("Expected D window");

    expect(
      isOpeningRequirementEligibleForEnforcement({
        window,
        latestClosingISO: "2026-10-08T22:05:00.000Z",
      }),
    ).toBe(false);
    expect(
      isOpeningRequirementEligibleForEnforcement({
        window,
        latestClosingISO: "2026-10-08T05:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("preserves the real registration time while persisting the adjusted opening time", () => {
    const window = resolveCashOpeningEnforcementWindow({
      nowISO: "2026-10-08T22:20:35.000Z", // 16:20 CR
      ...baseConfig,
    });
    if (window.status !== "required") throw new Error("Expected D window");

    expect(
      buildCashOpeningPersistenceTiming({
        registeredAtISO: "2026-10-08T22:20:35.000Z",
        window,
      }),
    ).toEqual({
      createdAt: "2026-10-08T21:58:00.000Z",
      openingRegisteredAt: "2026-10-08T22:20:35.000Z",
      openingTurno: "D",
      openingTimestampAdjusted: true,
    });
  });

  it("keeps the real timestamp when the mandatory opening is still on time", () => {
    const window = resolveCashOpeningEnforcementWindow({
      nowISO: "2026-10-08T21:50:35.000Z", // 15:50 CR
      ...baseConfig,
    });
    if (window.status !== "required") throw new Error("Expected D window");

    expect(
      buildCashOpeningPersistenceTiming({
        registeredAtISO: "2026-10-08T21:50:35.000Z",
        window,
      }),
    ).toEqual({
      createdAt: "2026-10-08T21:50:35.000Z",
      openingRegisteredAt: "2026-10-08T21:50:35.000Z",
      openingTurno: "D",
      openingTimestampAdjusted: false,
    });
  });

  it("keeps opening timing audit fields after movement hydration", () => {
    const [entry] = sanitizeFondoEntries([
      {
        id: "apertura-1",
        providerCode: "APERTURA DE FONDO",
        invoiceNumber: "08-10-2026",
        paymentType: "INFORMATIVO",
        amountEgreso: 0,
        amountIngreso: 0,
        manager: "Ana",
        notes: "APERTURA DE FONDO",
        createdAt: "2026-10-08T21:58:00.000Z",
        accountId: "FondoGeneral",
        openingRegisteredAt: "2026-10-08T22:20:35.000Z",
        openingTurno: "D",
        openingTimestampAdjusted: true,
      },
    ]);

    expect(entry).toMatchObject({
      openingRegisteredAt: "2026-10-08T22:20:35.000Z",
      openingTurno: "D",
      openingTimestampAdjusted: true,
    });
  });
});
