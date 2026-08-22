import { describe, expect, it } from "vitest";

import { getTiemposTucanUpdateAccess } from "@/app/fondogeneral/utils/tiemposTucanUpdateAccess";

describe("getTiemposTucanUpdateAccess", () => {
  it("permite a un user actualizar solo dentro de las ventanas de cierre D o N", () => {
    const closingWindow = {
      minutesBeforeEnd: 15,
      minutesAfterEnd: 90,
    };

    expect(
      getTiemposTucanUpdateAccess({
        role: "user",
        now: new Date("2026-08-21T01:50:00.000Z"), // 19:50 CR
        ...closingWindow,
      }),
    ).toEqual({ allowed: true, turno: "D" });

    expect(
      getTiemposTucanUpdateAccess({
        role: "user",
        now: new Date("2026-08-21T06:30:00.000Z"), // 00:30 CR
        ...closingWindow,
      }),
    ).toEqual({ allowed: true, turno: "N" });

    expect(
      getTiemposTucanUpdateAccess({
        role: "user",
        now: new Date("2026-08-21T22:00:00.000Z"), // 16:00 CR
        ...closingWindow,
      }),
    ).toEqual({ allowed: false, turno: null });
  });

  it("usa el horario de cierre de la empresa en lugar de medianoche para el turno N", () => {
    const palmaresWindow = {
      role: "user",
      horarioApertura: "07:45",
      horarioCierre: "23:45",
      minutesBeforeEnd: 15,
      minutesAfterEnd: 90,
    } as const;

    expect(
      getTiemposTucanUpdateAccess({
        now: new Date("2026-08-22T02:16:00.000Z"), // 20:16 CR
        ...palmaresWindow,
      }),
    ).toEqual({ allowed: false, turno: null });

    expect(
      getTiemposTucanUpdateAccess({
        now: new Date("2026-08-22T05:40:00.000Z"), // 23:40 CR
        ...palmaresWindow,
      }),
    ).toEqual({ allowed: true, turno: "N" });
  });

  it("no inventa una ventana D cuando la empresa tiene horario configurado sin corte de turno", () => {
    expect(
      getTiemposTucanUpdateAccess({
        role: "user",
        horarioApertura: "07:45",
        horarioCierre: "23:45",
        now: new Date("2026-08-21T21:50:00.000Z"), // 15:50 CR
        minutesBeforeEnd: 15,
        minutesAfterEnd: 90,
      }),
    ).toEqual({ allowed: false, turno: null });
  });

  it("permite el turno D solo cuando recibe el corte real usado por el cierre", () => {
    expect(
      getTiemposTucanUpdateAccess({
        role: "user",
        horarioApertura: "07:45",
        horarioCierre: "23:45",
        shiftChangeMin: 20 * 60,
        now: new Date("2026-08-22T01:50:00.000Z"), // 19:50 CR
        minutesBeforeEnd: 15,
        minutesAfterEnd: 90,
      }),
    ).toEqual({ allowed: true, turno: "D" });
  });

  it("permite a admin y superadmin actualizar fuera de horario", () => {
    const outsideWindow = {
      now: new Date("2026-08-21T22:00:00.000Z"), // 16:00 CR
      minutesBeforeEnd: 15,
      minutesAfterEnd: 90,
    };

    expect(
      getTiemposTucanUpdateAccess({ role: "admin", ...outsideWindow }),
    ).toEqual({ allowed: true, turno: null });
    expect(
      getTiemposTucanUpdateAccess({ role: "superadmin", ...outsideWindow }),
    ).toEqual({ allowed: true, turno: null });
  });
});
