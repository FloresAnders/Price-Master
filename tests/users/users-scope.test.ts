import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ query: vi.fn(), getAll: vi.fn() }));
vi.mock("@/services/firestore", () => ({ FirestoreService: service }));
vi.mock("firebase/firestore", () => ({ onSnapshot: vi.fn(), doc: vi.fn() }));
vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn() }));

describe("actor-scoped users", () => {
  beforeEach(() => { vi.clearAllMocks(); service.query.mockResolvedValue([]); });

  it("queries a secondary admin by ownerId", async () => {
    const { UsersService } = await import("@/services/users");
    await UsersService.getUsersForActor({ id: "admin-2", ownerId: "owner-1", role: "admin", eliminate: true });
    expect(service.query).toHaveBeenCalledWith("users", [
      { field: "ownerId", operator: "==", value: "owner-1" },
    ]);
    expect(service.getAll).not.toHaveBeenCalled();
  });

  it("returns no users when a regular actor has no owner scope", async () => {
    const { UsersService } = await import("@/services/users");
    expect(await UsersService.getUsersForActor({ role: "user" })).toEqual([]);
    expect(service.query).not.toHaveBeenCalled();
  });
});
