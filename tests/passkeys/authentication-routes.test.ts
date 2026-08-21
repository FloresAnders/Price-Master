import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOptions: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/passkeys/authentication.server", () => ({
  getAuthenticationService: () => ({
    createOptions: mocks.createOptions,
    verify: mocks.verify,
  }),
}));

describe("passkey authentication routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createOptions.mockResolvedValue({
      ceremonyId: "ceremony-id",
      options: {
        challenge: "challenge",
        allowCredentials: [],
        userVerification: "required",
      },
    });
    mocks.verify.mockResolvedValue({
      token: "opaque-passkey-session",
      record: { expiresAt: Date.now() + 3_600_000 },
      user: { id: "u1", name: "ALCHACAS", role: "user" },
    });
  });

  it("crea opciones descubribles sin requerir usuario", async () => {
    let post: ((request: Request) => Promise<Response>) | undefined;
    try {
      ({ POST: post } = await import(
        "@/app/api/auth/passkeys/authenticate/options/route"
      ));
    } catch {
      post = undefined;
    }
    expect(post).toBeTypeOf("function");

    const response = await post!(
      new Request("http://localhost/api/auth/passkeys/authenticate/options", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      ceremonyId: "ceremony-id",
      options: {
        challenge: "challenge",
        allowCredentials: [],
        userVerification: "required",
      },
    });
    expect(response.headers.get("set-cookie")).toContain(
      "timemaster_webauthn_browser=",
    );
  });

  it("establece la sesión solo después de verificar la firma", async () => {
    let post: ((request: Request) => Promise<Response>) | undefined;
    try {
      ({ POST: post } = await import(
        "@/app/api/auth/passkeys/authenticate/verify/route"
      ));
    } catch {
      post = undefined;
    }
    expect(post).toBeTypeOf("function");

    const response = await post!(
      new Request("http://localhost/api/auth/passkeys/authenticate/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "timemaster_webauthn_browser=binding",
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
      user: { id: "u1", name: "ALCHACAS", role: "user" },
    });
    expect(response.headers.get("set-cookie")).toContain(
      "pricemaster_auth=opaque-passkey-session",
    );
  });
});
