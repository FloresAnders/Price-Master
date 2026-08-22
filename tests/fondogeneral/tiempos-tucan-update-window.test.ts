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
