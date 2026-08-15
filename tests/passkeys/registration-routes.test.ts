import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOptions: vi.fn(),
  verify: vi.fn(),
  readAuthSession: vi.fn(),
  getUserDocument: vi.fn(),
  verifyPasswordServer: vi.fn(),
  createEnrollmentGrant: vi.fn(),
}));

vi.mock("@/lib/auth/session-store.server", () => ({
  readAuthSession: mocks.readAuthSession,
}));

vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({ get: mocks.getUserDocument }),
    }),
  }),
}));

vi.mock("@/lib/auth/password.server", () => ({
  verifyPasswordServer: mocks.verifyPasswordServer,
}));

vi.mock("@/lib/passkeys/ceremonies.server", () => ({
  getCeremonyService: () => ({
    createEnrollmentGrant: mocks.createEnrollmentGrant,
  }),
}));

vi.mock("@/lib/passkeys/registration.server", () => ({
  getRegistrationService: () => ({
    createOptions: mocks.createOptions,
    verify: mocks.verify,
  }),
  PasskeyRegistrationError: class extends Error {},
}));

describe("passkey registration routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readAuthSession.mockResolvedValue({
      session: { id: "session-id" },
      user: { id: "u1", name: "ALCHACAS", role: "user" },
    });
    mocks.createOptions.mockResolvedValue({
      ceremonyId: "ceremony-id",
      options: { challenge: "challenge" },
    });
    mocks.verify.mockResolvedValue({
      credentialIdHash: "credential-hash",
      label: "Passkey sincronizada",
    });
    mocks.getUserDocument.mockResolvedValue({
      exists: true,
      data: () => ({ password: "$argon2id$stored", isActive: true }),
    });
    mocks.verifyPasswordServer.mockResolvedValue(true);
    mocks.createEnrollmentGrant.mockResolvedValue({ id: "fresh-grant" });
  });

  it("crea opciones y establece la vinculación anónima del navegador", async () => {
    let post: ((request: Request) => Promise<Response>) | undefined;
    try {
      ({ POST: post } = await import(
        "@/app/api/auth/passkeys/register/options/route"
      ));
    } catch {
      post = undefined;
    }
    expect(post).toBeTypeOf("function");

    const response = await post!(
      new Request("http://localhost/api/auth/passkeys/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentGrantId: "grant-id" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      ceremonyId: "ceremony-id",
      options: { challenge: "challenge" },
    });
    expect(response.headers.get("set-cookie")).toContain(
      "timemaster_webauthn_browser=",
    );
  });

  it("verifica usando la misma vinculación y sesión", async () => {
    let post: ((request: Request) => Promise<Response>) | undefined;
    try {
      ({ POST: post } = await import(
        "@/app/api/auth/passkeys/register/verify/route"
      ));
    } catch {
      post = undefined;
    }
    expect(post).toBeTypeOf("function");

    const response = await post!(
      new Request("http://localhost/api/auth/passkeys/register/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie:
            "pricemaster_auth=session; timemaster_webauthn_browser=binding",
        },
        body: JSON.stringify({
          ceremonyId: "ceremony-id",
          response: { id: "credential-id" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      passkey: {
        id: "credential-hash",
        label: "Passkey sincronizada",
      },
    });
  });

  it("reauthentica la contraseña antes de emitir otra concesión", async () => {
    let post: ((request: Request) => Promise<Response>) | undefined;
    try {
      ({ POST: post } = await import("@/app/api/auth/passkeys/reauth/route"));
    } catch {
      post = undefined;
    }
    expect(post).toBeTypeOf("function");

    const response = await post!(
      new Request("http://localhost/api/auth/passkeys/reauth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "pricemaster_auth=session",
        },
        body: JSON.stringify({ password: "secret" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      enrollmentGrantId: "fresh-grant",
    });
  });
});
