import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  addWithId: vi.fn(),
  getById: vi.fn(),
}));

vi.mock("@/services/firestore", () => ({
  FirestoreService: {
    addWithId: firestoreMocks.addWithId,
    getById: firestoreMocks.getById,
  },
}));

vi.mock("@/services/users", () => ({
  UsersService: {
    getUserById: vi.fn(),
  },
}));

import { EmpresasService } from "@/services/empresas";
import {
  DEFAULT_FONDO_MOVEMENT_INTERVAL_SECONDS,
  getFondoMovementCooldownRemainingMs,
  getFondoMovementCooldownMs,
  normalizeFondoMovementIntervalSeconds,
} from "@/utils/companyMovementCooldown";

describe("intervalo entre movimientos de Fondo General por empresa", () => {
  beforeEach(() => {
    firestoreMocks.addWithId.mockReset().mockResolvedValue(undefined);
    firestoreMocks.getById.mockReset();
  });

  it("mantiene 60 segundos para empresas sin configuracion valida", () => {
    expect(DEFAULT_FONDO_MOVEMENT_INTERVAL_SECONDS).toBe(60);
    expect(normalizeFondoMovementIntervalSeconds(undefined)).toBe(60);
    expect(normalizeFondoMovementIntervalSeconds("invalido")).toBe(60);
    expect(Number.isFinite(getFondoMovementCooldownMs(1e308))).toBe(true);
  });

  it("calcula la espera restante con los segundos configurados", () => {
    expect(getFondoMovementCooldownRemainingMs(10_000, 15_000, 12)).toBe(
      7_000,
    );
    expect(getFondoMovementCooldownRemainingMs(10_000, 15_000, 0)).toBe(0);
    expect(getFondoMovementCooldownRemainingMs(20_000, 15_000, 0)).toBe(0);
  });

  it("normaliza y guarda el intervalo en la configuracion de empresa", async () => {
    await EmpresasService.addEmpresa({
      id: "EMPRESA A",
      ownerId: "",
      name: "EMPRESA A",
      ubicacion: "EMPRESA A",
      fondoMovementIntervalSeconds: 12.6,
      empleados: [],
    });

    expect(firestoreMocks.addWithId).toHaveBeenCalledWith(
      "empresas",
      "EMPRESA A",
      expect.objectContaining({ fondoMovementIntervalSeconds: 13 }),
    );
  });

  it("carga 0 como intervalo valido para desactivar la espera", async () => {
    firestoreMocks.getById.mockResolvedValue({
      id: "EMPRESA A",
      ownerId: "owner-a",
      name: "EMPRESA A",
      ubicacion: "EMPRESA A",
      fondoMovementIntervalSeconds: 0,
      empleados: [],
    });

    await expect(EmpresasService.getEmpresaById("EMPRESA A")).resolves.toEqual(
      expect.objectContaining({ fondoMovementIntervalSeconds: 0 }),
    );
  });
});
