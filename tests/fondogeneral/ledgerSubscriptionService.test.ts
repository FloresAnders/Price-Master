import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts: unknown[]) => parts.join("/")),
  doc: vi.fn((...parts: unknown[]) => parts.join("/")),
  onSnapshot: vi.fn(), getDocFromServer: vi.fn(),
}));
import { onSnapshot, getDocFromServer } from "firebase/firestore";
import { MovimientosFondosService as Service } from "@/services/movimientos-fondos";

describe("ledger subscription service", () => {
  beforeEach(() => vi.clearAllMocks());
  it("subscribes only to the ledger with metadata changes and normalizes confirmed state", () => {
    const stop = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(stop);
    const next = vi.fn(); const error = vi.fn();
    expect(Service.subscribeToLedger("company", next, error)).toBe(stop);
    const args = vi.mocked(onSnapshot).mock.calls[0] as unknown as [string, object, (snapshot: unknown) => void, (error: Error) => void];
    expect(args[0]).toBe("db/MovimientosFondos/company");
    expect(args[1]).toEqual({ includeMetadataChanges: true });
    args[2]({ exists: () => true, data: () => ({ company: "ACME", state: { revision: 8 } }), metadata: { hasPendingWrites: true, fromCache: false } });
    expect(next).toHaveBeenCalledWith({ storage: expect.objectContaining({ company: "ACME", state: expect.objectContaining({ revision: 8, balancesByAccount: expect.any(Array) }) }), hasPendingWrites: true, fromCache: false });
    const failure = new Error("permission-denied"); args[3](failure);
    expect(error).toHaveBeenCalledWith(failure);
  });
  it("reads a single server document and normalizes its envelope", async () => {
    vi.mocked(getDocFromServer).mockResolvedValue({ exists: () => true, id: "m1", data: () => ({ id: "wrong", accountId: "invalid", currency: "invalid", amountIngreso: 10 }) } as never);
    expect(await Service.getMovementById("company", "m1", "CajaNegra")).toMatchObject({ id: "m1", accountId: "CajaNegra", currency: "CRC" });
    expect(getDocFromServer).toHaveBeenCalledWith("db/MovimientosFondos/company/cajanegra/m1");
  });
  it("returns null when missing and propagates server errors", async () => {
    vi.mocked(getDocFromServer).mockResolvedValueOnce({ exists: () => false } as never);
    expect(await Service.getMovementById("company", "gone", "FondoGeneral")).toBeNull();
    vi.mocked(getDocFromServer).mockRejectedValueOnce(new Error("offline"));
    await expect(Service.getMovementById("company", "m1", "FondoGeneral")).rejects.toThrow("offline");
  });
});
