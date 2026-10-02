import { describe, expect, it } from "vitest";
import {
  getDelifoodDefaultHours,
  getDelifoodEffectiveHours,
  getDelifoodExportCell,
  getDelifoodHoursTooltip,
  sumDelifoodHoursForDays,
} from "@/components/business/control-horario/delifoodShiftHours";

describe("horas de turnos DELIFOOD", () => {
  it("asigna 7 horas a D, 6 a N y 0 a estados no trabajados", () => {
    expect(getDelifoodDefaultHours("D")).toBe(7);
    expect(getDelifoodDefaultHours("N")).toBe(6);
    expect(getDelifoodDefaultHours("L")).toBe(0);
    expect(getDelifoodDefaultHours("V")).toBe(0);
    expect(getDelifoodDefaultHours("I")).toBe(0);
    expect(getDelifoodDefaultHours("")).toBe(0);
  });

  it("prefiere una hora personalizada válida y recupera el valor por turno", () => {
    expect(getDelifoodEffectiveHours("D", 8.5)).toBe(8.5);
    expect(getDelifoodEffectiveHours("N", undefined)).toBe(6);
    expect(getDelifoodEffectiveHours("D", Number.NaN)).toBe(7);
    expect(getDelifoodEffectiveHours("L", 4)).toBe(4);
  });

  it("describe turno y horas en el tooltip", () => {
    expect(getDelifoodHoursTooltip("D", 7)).toBe("Diurno - 7 h");
    expect(getDelifoodHoursTooltip("N", 8.5)).toBe("Nocturno - 8.5 h");
  });

  it("suma D, N y excepciones personalizadas en una quincena", () => {
    expect(
      sumDelifoodHoursForDays(
        { "1": "D", "2": "N", "3": "D", "4": "L" },
        { "3": { hours: 8.5 } },
        [1, 2, 3, 4],
      ),
    ).toEqual({ workedDays: 3, totalHours: 21.5 });
  });

  it("cuenta un estado no trabajado cuando tiene horas personalizadas", () => {
    expect(
      sumDelifoodHoursForDays(
        { "1": "L" },
        { "1": { hours: 4 } },
        [1],
      ),
    ).toEqual({ workedDays: 1, totalHours: 4 });
  });

  it("ignora horas obsoletas cuando la celda no tiene turno", () => {
    expect(
      sumDelifoodHoursForDays({}, { "1": { hours: 9 } }, [1]),
    ).toEqual({ workedDays: 0, totalHours: 0 });
  });

  it("exporta la letra y el color del turno en lugar del número de horas", () => {
    expect(getDelifoodExportCell("D")).toEqual({
      label: "D",
      backgroundColor: "#ffea00",
      textColor: "#000",
    });
    expect(getDelifoodExportCell("")).toEqual({
      label: "",
      backgroundColor: "var(--card-bg)",
      textColor: "var(--foreground)",
    });
  });
});
