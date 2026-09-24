import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("firebase/firestore", () => ({
  collection: (...parts: unknown[]) => parts.join("/"), doc: (...parts: unknown[]) => parts.join("/"),
  query: (...parts: unknown[]) => parts, where: (...parts: unknown[]) => ["where", ...parts],
  orderBy: (...parts: unknown[]) => ["orderBy", ...parts], limit: (n: number) => ["limit", n], startAfter: (cursor: unknown) => ["startAfter", cursor],
  getDocs: vi.fn(), getDocsFromServer: vi.fn(), getDocFromServer: vi.fn(),
}));
import { getDocFromServer, getDocs, getDocsFromServer } from "firebase/firestore";
import { MovimientosFondosService as service } from "@/services/movimientos-fondos";
beforeEach(() => vi.resetAllMocks());
it("loads the normalized ledger exclusively from the server", async () => {
  vi.mocked(getDocFromServer).mockResolvedValue({ exists: () => true, data: () => ({ company: "TEST", state: { revision: 8, updatedAt: "saved" } }) } as never);
  expect(await service.getDocumentFromServer("ledger")).toMatchObject({ company: "TEST", state: { revision: 8, updatedAt: "saved" } });
  expect(getDocFromServer).toHaveBeenCalledWith("db/MovimientosFondos/ledger");
});
it("pages the complete bounded FondoGeneral range through server-only reads", async () => {
  const docs = Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, data: () => ({ amountIngreso: i }) }));
  vi.mocked(getDocsFromServer).mockResolvedValueOnce({ empty: false, docs, size: 100 } as never).mockResolvedValueOnce({ empty: false, docs: [{ id: "last", data: () => ({ amountIngreso: 100 }) }], size: 1 } as never);
  const result = await service.listAllMovementsByCreatedAtRange("ledger", { accountId: "FondoGeneral", startIso: "2026-09-22T12:00:00.000Z", endIsoExclusive: "2026-09-23T06:00:00.001Z" });
  expect(result).toHaveLength(101);
  expect(result[100]).toMatchObject({ id: "last", amountIngreso: 100 });
  expect(getDocs).not.toHaveBeenCalled();
  expect(getDocsFromServer).toHaveBeenCalledTimes(2);
  expect(vi.mocked(getDocsFromServer).mock.calls[0][0]).toEqual([
    "db/MovimientosFondos/ledger/movements",
    ["where", "accountId", "==", "FondoGeneral"],
    ["where", "createdAt", ">=", "2026-09-22T12:00:00.000Z"],
    ["where", "createdAt", "<", "2026-09-23T06:00:00.001Z"],
    ["orderBy", "createdAt", "desc"], ["limit", 100],
  ]);
  expect(vi.mocked(getDocsFromServer).mock.calls[1][0]).toContainEqual(["startAfter", docs[99]]);
});
it("rejects a missing or inverted bound before querying", async () => {
  await expect(service.listAllMovementsByCreatedAtRange("ledger", { accountId: "FondoGeneral", startIso: "", endIsoExclusive: "2026-09-23T06:00:00.001Z" })).rejects.toThrow();
  await expect(service.listAllMovementsByCreatedAtRange("ledger", { accountId: "FondoGeneral", startIso: "2026-09-24T06:00:00.000Z", endIsoExclusive: "2026-09-23T06:00:00.001Z" })).rejects.toThrow();
  expect(getDocsFromServer).not.toHaveBeenCalled();
});
