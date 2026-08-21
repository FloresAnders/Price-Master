import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readAuthSession: vi.fn(),
  getLegacyUserId: vi.fn(),
  addRequest: vi.fn(),
  addSession: vi.fn(),
  requestGet: vi.fn(),
  requestUpdate: vi.fn(),
  sessionsGet: vi.fn(),
}));

vi.mock("@/lib/auth/session-store.server", () => ({
  readAuthSession: mocks.readAuthSession,
}));

vi.mock("@/lib/appAuth", () => ({
  getUserIdFromAuthorizationHeader: mocks.getLegacyUserId,
}));

vi.mock("@/lib/devices/tokens", () => ({
  generateToken: vi.fn(() => "generated-token"),
  hashToken: vi.fn(() => "hashed-token"),
}));

vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => ({
    collection: (name: string) => {
      if (name === "deviceLinkRequests") {
        return {
          add: mocks.addRequest,
          doc: () => ({
            get: mocks.requestGet,
            update: mocks.requestUpdate,
          }),
        };
      }
      return {
        add: mocks.addSession,
        where: () => ({
          limit: () => ({ get: mocks.sessionsGet }),
        }),
      };
    },
  }),
}));

const cookie = { cookie: "pricemaster_auth=opaque-session" };

describe("device-link management uses the server session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readAuthSession.mockResolvedValue({
      user: { id: "user-1", name: "ALCHACAS", role: "user" },
      session: { id: "auth-session" },
    });
    mocks.getLegacyUserId.mockResolvedValue(null);
    mocks.addRequest.mockResolvedValue({ id: "request-1" });
    mocks.addSession.mockResolvedValue({ id: "device-session-1" });
    mocks.requestGet.mockResolvedValue({
      exists: true,
      data: () => ({
        userId: "user-1",
        status: "scanned",
        requestedAccessMinutes: 60,
        permissions: [],
      }),
    });
    mocks.requestUpdate.mockResolvedValue(undefined);
    mocks.sessionsGet.mockResolvedValue({ docs: [] });
  });

  it("authorizes create, approve, reject and session listing from the cookie", async () => {
    const [{ POST: create }, { POST: approve }, { POST: reject }, { GET: sessions }] =
      await Promise.all([
        import("@/app/api/device-link/create/route"),
        import("@/app/api/device-link/approve/route"),
        import("@/app/api/device-link/reject/route"),
        import("@/app/api/device-link/sessions/route"),
      ]);

    const createResponse = await create(
      new Request("http://localhost/api/device-link/create", {
        method: "POST",
        headers: { ...cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: 90, permissions: ["scan"] }),
      }),
    );
    const approveResponse = await approve(
      new Request("http://localhost/api/device-link/approve", {
        method: "POST",
        headers: { ...cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: "request-1" }),
      }),
    );
    const rejectResponse = await reject(
      new Request("http://localhost/api/device-link/reject", {
        method: "POST",
        headers: { ...cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: "request-1" }),
      }),
    );
    const sessionsResponse = await sessions(
      new Request("http://localhost/api/device-link/sessions", {
        headers: cookie,
      }),
    );

    expect([
      createResponse.status,
      approveResponse.status,
      rejectResponse.status,
      sessionsResponse.status,
    ]).toEqual([200, 200, 200, 200]);
    expect(mocks.readAuthSession).toHaveBeenCalledWith(cookie.cookie);
    expect(mocks.addRequest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
    expect(mocks.addSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", authorizedBy: "user-1" }),
    );
    expect(mocks.getLegacyUserId).not.toHaveBeenCalled();
  });

  it("rejects a legacy bearer token when there is no active cookie session", async () => {
    mocks.readAuthSession.mockResolvedValue(null);
    mocks.getLegacyUserId.mockResolvedValue("user-from-client-token");
    const { POST: create } = await import("@/app/api/device-link/create/route");

    const response = await create(
      new Request("http://localhost/api/device-link/create", {
        method: "POST",
        headers: {
          Authorization: "Bearer forged-client-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.addRequest).not.toHaveBeenCalled();
  });
});
