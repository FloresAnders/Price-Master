import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthSession: vi.fn(),
  readAuthSession: vi.fn(),
  revokeAuthSession: vi.fn(),
  getActiveUsers: vi.fn(),
  verifyPasswordServer: vi.fn(),
  createEnrollmentGrant: vi.fn(),
}));

vi.mock("@/services/users", () => ({
  UsersService: { getActiveUsers: mocks.getActiveUsers },
}));

vi.mock("@/lib/auth/password.server", () => ({
  verifyPasswordServer: mocks.verifyPasswordServer,
  hashPasswordServer: vi.fn(),
}));

vi.mock("@/lib/auth/session-store.server", () => ({
  createAuthSession: mocks.createAuthSession,
  readAuthSession: mocks.readAuthSession,
  revokeAuthSession: mocks.revokeAuthSession,
  serializeSafeUser: (user: Record<string, unknown>) => {
    const { password: _password, ...safe } = user;
    return safe;
  },
}));

vi.mock("@/lib/passkeys/ceremonies.server", () => ({
  getCeremonyService: () => ({
    createEnrollmentGrant: mocks.createEnrollmentGrant,
  }),
}));

vi.mock("@/lib/auth/session-cookie.server", () => ({
  AUTH_COOKIE_NAME: "pricemaster_auth",
  createSessionCookieValue: () => "legacy-self-contained-token",
  sessionCookieOptions: (maxAge = 2_592_000) => ({
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge,
  }),
  setAuthCookie: (
    response: { cookies: { set(name: string, value: string, options: object): void } },
    token: string,
    maxAge: number,
  ) => response.cookies.set("pricemaster_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge,
  }),
  clearAuthCookie: (response: {
    cookies: { set(name: string, value: string, options: object): void };
  }) => response.cookies.set("pricemaster_auth", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  }),
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

describe("server session routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveUsers.mockResolvedValue([
      {
        id: "u1",
        name: "ALCHACAS",
        password: "$argon2id$stored",
        role: "user",
        isActive: true,
      },
    ]);
    mocks.verifyPasswordServer.mockResolvedValue(true);
    mocks.createAuthSession.mockResolvedValue({
      token: "opaque-session-token",
      record: {
        id: "session-id",
        expiresAt: Date.now() + 3_600_000,
      },
    });
    mocks.revokeAuthSession.mockResolvedValue(true);
    mocks.createEnrollmentGrant.mockResolvedValue({ id: "grant-id" });
    mocks.readAuthSession.mockResolvedValue({
      user: {
        id: "u1",
        name: "ALCHACAS",
        role: "user",
        isActive: true,
      },
      session: {
        authMethod: "passkey",
        expiresAt: 1_800_000_000_000,
      },
    });
  });

  it("el login establece el token opaco emitido por el servidor", async () => {
    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ALCHACAS", password: "secret" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "pricemaster_auth=opaque-session-token",
    );
    expect(await response.json()).toEqual({
      ok: true,
      user: {
        id: "u1",
        name: "ALCHACAS",
        role: "user",
        isActive: true,
      },
    });
  });

  it("el logout revoca la sesión antes de borrar la cookie", async () => {
    const request = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: "pricemaster_auth=opaque-session-token" },
    });

    const response = await logout(request);

    expect(response.status).toBe(200);
    expect(mocks.revokeAuthSession).toHaveBeenCalledWith(
      "pricemaster_auth=opaque-session-token",
      "logout",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "pricemaster_auth=;",
    );
  });

  it("entrega una concesión breve cuando se solicita activar passkey", async () => {
    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "ALCHACAS",
          password: "secret",
          enrollPasskey: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      enrollmentGrantId: "grant-id",
    });
  });

  it("hidrata la sesión actual desde la cookie del servidor", async () => {
    let getSession:
      | ((request: Request) => Promise<Response>)
      | undefined;
    try {
      ({ GET: getSession } = await import("@/app/api/auth/session/route"));
    } catch {
      getSession = undefined;
    }

    expect(getSession).toBeTypeOf("function");
    const response = await getSession!(
      new Request("http://localhost/api/auth/session", {
        headers: { cookie: "pricemaster_auth=opaque-session-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      user: {
        id: "u1",
        name: "ALCHACAS",
        role: "user",
        isActive: true,
      },
      session: {
        authMethod: "passkey",
        expiresAt: 1_800_000_000_000,
      },
    });
  });
});
