import { describe, expect, it } from "vitest";
import { resolveAnnualDateRange } from "@/app/fondogeneral/utils/annualDateRange";

describe("resolveAnnualDateRange", () => {
  it("resuelve este año como el año calendario completo", () => {
    const range = resolveAnnualDateRange("year", new Date(2026, 8, 7, 15, 30));

    expect(range?.from).toEqual(new Date(2026, 0, 1));
    expect(range?.to).toEqual(new Date(2026, 11, 31));
  });

  it("resuelve el año anterior como el año calendario completo previo", () => {
    const range = resolveAnnualDateRange(
      "lastyear",
      new Date(2026, 8, 7, 15, 30),
    );

    expect(range?.from).toEqual(new Date(2025, 0, 1));
    expect(range?.to).toEqual(new Date(2025, 11, 31));
  });

  it("ignora filtros que no son anuales", () => {
    expect(resolveAnnualDateRange("month", new Date(2026, 8, 7))).toBeNull();
  });
});
