import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  readAuthSession: vi.fn(),
  listDirectoryUsersForActor: vi.fn(),
}));

vi.mock("@/lib/auth/session-store.server", () => ({
  readAuthSession: mocks.readAuthSession,
}));

vi.mock("@/lib/auth/user-directory.server", () => ({
  listDirectoryUsersForActor: mocks.listDirectoryUsersForActor,
}));

import { GET } from "@/app/api/users/route";

describe("GET /api/users", () => {
  beforeEach(() => {
    mocks.readAuthSession.mockReset();
    mocks.listDirectoryUsersForActor.mockReset();
  });

  it("rechaza solicitudes sin sesion", async () => {
    mocks.readAuthSession.mockResolvedValue(null);

    const response = await GET(new NextRequest("https://timemaster.es/api/users"));

    expect(response.status).toBe(401);
    expect(mocks.listDirectoryUsersForActor).not.toHaveBeenCalled();
  });

  it("devuelve solo el directorio saneado autorizado por el servidor", async () => {
    const actor = { id: "user-a", role: "user", ownerId: "owner-a" };
    mocks.readAuthSession.mockResolvedValue({ user: actor });
    mocks.listDirectoryUsersForActor.mockResolvedValue([
      { id: "user-a", name: "Usuario A", email: "user-a@example.com" },
    ]);

    const response = await GET(
      new NextRequest("https://timemaster.es/api/users?id=user-a"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.listDirectoryUsersForActor).toHaveBeenCalledWith(actor, {
      id: "user-a",
    });
    expect(body.users).toEqual([
      { id: "user-a", name: "Usuario A", email: "user-a@example.com" },
    ]);
    expect(JSON.stringify(body)).not.toContain("password");
  });
});
