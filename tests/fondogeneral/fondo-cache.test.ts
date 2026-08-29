import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFondoCacheKey,
  clearFondoCacheForUser,
  invalidateFondoCache,
  readFondoCache,
  subscribeFondoCacheInvalidation,
  writeFondoCache,
  type FondoCacheScope,
} from "@/services/fondo-cache";

const baseScope: FondoCacheScope = {
  databaseId: "restauracion",
  userId: "user-1",
  ownerId: "owner-1",
  companyId: "DELIKOR PALMARES",
  accountId: "FondoGeneral",
  resource: "movements",
  dateKey: "2026-08-29",
};

describe("Fondo IndexedDB cache", () => {
  beforeEach(async () => {
    await invalidateFondoCache({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("distinguishes fresh and stale data with the caller clock", async () => {
    await writeFondoCache(baseScope, [{ id: "movement-1" }], 45_000, 1_000);

    expect(await readFondoCache(baseScope, 20_000)).toMatchObject({
      data: [{ id: "movement-1" }],
      freshness: "fresh",
      storedAt: 1_000,
      expiresAt: 46_000,
    });
    expect(await readFondoCache(baseScope, 50_000)).toMatchObject({
      freshness: "stale",
    });
  });

  it("does not expose one tenant or database record to another", async () => {
    await writeFondoCache(baseScope, ["private"], 45_000, 1_000);

    expect(
      await readFondoCache({ ...baseScope, userId: "user-2" }, 2_000),
    ).toBeNull();
    expect(
      await readFondoCache({ ...baseScope, databaseId: "(default)" }, 2_000),
    ).toBeNull();
  });

  it("invalidates only matching records and notifies subscribers", async () => {
    const otherCompany = { ...baseScope, companyId: "OTHER" };
    await writeFondoCache(baseScope, ["delete-me"], 45_000, 1_000);
    await writeFondoCache(otherCompany, ["keep-me"], 45_000, 1_000);
    const listener = vi.fn();
    const unsubscribe = subscribeFondoCacheInvalidation(listener);

    await invalidateFondoCache({
      userId: baseScope.userId,
      companyId: baseScope.companyId,
      resource: "movements",
    });

    expect(await readFondoCache(baseScope, 2_000)).toBeNull();
    expect(await readFondoCache(otherCompany, 2_000)).toMatchObject({
      data: ["keep-me"],
    });
    expect(listener).toHaveBeenCalledWith({
      userId: baseScope.userId,
      companyId: baseScope.companyId,
      resource: "movements",
    });
    unsubscribe();
  });

  it("clears only records owned by the signed-out user", async () => {
    await writeFondoCache(baseScope, ["user-1"], 45_000, 1_000);
    const otherUser = { ...baseScope, userId: "user-2" };
    await writeFondoCache(otherUser, ["user-2"], 45_000, 1_000);

    await clearFondoCacheForUser("user-1");

    expect(await readFondoCache(baseScope, 2_000)).toBeNull();
    expect(await readFondoCache(otherUser, 2_000)).toMatchObject({
      data: ["user-2"],
    });
  });

  it("returns null without blocking when IndexedDB is unavailable", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: undefined,
    });

    await expect(readFondoCache(baseScope, 2_000)).resolves.toBeNull();

    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: original,
    });
  });

  it("builds different identities for account and date changes", () => {
    expect(buildFondoCacheKey(baseScope)).not.toBe(
      buildFondoCacheKey({ ...baseScope, accountId: "BAC" }),
    );
    expect(buildFondoCacheKey(baseScope)).not.toBe(
      buildFondoCacheKey({ ...baseScope, dateKey: "2026-08-30" }),
    );
  });
});
