import { beforeEach, describe, expect, it, vi } from "vitest";

const fb = vi.hoisted(() => ({
  collection: vi.fn(), collectionGroup: vi.fn(), getDocs: vi.fn(),
  orderBy: vi.fn((...args: unknown[]) => ({ type: "orderBy", args })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => ({ type: "where", args })),
  limit: vi.fn((value: number) => ({ type: "limit", value })),
  startAfter: vi.fn((value: unknown) => ({ type: "startAfter", value })),
}));
vi.mock("firebase/firestore", () => fb);
vi.mock("@/config/firebase", () => ({ db: {} }));

const filters = {
  fromIso: "2026-08-01T00:00:00.000Z",
  toExclusiveIso: "2026-09-01T00:00:00.000Z",
  empresa: "A",
  currency: "CRC" as const,
};
const doc = (id: string) => ({ id, data: () => ({ movementId: id, empresa: "A", createdAt: id, accountId: "cash", paymentType: "cash", classification: "gasto", amountIngreso: 0, amountEgreso: 1, currency: "CRC" }) });

describe("movement report pagination", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([25, 50, 75, 100] as const)("applies limit(%s)", async (pageSize) => {
    fb.getDocs.mockResolvedValueOnce({ docs: [] });
    const { ReportesMovimientosService } = await import("@/services/reportes-movimientos");
    await ReportesMovimientosService.listDetailItems({ ...filters, limit: pageSize });
    expect(fb.limit).toHaveBeenCalledWith(pageSize);
  });

  it("loads all rows in bounded pages inside the selected range", async () => {
    const first = Array.from({ length: 100 }, (_, index) => doc(`a-${index}`));
    const second = Array.from({ length: 20 }, (_, index) => doc(`b-${index}`));
    fb.getDocs.mockResolvedValueOnce({ docs: first }).mockResolvedValueOnce({ docs: second });
    const { ReportesMovimientosService } = await import("@/services/reportes-movimientos");
    const rows = await ReportesMovimientosService.listDetailItems({ ...filters, limit: "all" });
    expect(rows).toHaveLength(120);
    expect(fb.getDocs).toHaveBeenCalledTimes(2);
    expect(fb.startAfter).toHaveBeenCalledWith(first[99]);
  });
});
