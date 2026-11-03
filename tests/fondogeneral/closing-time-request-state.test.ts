import { describe, expect, it } from "vitest";
import {
  resolveFondoVentasClosingShift,
  resolveFondoVentasClosingTimeRequestKind,
} from "@/utils/controlHorarioManager";

describe("solicitud de tiempo para CIERRE FONDO VENTAS", () => {
  it("mantiene D hasta exactamente el doble de Cierre FV despues", () => {
    expect(
      resolveFondoVentasClosingShift({
        currentMin: 17 * 60 + 120,
        shiftDEndMin: 17 * 60,
        shiftNEndMin: 1 * 60,
        expectedShift: "N",
        minutesBeforeEnd: 15,
        minutesAfterEnd: 60,
        occupiedShifts: new Set(),
      }),
    ).toBe("D");
  });

  it("cambia a N al pasar el doble de Cierre FV despues de D", () => {
    expect(
      resolveFondoVentasClosingShift({
        currentMin: 17 * 60 + 121,
        shiftDEndMin: 17 * 60,
        shiftNEndMin: 1 * 60,
        expectedShift: "N",
        minutesBeforeEnd: 15,
        minutesAfterEnd: 60,
        occupiedShifts: new Set(),
      }),
    ).toBe("N");
  });

  it.each([
    [-16, "anticipado"],
    [-15, null],
    [60, null],
    [61, "extra"],
  ] as const)(
    "clasifica minuto relativo %s como solicitud %s",
    (minutesRelativeToEnd, expected) => {
      expect(
        resolveFondoVentasClosingTimeRequestKind({
          minutesRelativeToEnd,
          minutesBeforeEnd: 15,
          minutesAfterEnd: 60,
        }),
      ).toBe(expected);
    },
  );
});
