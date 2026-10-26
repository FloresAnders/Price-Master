import { afterEach, describe, expect, it, vi } from "vitest";

import { isCostaRicaIndependenceSeason } from "@/components/celebraciones/seasonalTheme";

describe("isCostaRicaIndependenceSeason", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [new Date(2026, 8, 1, 12), true],
    [new Date(2026, 8, 30, 12), true],
    [new Date(2026, 7, 31, 12), false],
    [new Date(2026, 9, 1, 12), false],
  ])("returns the existing September state for %s", (date, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(date);

    expect(isCostaRicaIndependenceSeason()).toBe(expected);
  });
});
