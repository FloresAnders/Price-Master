// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => false })),
}));
vi.mock("@/services/version-doc", () => ({
  subscribeToVersionDoc: vi.fn(() => () => undefined),
}));
vi.mock("@/services/users", () => ({
  UsersService: {
    subscribeToUser: vi.fn(() => () => undefined),
    getUserById: vi.fn(),
  },
}));
vi.mock("@/services/tokenService", () => ({
  TokenService: {
    getTokenInfo: vi.fn(() => ({ isValid: false })),
    revokeToken: vi.fn(),
    getTokenTimeLeft: vi.fn(() => 0),
    formatTokenTimeLeft: vi.fn(() => "0m"),
  },
}));

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("server-authoritative auth state", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("hydrates the user from the HttpOnly server session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        ok: true,
        user: { id: "user-1", name: "ALCHACAS", role: "user" },
        session: { authMethod: "passkey", expiresAt: Date.now() + 60_000 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toMatchObject({ id: "user-1", name: "ALCHACAS" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("does not trust a forged legacy localStorage session", async () => {
    localStorage.setItem(
      "pricemaster_session",
      JSON.stringify({
        id: "attacker",
        name: "SUPERADMIN",
        role: "superadmin",
        loginTime: new Date().toISOString(),
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, error: "unauthorized" }, 401)),
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("accepts a user only after a successful server-side login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, error: "unauthorized" }, 401)),
    );
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.login({ id: "user-1", name: "ALCHACAS", role: "user" });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe("ALCHACAS");
    expect(localStorage.getItem("pricemaster_session")).toBeNull();
    expect(localStorage.getItem("pricemaster_token_session")).toBeNull();
  });

  it("keeps every auth instance logged out when an old session response arrives", async () => {
    const pendingSessions = [deferred<Response>(), deferred<Response>()];
    const pendingLogout = deferred<Response>();
    let sessionRequestIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === "/api/auth/session") {
          return pendingSessions[sessionRequestIndex++].promise;
        }
        if (String(input) === "/api/auth/logout") {
          return pendingLogout.promise;
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );

    const firstAuth = renderHook(() => useAuth());
    const secondAuth = renderHook(() => useAuth());
    let logoutPromise!: Promise<void>;

    act(() => {
      logoutPromise = firstAuth.result.current.logout();
    });

    await act(async () => {
      for (const pendingSession of pendingSessions) {
        pendingSession.resolve(
          response({
            ok: true,
            user: { id: "user-1", name: "ALCHACAS", role: "user" },
            session: {
              authMethod: "password",
              expiresAt: Date.now() + 60_000,
            },
          }),
        );
      }
      await Promise.all(pendingSessions.map(({ promise }) => promise));
    });

    expect(firstAuth.result.current.isAuthenticated).toBe(false);
    expect(firstAuth.result.current.user).toBeNull();
    expect(secondAuth.result.current.isAuthenticated).toBe(false);
    expect(secondAuth.result.current.user).toBeNull();

    await act(async () => {
      pendingLogout.resolve(response({ ok: true }));
      await logoutPromise;
    });
  });

  it("clears the stored password hash as soon as logout begins", async () => {
    const pendingSession = deferred<Response>();
    const pendingLogout = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === "/api/auth/session") {
          return pendingSession.promise;
        }
        if (String(input) === "/api/auth/logout") {
          return pendingLogout.promise;
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );
    localStorage.setItem("pricemaster_user_phash", "stored-hash");
    const { result } = renderHook(() => useAuth());
    let logoutPromise!: Promise<void>;

    act(() => {
      logoutPromise = result.current.logout();
    });

    expect(localStorage.getItem("pricemaster_user_phash")).toBeNull();

    await act(async () => {
      pendingLogout.resolve(response({ ok: true }));
      await logoutPromise;
    });
  });
});
