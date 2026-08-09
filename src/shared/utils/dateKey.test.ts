import { describe, expect, it } from "vitest";
import {
  addDays,
  dateKeyToISODate,
  dateToKey,
  isoDateToDateKey,
  isWeekend,
  keyToDate,
  nextBusinessDay,
  visitDayFromDate,
  weekStartKeyFromDateKey,
} from "./dateKey";

describe("dateKey", () => {
  it("dateToKey y keyToDate son inversos (hora local, medianoche)", () => {
    const d = new Date(2026, 7, 9, 15, 30, 45); // 9 ago 2026 15:30
    const key = dateToKey(d);
    expect(keyToDate(key).getTime()).toBe(new Date(2026, 7, 9).getTime());
  });

  it("dateKeyToISODate formatea correcto", () => {
    const key = dateToKey(new Date(2026, 0, 5));
    expect(dateKeyToISODate(key)).toBe("2026-01-05");
  });

  it("isoDateToDateKey redondea al día", () => {
    const key = isoDateToDateKey("2026-08-09");
    expect(key).not.toBeNull();
    expect(dateKeyToISODate(key!)).toBe("2026-08-09");
  });

  it("isoDateToDateKey rechaza formato no YYYY-MM-DD", () => {
    expect(isoDateToDateKey("2026/08/09")).toBeNull();
    expect(isoDateToDateKey("nope")).toBeNull();
    expect(isoDateToDateKey("")).toBeNull();
  });

  // Nota: el código actual no valida mes/día fuera de rango ("2026-13-40"
  // se normaliza por Date). Posible mejora futura documentada en el plan de refactor.
  it("acepta YYYY-MM-DD con normalización de Date (comportamiento actual)", () => {
    expect(dateKeyToISODate(isoDateToDateKey("2026-08-09")!)).toBe("2026-08-09");
  });

  it("visitDayFromDate mapea domingo a D", () => {
    const sunday = new Date(2026, 7, 9); // 9 ago 2026 es domingo
    expect(visitDayFromDate(sunday)).toBe("D");
  });

  it("isWeekend detecta sábado y domingo", () => {
    const saturday = new Date(2026, 7, 8);
    const sunday = new Date(2026, 7, 9);
    const monday = new Date(2026, 7, 10);
    expect(isWeekend(saturday)).toBe(true);
    expect(isWeekend(sunday)).toBe(true);
    expect(isWeekend(monday)).toBe(false);
  });

  it("addDays suma días", () => {
    const base = new Date(2026, 7, 9);
    expect(addDays(base, 3).getDate()).toBe(12);
  });

  it("nextBusinessDay salta fin de semana", () => {
    // viernes 7 ago 2026 -> lunes 10
    const friday = new Date(2026, 7, 7);
    const next = nextBusinessDay(friday);
    expect(dateKeyToISODate(dateToKey(next))).toBe("2026-08-10");
  });

  it("weekStartKeyFromDateKey devuelve el domingo de la semana", () => {
    // jueves 13 ago 2026 -> domingo 9 ago
    const key = dateToKey(new Date(2026, 7, 13));
    const start = weekStartKeyFromDateKey(key);
    expect(dateKeyToISODate(start)).toBe("2026-08-09");
  });
});
