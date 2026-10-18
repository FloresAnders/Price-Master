import { describe, expect, it, vi } from "vitest";

import { createFirestoreDatabaseSelector } from "../../functions/modules/firebase.js";

describe("selector de base para eventos de movimientos", () => {
  it("usa getFirestore sin nombre para (default)", () => {
    const getFirestore = vi.fn(() => "default-db");
    const selectDatabase = createFirestoreDatabaseSelector(getFirestore);

    expect(selectDatabase("(default)")).toBe("default-db");
    expect(getFirestore).toHaveBeenCalledOnce();
    expect(getFirestore).toHaveBeenCalledWith();
  });

  it("usa getFirestore con nombre para restauracion", () => {
    const getFirestore = vi.fn(() => "named-db");
    const selectDatabase = createFirestoreDatabaseSelector(getFirestore);

    expect(selectDatabase("restauracion")).toBe("named-db");
    expect(getFirestore).toHaveBeenCalledOnce();
    expect(getFirestore).toHaveBeenCalledWith("restauracion");
  });

  it("trata un id vacio como (default)", () => {
    const getFirestore = vi.fn(() => "default-db");
    const selectDatabase = createFirestoreDatabaseSelector(getFirestore);

    expect(selectDatabase("  ")).toBe("default-db");
    expect(getFirestore).toHaveBeenCalledWith();
  });
});
