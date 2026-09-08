import { describe, expect, test } from "vitest";
import { mergeGenteCrystalSale } from "../../src/lib/gente-crystal/sales.ts";

const TICKET_ID = "42662-2204-59894181";

const activeSale = (saleAt: Date) => ({
  ticketId: TICKET_ID,
  sorteo: "Nica 11:00 Am",
  monto: 100,
  saleAt,
  captureOrigin: "indirect" as const,
  status: "active" as const,
});

describe("mergeGenteCrystalSale tombstones", () => {
  test("keeps a deleted sale when a newer active event for the same ticket arrives", () => {
    const deletedAt = new Date("2026-09-08T08:30:00.000Z");
    const resoldAt = new Date("2026-09-08T08:45:00.000Z");

    const existing = {
      ticketId: TICKET_ID,
      status: "deleted" as const,
      receivedAt: deletedAt,
      updatedAt: deletedAt,
      deviceId: "palmares-01",
      source: "gente-crystal" as const,
    };

    const merged = mergeGenteCrystalSale(
      existing,
      activeSale(resoldAt),
      "palmares-01",
      resoldAt,
    );

    expect(merged).toEqual({ action: "already_exists" });
  });

  test("keeps the tombstone when an older active event arrives out of order", () => {
    const deletedAt = new Date("2026-09-08T08:30:00.000Z");
    const staleActiveAt = new Date("2026-09-08T08:15:00.000Z");

    const existing = {
      ticketId: TICKET_ID,
      status: "deleted" as const,
      receivedAt: deletedAt,
      updatedAt: deletedAt,
      deviceId: "palmares-01",
      source: "gente-crystal" as const,
    };

    const merged = mergeGenteCrystalSale(
      existing,
      activeSale(staleActiveAt),
      "palmares-01",
      staleActiveAt,
    );

    expect(merged.action).toBe("already_exists");
  });

  test("keeps the tombstone when a deleted event repeats", () => {
    const deletedAt = new Date("2026-09-08T08:30:00.000Z");

    const existing = {
      ticketId: TICKET_ID,
      status: "deleted" as const,
      receivedAt: deletedAt,
      updatedAt: deletedAt,
      deviceId: "palmares-01",
      source: "gente-crystal" as const,
    };

    const merged = mergeGenteCrystalSale(
      existing,
      { ticketId: TICKET_ID, status: "deleted" },
      "palmares-01",
      deletedAt,
    );

    expect(merged.action).toBe("already_exists");
  });
});
