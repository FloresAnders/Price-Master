import { describe, expect, it, vi } from "vitest";
vi.mock("@/config/firebase", () => ({ db: "db" }));
import { ensureV2MovementsLoaded, type EnsureV2LoadedDeps } from "@/app/fondogeneral/utils/v2movementsLoader";
import type { FondoEntry } from "@/app/fondogeneral/types";

const movement: FondoEntry = { id: "m1", createdAt: "2026-09-23T12:00:00.000Z", accountId: "FondoGeneral", currency: "CRC", providerCode: "P1", paymentType: "EFECTIVO", invoiceNumber: "I1", manager: "user", notes: "", amountIngreso: 20, amountEgreso: 0 };

describe("range responses concurrent with realtime cache mutations", () => {
  it.each(["delete", "edit"] as const)("does not overwrite an intervening remote %s", async (operation) => {
    let finish!: (value: { items: FondoEntry[]; cursor: null; exhausted: boolean }) => void;
    const docKey = `concurrency-${operation}`;
    const cacheKey = `${docKey}::FondoGeneral`;
    const cache: EnsureV2LoadedDeps["v2MovementsCacheRef"] = { current: {
      [cacheKey]: { loaded: true, movements: [movement], cursor: null, exhausted: true, loading: false, revision: 0 },
    } };
    const request = ensureV2MovementsLoaded(docKey, { forceRefresh: true }, {
      accountKeyRef: { current: "FondoGeneral" }, v2MovementsCacheRef: cache,
      pageSize: "daily", currentDailyKey: "2026-09-23", todayKey: "2026-09-23", fromFilter: null, toFilter: null,
      rebuildEntriesFromV2Cache: vi.fn(), beginMovementsLoading: vi.fn(), endMovementsLoading: vi.fn(),
      loadRemotePage: () => new Promise((resolve) => { finish = resolve; }),
    });
    // The realtime mutation advances the cache revision and records the affected ID,
    // including a tombstone for deletes, while the old range response is pending.
    cache.current[cacheKey] = { ...cache.current[cacheKey], revision: 1,
      movementVersions: { m1: 1 },
      movements: operation === "delete" ? [] : [{ ...movement, amountIngreso: 99 }],
    };
    finish({ items: [movement], cursor: null, exhausted: true });
    await request;
    expect(cache.current[cacheKey].movements).toEqual(operation === "delete" ? [] : [{ ...movement, amountIngreso: 99 }]);
  });
});
