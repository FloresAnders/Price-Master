import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

describe("schedule fortnight cache", () => {
  beforeEach(async () => {
    const { clearScheduleFortnightCache } = await import(
      "@/services/schedule-fortnight-cache"
    );
    await clearScheduleFortnightCache();
  });

  it("calculates both fortnight boundaries", async () => {
    const { getFortnightRange } = await import(
      "@/services/schedule-fortnight-cache"
    );
    expect(getFortnightRange(new Date(2026, 7, 10)).key).toBe(
      "2026-08-01_2026-08-15",
    );
    expect(getFortnightRange(new Date(2026, 7, 20)).key).toBe(
      "2026-08-16_2026-08-31",
    );
  });

  it("isolates cached rows by company and invalidates the changed fortnight", async () => {
    const {
      getFortnightRange,
      readScheduleFortnightCache,
      writeScheduleFortnightCache,
      invalidateScheduleFortnightCache,
    } = await import("@/services/schedule-fortnight-cache");
    const range = getFortnightRange(new Date(2026, 7, 20));
    const rows = [{ companieValue: "A", employeeName: "Ana", year: 2026, month: 8, day: 20, shift: "D" }];

    await writeScheduleFortnightCache("A", range.key, rows);
    expect(await readScheduleFortnightCache("B", range.key)).toBeNull();
    expect(await readScheduleFortnightCache("A", range.key)).toEqual(rows);
    await invalidateScheduleFortnightCache("A", 2026, 8, 20);
    expect(await readScheduleFortnightCache("A", range.key)).toBeNull();
  });

  it("does not write an in-flight stale fetch after invalidation", async () => {
    const {
      getFortnightRange,
      getScheduleFortnightCacheGeneration,
      invalidateScheduleFortnightCache,
      readScheduleFortnightCache,
      writeScheduleFortnightCache,
    } = await import("@/services/schedule-fortnight-cache");
    const range = getFortnightRange(new Date(2026, 7, 20));
    const generation = getScheduleFortnightCacheGeneration("A", range.key);
    await invalidateScheduleFortnightCache("A", 2026, 8, 20);
    await writeScheduleFortnightCache("A", range.key, [], generation);
    expect(await readScheduleFortnightCache("A", range.key)).toBeNull();
  });
});
