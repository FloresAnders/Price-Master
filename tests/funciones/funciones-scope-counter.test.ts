import { beforeEach, describe, expect, it, vi } from "vitest";

const fsService = vi.hoisted(() => ({ getAll: vi.fn(), query: vi.fn() }));
const fb = vi.hoisted(() => ({
  doc: vi.fn((...path: unknown[]) => ({ path })),
  getDoc: vi.fn(),
  runTransaction: vi.fn(),
}));
vi.mock("@/services/firestore", () => ({ FirestoreService: fsService }));
vi.mock("@/services/users", () => ({ UsersService: { getPrimaryAdminByOwner: vi.fn(async () => ({ name: "Owner" })) } }));
vi.mock("firebase/firestore", () => fb);
vi.mock("@/config/firebase", () => ({ db: {} }));

describe("scoped functions", () => {
  beforeEach(() => { vi.clearAllMocks(); fsService.query.mockResolvedValue([]); fsService.getAll.mockResolvedValue([]); fb.getDoc.mockResolvedValue({ exists: () => false }); });

  it("queries shared general functions instead of reading the full shared collection", async () => {
    const { FuncionesService } = await import("@/services/funciones");
    await FuncionesService.listFuncionesGeneralesAs({ ownerIds: [], role: "admin" });
    expect(fsService.query).toHaveBeenCalledWith("funciones", [
      { field: "type", operator: "==", value: "general" },
    ]);
  });

  it("does not share cached function results between owners", async () => {
    fsService.query
      .mockResolvedValueOnce([{ id: "shared-a", type: "general", funcionId: "SPECIAL", ownerId: "A", nombre: "A" }])
      .mockResolvedValueOnce([{ id: "shared-b", type: "general", funcionId: "SPECIAL", ownerId: "B", nombre: "B" }]);
    const { FuncionesService } = await import("@/services/funciones");
    const a = await FuncionesService.listFuncionesGeneralesAs({ ownerIds: ["A"], role: "user" });
    const b = await FuncionesService.listFuncionesGeneralesAs({ ownerIds: ["B"], role: "user" });
    expect(a.map((item) => item.ownerId)).toEqual(["A"]);
    expect(b.map((item) => item.ownerId)).toEqual(["B"]);
  });

  it("allocates the next numeric id through the owner counter", async () => {
    fsService.getAll.mockResolvedValueOnce([{ funcionId: "0007", ownerId: "owner-1", type: "general" }]);
    fb.runTransaction.mockImplementationOnce(async (_db, callback) => callback({
      get: vi.fn(async () => ({ exists: () => false })),
      set: vi.fn(),
    }));
    const { FuncionesService } = await import("@/services/funciones");
    expect(await FuncionesService.getNextNumericFuncionId({ ownerId: "owner-1" })).toBe("0008");
    expect(fb.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("does not scan owner functions after the counter exists", async () => {
    fb.getDoc.mockResolvedValueOnce({ exists: () => true });
    fb.runTransaction.mockImplementationOnce(async (_db, callback) => callback({
      get: vi.fn(async () => ({ exists: () => true, data: () => ({ nextValue: 9 }) })),
      set: vi.fn(),
    }));
    const { FuncionesService } = await import("@/services/funciones");
    expect(await FuncionesService.getNextNumericFuncionId({ ownerId: "owner-1" })).toBe("0009");
    expect(fsService.getAll).not.toHaveBeenCalled();
  });
});
