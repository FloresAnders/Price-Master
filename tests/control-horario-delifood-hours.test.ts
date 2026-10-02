import { describe, expect, it } from "vitest";
import {
  getDelifoodDefaultHours,
  getDelifoodEffectiveHours,
  getDelifoodHoursTooltip,
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
});
