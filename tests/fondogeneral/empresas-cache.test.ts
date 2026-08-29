import { beforeEach, describe, expect, it, vi } from "vitest";

const getAll = vi.hoisted(() => vi.fn());

vi.mock("@/services/firestore", () => ({
  FirestoreService: { getAll },
}));

vi.mock("@/services/users", () => ({
  UsersService: {},
}));

import { EmpresasService } from "@/services/empresas";

describe("EmpresasService concurrent cache", () => {
  beforeEach(() => {
    getAll.mockReset();
    (EmpresasService as unknown as { empresasCache: unknown }).empresasCache = null;
    (EmpresasService as unknown as { empresasInFlight: unknown }).empresasInFlight = null;
  });

  it("shares one Firestore request among concurrent callers and clones results", async () => {
    let resolveRemote!: (value: unknown[]) => void;
    const remotePromise = new Promise<unknown[]>((resolve) => {
      resolveRemote = resolve;
    });
    getAll.mockReturnValue(remotePromise);

    const firstPromise = EmpresasService.getAllEmpresas();
    const secondPromise = EmpresasService.getAllEmpresas();
    const thirdPromise = EmpresasService.getAllEmpresas();
    resolveRemote([
      {
        id: "company-1",
        ownerId: "owner-1",
        name: "ACME",
        ubicacion: "CENTRO",
        empleados: [{ Empleado: "Ana" }],
      },
    ]);

    const [first, second, third] = await Promise.all([
      firstPromise,
      secondPromise,
      thirdPromise,
    ]);

    expect(getAll).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(first).not.toBe(second);
    expect(first[0].empleados).not.toBe(second[0].empleados);
  });

  it("clears a rejected in-flight request so retry can reach Firestore", async () => {
    getAll
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce([]);

    await expect(EmpresasService.getAllEmpresas()).rejects.toThrow("temporary");
    await expect(EmpresasService.getAllEmpresas()).resolves.toEqual([]);
    expect(getAll).toHaveBeenCalledTimes(2);
  });
});
