import { beforeEach, describe, expect, it, vi } from "vitest";

const remotePage = vi.hoisted(() => vi.fn());

vi.mock("@/services/movimientos-fondos", () => ({
  MovimientosFondosService: {
    listMovementsPageByCreatedAtRange: remotePage,
  },
}));

import { ensureV2MovementsLoaded } from "@/app/fondogeneral/utils/v2movementsLoader";

const scope = {
  databaseId: "restauracion",
  userId: "user-1",
  ownerId: "owner-1",
  companyId: "ACME",
  accountId: "FondoGeneral",
  resource: "movements" as const,
  dateKey: "2026-08-29",
};

const buildDeps = () => ({
  rebuildEntriesFromV2Cache: vi.fn(),
  beginMovementsLoading: vi.fn(),
  endMovementsLoading: vi.fn(),
  pageSize: "daily" as const,
  currentDailyKey: "2026-08-29",
  todayKey: "2026-08-29",
  fromFilter: null,
  toFilter: null,
  accountKeyRef: { current: "FondoGeneral" as const },
  v2MovementsCacheRef: { current: {} },
  persistentCacheScope: scope,
  readPersistentCache: vi.fn(),
  writePersistentCache: vi.fn(),
  loadRemotePage: remotePage,
});

describe("Fondo V2 movement page cache", () => {
  beforeEach(() => {
    remotePage.mockReset();
  });

  it("hydrates a fresh current-day page without a Firestore request", async () => {
    const deps = buildDeps();
    deps.readPersistentCache.mockResolvedValue({
      data: [{ id: "cached", accountId: "FondoGeneral", createdAt: "2026-08-29T10:00:00.000Z" }],
      freshness: "fresh",
      storedAt: 1,
      expiresAt: 2,
    });

    await ensureV2MovementsLoaded("company-acme", undefined, deps as never);

    expect(remotePage).not.toHaveBeenCalled();
    expect(deps.rebuildEntriesFromV2Cache).toHaveBeenCalledWith(
      "company-acme",
      "FondoGeneral",
    );
  });

  it("renders stale data and refreshes one 50-document page", async () => {
    const deps = buildDeps();
    deps.readPersistentCache.mockResolvedValue({
      data: [{ id: "stale", accountId: "FondoGeneral", createdAt: "2026-08-29T09:00:00.000Z" }],
      freshness: "stale",
      storedAt: 1,
      expiresAt: 2,
    });
    remotePage.mockResolvedValue({
      items: [{ id: "fresh", accountId: "FondoGeneral", createdAt: "2026-08-29T10:00:00.000Z" }],
      cursor: null,
      exhausted: true,
    });

    await ensureV2MovementsLoaded("company-acme", undefined, deps as never);

    expect(remotePage).toHaveBeenCalledWith(
      "company-acme",
      expect.objectContaining({ pageSize: 50 }),
    );
    expect(deps.writePersistentCache).toHaveBeenCalledWith(
      scope,
      expect.arrayContaining([expect.objectContaining({ id: "fresh" })]),
      16 * 60 * 60_000,
    );
  });
});
