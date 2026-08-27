import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthSession: vi.fn(),
  readAuthSession: vi.fn(),
  heartbeatAuthSession: vi.fn(),
  revokeAuthSession: vi.fn(),
  findActiveUserByUsername: vi.fn(),
  backfillUsernameLookup: vi.fn(),
  getActiveUsers: vi.fn(),
  verifyPasswordServer: vi.fn(),
  createEnrollmentGrant: vi.fn(),
}));

vi.mock("@/services/users", () => ({
  UsersService: {
    findActiveUserByUsername: mocks.findActiveUserByUsername,
    backfillUsernameLookup: mocks.backfillUsernameLookup,
    getActiveUsers: mocks.getActiveUsers,
  },
}));

vi.mock("@/lib/auth/password.server", () => ({
  verifyPasswordServer: mocks.verifyPasswordServer,
  hashPasswordServer: vi.fn(),
}));

vi.mock("@/lib/auth/session-store.server", () => ({
  createAuthSession: mocks.createAuthSession,
  readAuthSession: mocks.readAuthSession,
  heartbeatAuthSession: mocks.heartbeatAuthSession,
  revokeAuthSession: mocks.revokeAuthSession,
  serializeSafeUser: (user: Record<string, unknown>) => {
    const safe = { ...user };
    delete safe.password;
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
  getSessionTokenFromCookie: () => "opaque-session-token",
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
    mocks.findActiveUserByUsername.mockResolvedValue({
      id: "u1",
      name: "ALCHACAS",
      password: "$argon2id$stored",
      role: "user",
      isActive: true,
    });
    mocks.verifyPasswordServer.mockResolvedValue(true);
    mocks.createAuthSession.mockResolvedValue({
      token: "opaque-session-token",
      record: {
        id: "session-id",
        expiresAt: Date.now() + 3_600_000,
        keepActive: true,
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
        keepActive: true,
      },
    });
    mocks.heartbeatAuthSession.mockResolvedValue({
      id: "session-id",
      authMethod: "password",
      expiresAt: 1_800_000_000_000,
      keepActive: true,
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
    expect(mocks.createAuthSession).toHaveBeenCalledWith({
      userId: "u1",
      role: "user",
      authMethod: "password",
      keepActive: true,
    });
    expect(mocks.findActiveUserByUsername).toHaveBeenCalledWith("ALCHACAS");
    expect(mocks.backfillUsernameLookup).toHaveBeenCalledWith("u1", "ALCHACAS");
    expect(mocks.getActiveUsers).not.toHaveBeenCalled();
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

  it("no escribe la clave normalizada si la contraseña es incorrecta", async () => {
    mocks.verifyPasswordServer.mockResolvedValue(false);

    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "INVALID-PASSWORD-CASE",
          password: "incorrecta",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.backfillUsernameLookup).not.toHaveBeenCalled();
  });

  it("limita intentos fallidos antes de volver a consultar usuarios", async () => {
    mocks.verifyPasswordServer.mockResolvedValue(false);
    const makeRequest = () =>
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.42",
        },
        body: JSON.stringify({
          username: "RATE-LIMIT-CASE",
          password: "incorrecta",
        }),
      });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(makeRequest());
      expect(response.status).toBe(401);
    }

    mocks.findActiveUserByUsername.mockClear();
    const limited = await login(makeRequest());

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(mocks.findActiveUserByUsername).not.toHaveBeenCalled();
  });

  it("crea una sesión fija cuando el usuario desactiva la renovación", async () => {
    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "ALCHACAS",
          password: "secret",
          keepSessionActive: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createAuthSession).toHaveBeenCalledWith({
      userId: "u1",
      role: "user",
      authMethod: "password",
      keepActive: false,
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

  it("borra la cookie aunque falle la revocación de la sesión", async () => {
    mocks.revokeAuthSession.mockRejectedValueOnce(
      new Error("session store unavailable"),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: "pricemaster_auth=opaque-session-token" },
    });

    try {
      const response = await logout(request);

      expect(response.status).toBe(503);
      expect(response.headers.get("set-cookie")).toContain(
        "pricemaster_auth=;",
      );
      expect(await response.json()).toEqual({
        ok: false,
        error: "logout_failed",
      });
    } finally {
      consoleError.mockRestore();
    }
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
    expect(response.headers.get("set-cookie")).toContain(
      "pricemaster_auth=opaque-session-token",
    );
  });

  it("renueva con el heartbeat sin hidratar nuevamente al usuario", async () => {
    const { GET } = await import("@/app/api/auth/session/heartbeat/route");
    const response = await GET(
      new Request("http://localhost/api/auth/session/heartbeat", {
        headers: { cookie: "pricemaster_auth=opaque-session-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.heartbeatAuthSession).toHaveBeenCalledWith(
      "pricemaster_auth=opaque-session-token",
    );
    expect(mocks.readAuthSession).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      ok: true,
      session: {
        authMethod: "password",
        expiresAt: 1_800_000_000_000,
      },
    });
    expect(response.headers.get("set-cookie")).toContain(
      "pricemaster_auth=opaque-session-token",
    );
  });
});
