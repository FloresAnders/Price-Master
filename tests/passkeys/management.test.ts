import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readAuthSession: vi.fn(),
  listUserPasskeys: vi.fn(),
  renamePasskey: vi.fn(),
  revokePasskey: vi.fn(),
}));

vi.mock("@/lib/auth/session-store.server", () => ({
  readAuthSession: mocks.readAuthSession,
}));

vi.mock("@/lib/passkeys/repository.server", () => ({
  getPasskeyService: () => ({
    listUserPasskeys: mocks.listUserPasskeys,
    renamePasskey: mocks.renamePasskey,
    revokePasskey: mocks.revokePasskey,
  }),
  PasskeyRepositoryError: class extends Error {},
}));

const storedPasskey = {
  credentialId: "secret-credential-id",
  credentialIdHash: "credential-hash",
  userId: "u1",
  publicKey: "secret-public-key",
  counter: 7,
  transports: ["internal"],
  deviceType: "multiDevice",
  backedUp: true,
  label: "Passkey sincronizada",
  createdAt: 1_700_000_000_000,
  lastUsedAt: 1_700_000_100_000,
  revokedAt: null,
  revokedBy: null,
};

describe("passkey management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readAuthSession.mockResolvedValue({
      session: { id: "session-id" },
      user: { id: "u1", name: "ALCHACAS", role: "user" },
    });
    mocks.listUserPasskeys.mockResolvedValue([storedPasskey]);
    mocks.renamePasskey.mockResolvedValue({
      ...storedPasskey,
      label: "Oficina",
    });
    mocks.revokePasskey.mockResolvedValue({
      ...storedPasskey,
      revokedAt: 1_700_000_200_000,
    });
  });

  it("lista solo metadatos públicos de las passkeys propias", async () => {
    let get: ((request: Request) => Promise<Response>) | undefined;
    try {
      ({ GET: get } = await import("@/app/api/auth/passkeys/route"));
    } catch {
      get = undefined;
    }
    expect(get).toBeTypeOf("function");

    const response = await get!(
      new Request("http://localhost/api/auth/passkeys", {
        headers: { cookie: "pricemaster_auth=session" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      passkeys: [
        {
          id: "credential-hash",
          label: "Passkey sincronizada",
          deviceType: "multiDevice",
          backedUp: true,
          createdAt: 1_700_000_000_000,
          lastUsedAt: 1_700_000_100_000,
          revokedAt: null,
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("secret-credential-id");
    expect(JSON.stringify(body)).not.toContain("secret-public-key");
  });

  it("impide que un usuario liste las passkeys de otra cuenta", async () => {
    const { GET } = await import("@/app/api/auth/passkeys/route");
    const response = await GET(
      new Request("http://localhost/api/auth/passkeys?userId=other", {
        headers: { cookie: "pricemaster_auth=session" },
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.listUserPasskeys).not.toHaveBeenCalled();
  });

  it("permite al superadmin consultar otra cuenta", async () => {
    mocks.readAuthSession.mockResolvedValueOnce({
      session: { id: "session-id" },
      user: { id: "admin", name: "ROOT", role: "superadmin" },
    });
    const { GET } = await import("@/app/api/auth/passkeys/route");
    const response = await GET(
      new Request("http://localhost/api/auth/passkeys?userId=u1", {
        headers: { cookie: "pricemaster_auth=session" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.listUserPasskeys).toHaveBeenCalledWith("u1");
  });

  it("renombra y revoca mediante el servicio autorizado", async () => {
    let patch:
      | ((request: Request, context: { params: Promise<{ credentialIdHash: string }> }) => Promise<Response>)
      | undefined;
    let remove: typeof patch;
    try {
      ({ PATCH: patch, DELETE: remove } = await import(
        "@/app/api/auth/passkeys/[credentialIdHash]/route"
      ));
    } catch {
      patch = undefined;
      remove = undefined;
    }
    expect(patch).toBeTypeOf("function");
    expect(remove).toBeTypeOf("function");
    const context = {
      params: Promise.resolve({ credentialIdHash: "credential-hash" }),
    };

    const renamed = await patch!(
      new Request("http://localhost/api/auth/passkeys/credential-hash", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: "pricemaster_auth=session",
        },
        body: JSON.stringify({ label: "Oficina" }),
      }),
      context,
    );
    const revoked = await remove!(
      new Request("http://localhost/api/auth/passkeys/credential-hash", {
        method: "DELETE",
        headers: { cookie: "pricemaster_auth=session" },
      }),
      context,
    );

    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({
      ok: true,
      passkey: { id: "credential-hash", label: "Oficina" },
    });
    expect(revoked.status).toBe(200);
    expect(mocks.renamePasskey).toHaveBeenCalledWith(
      "u1",
      false,
      "credential-hash",
      "Oficina",
    );
    expect(mocks.revokePasskey).toHaveBeenCalledWith(
      "u1",
      false,
      "credential-hash",
    );
  });
});
