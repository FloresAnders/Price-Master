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
});
