// @vitest-environment jsdom

import { createElement, StrictMode } from "react";
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthWrapper from "@/components/auth/AuthWrapper";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const serviceMocks = vi.hoisted(() => ({
  subscribeToUser: vi.fn(
    (
      _userId: string,
      _callback: (user: Record<string, unknown> | null) => void,
    ) => {
      void _userId;
      void _callback;
      return () => undefined;
    },
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));
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
    subscribeToUser: serviceMocks.subscribeToUser,
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
    serviceMocks.subscribeToUser.mockImplementation(() => () => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toMatchObject({ id: "user-1", name: "ALCHACAS" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("shares one session validation across auth consumers in Strict Mode", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      response({
        ok: true,
        user: { id: "user-1", name: "ALCHACAS", role: "user" },
        session: { authMethod: "password", expiresAt: Date.now() + 60_000 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    function AuthConsumer() {
      const { user } = useAuth();
      return createElement("span", null, user?.name || "loading");
    }

    render(
      createElement(
        StrictMode,
        null,
        createElement(
          AuthWrapper,
          null,
          createElement(AuthConsumer),
          createElement(AuthConsumer),
        ),
      ),
    );

    await waitFor(() =>
      expect(screen.getAllByText("ALCHACAS")).toHaveLength(2),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("accepts a user only after a successful server-side login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, error: "unauthorized" }, 401)),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.login({ id: "user-1", name: "ALCHACAS", role: "user" });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe("ALCHACAS");
    expect(localStorage.getItem("pricemaster_session")).toBeNull();
    expect(localStorage.getItem("pricemaster_token_session")).toBeNull();
  });

  it("cierra la sesión cuando el listener informa que el usuario fue desactivado", async () => {
    let pushUserUpdate: ((user: Record<string, unknown> | null) => void) | null =
      null;
    serviceMocks.subscribeToUser.mockImplementation((_userId, callback) => {
      pushUserUpdate = callback;
      return () => undefined;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/session") {
        return Promise.resolve(
          response({
            ok: true,
            user: {
              id: "user-1",
              name: "ALCHACAS",
              role: "user",
              isActive: true,
            },
            session: { authMethod: "password", expiresAt: Date.now() + 60_000 },
          }),
        );
      }
      if (String(input) === "/api/auth/logout") {
        return Promise.resolve(response({ ok: true }));
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const auth = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(auth.result.current.loading).toBe(false));

    act(() => {
      pushUserUpdate?.({
        id: "user-1",
        name: "ALCHACAS",
        role: "user",
        isActive: false,
      });
    });

    expect(auth.result.current.isAuthenticated).toBe(false);
    expect(auth.result.current.user).toBeNull();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("propaga el cierre de sesión recibido desde otra pestaña", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          ok: true,
          user: { id: "user-1", name: "ALCHACAS", role: "user" },
          session: { authMethod: "password", expiresAt: Date.now() + 60_000 },
        }),
      ),
    );
    const auth = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(auth.result.current.isAuthenticated).toBe(true));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "pricemaster_auth_sync",
          newValue: JSON.stringify({ type: "logout", nonce: "other-tab" }),
        }),
      );
    });

    expect(auth.result.current.isAuthenticated).toBe(false);
    expect(auth.result.current.user).toBeNull();
    expect(localStorage.getItem("pricemaster_session_heartbeat_lease")).toBeNull();
  });

  it("reports five hours for a newly authenticated administrator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, error: "unauthorized" }, 401)),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.login({ id: "admin-1", name: "ADMIN", role: "admin" });
    });

    expect(result.current.getSessionTimeLeft()).toBeCloseTo(5, 2);
  });

  it("espera treinta minutos y usa el heartbeat liviano", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/session") {
        return Promise.resolve(
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
      if (String(input) === "/api/auth/session/heartbeat") {
        return Promise.resolve(
          response({
            ok: true,
            session: {
              authMethod: "password",
              expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            },
          }),
        );
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const auth = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(auth.result.current.loading).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/session/heartbeat");
  });

  it("conserva la sesión ante un fallo temporal del heartbeat", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/session") {
        return Promise.resolve(
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
      if (String(input) === "/api/auth/session/heartbeat") {
        return Promise.resolve(response({ ok: false, error: "unavailable" }, 503));
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const auth = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(auth.result.current.isAuthenticated).toBe(true);
    expect(auth.result.current.user?.id).toBe("user-1");
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

    const firstAuth = renderHook(() => useAuth(), { wrapper: AuthProvider });
    const secondAuth = renderHook(() => useAuth(), { wrapper: AuthProvider });
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

  it("does not reuse a stale session request after the provider remounts", async () => {
    const staleSession = deferred<Response>();
    let sessionRequestCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === "/api/auth/session") {
          sessionRequestCount += 1;
          if (sessionRequestCount === 1) return staleSession.promise;
          return Promise.resolve(
            response({ ok: false, error: "unauthorized" }, 401),
          );
        }
        if (String(input) === "/api/auth/logout") {
          return Promise.resolve(response({ ok: true }));
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );

    const firstAuth = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(sessionRequestCount).toBe(1));

    await act(async () => {
      await firstAuth.result.current.logout();
    });
    firstAuth.unmount();

    const secondAuth = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      staleSession.resolve(
        response({
          ok: true,
          user: { id: "user-1", name: "ALCHACAS", role: "user" },
          session: { authMethod: "password", expiresAt: Date.now() + 60_000 },
        }),
      );
      await staleSession.promise;
    });

    await waitFor(() => expect(secondAuth.result.current.loading).toBe(false));
    expect(secondAuth.result.current.isAuthenticated).toBe(false);
    expect(secondAuth.result.current.user).toBeNull();
    expect(sessionRequestCount).toBe(2);
  });

  it("does not reuse a stale session request on refresh after logout", async () => {
    vi.useFakeTimers();
    const staleSession = deferred<Response>();
    let sessionRequestCount = 0;
    let heartbeatRequestCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === "/api/auth/session") {
          sessionRequestCount += 1;
          if (sessionRequestCount === 1) return staleSession.promise;
          return Promise.resolve(
            response({ ok: false, error: "unauthorized" }, 401),
          );
        }
        if (String(input) === "/api/auth/logout") {
          return Promise.resolve(response({ ok: true }));
        }
        if (String(input) === "/api/auth/session/heartbeat") {
          heartbeatRequestCount += 1;
          return Promise.resolve(
            response({ ok: false, error: "unauthorized" }, 401),
          );
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );

    const auth = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(sessionRequestCount).toBe(1);

    await act(async () => {
      await auth.result.current.logout();
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
    });

    await act(async () => {
      staleSession.resolve(
        response({
          ok: true,
          user: { id: "user-1", name: "ALCHACAS", role: "user" },
          session: { authMethod: "password", expiresAt: Date.now() + 60_000 },
        }),
      );
      await staleSession.promise;
      await Promise.resolve();
    });

    expect(auth.result.current.isAuthenticated).toBe(false);
    expect(auth.result.current.user).toBeNull();
    expect(sessionRequestCount).toBe(1);
    expect(heartbeatRequestCount).toBe(1);
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
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    let logoutPromise!: Promise<void>;

    act(() => {
      logoutPromise = result.current.logout();
    });

    expect(localStorage.getItem("pricemaster_user_phash")).toBeNull();

    await act(async () => {
      pendingLogout.resolve(response({ ok: true }));
      await logoutPromise;
    });

    await act(async () => {
      pendingSession.resolve(
        response({ ok: false, error: "unauthorized" }, 401),
      );
      await pendingSession.promise;
    });
  });
});
