import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => undefined),
}));
vi.mock("@/services/firestore", () => ({
  FirestoreService: {
    query: mocks.query,
    update: mocks.update,
  },
}));

import { UsersService } from "@/services/users";

describe("bounded login user lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta la clave normalizada con un límite pequeño", async () => {
    mocks.query.mockResolvedValueOnce([
      {
        id: "u1",
        name: "ALCHACAS",
        nameNormalized: "alchacas",
        isActive: true,
      },
    ]);

    const user = await UsersService.findActiveUserByUsername("  AlChAcAs  ");

    expect(user?.id).toBe("u1");
    expect(mocks.query).toHaveBeenCalledWith(
      "users",
      [{ field: "nameNormalized", operator: "==", value: "alchacas" }],
      undefined,
      "asc",
      5,
    );
  });

  it("acota también la compatibilidad con usuarios todavía no migrados", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "legacy", name: "ALCHACAS", isActive: true },
      ]);

    const user = await UsersService.findActiveUserByUsername("alchacas");

    expect(user?.id).toBe("legacy");
    expect(mocks.query).toHaveBeenLastCalledWith(
      "users",
      [
        {
          field: "name",
          operator: "in",
          value: expect.arrayContaining(["alchacas", "ALCHACAS"]),
        },
      ],
      undefined,
      "asc",
      10,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("migra la clave normalizada solo cuando se solicita tras autenticar", async () => {
    await UsersService.backfillUsernameLookup("legacy", "  AlChAcAs  ");

    expect(mocks.update).toHaveBeenCalledWith(
      "users",
      "legacy",
      expect.objectContaining({ nameNormalized: "alchacas" }),
    );
  });
});
