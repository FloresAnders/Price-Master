// @vitest-environment jsdom

import React, { type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  ensureFirebaseCustomTokenAuth: vi.fn(async () => true),
  clearFirebaseCustomTokenAuth: vi.fn(async () => undefined),
  userSubscriber: undefined as
    | ((user: Record<string, unknown> | null) => void)
    | undefined,
}));

vi.mock("@/lib/firebase/auth-bridge", () => ({
  ensureFirebaseCustomTokenAuth: authMocks.ensureFirebaseCustomTokenAuth,
  clearFirebaseCustomTokenAuth: authMocks.clearFirebaseCustomTokenAuth,
}));

vi.mock("@/services/users", () => ({
  UsersService: {
    subscribeToUser: vi.fn(
      (
        _userId: string,
        callback: (user: Record<string, unknown> | null) => void,
      ) => {
        authMocks.userSubscriber = callback;
        return vi.fn();
      },
    ),
  },
}));

vi.mock("@/services/version-doc", () => ({
  subscribeToVersionDoc: vi.fn(() => vi.fn()),
}));

vi.mock("@/services/fondo-cache", () => ({
  clearFondoCacheForUser: vi.fn(async () => undefined),
}));

vi.mock("@/services/fondo-movement-types", () => ({
  FondoMovementTypesService: { stopListener: vi.fn() },
}));

vi.mock("@/services/sinpe-notification-preferences.client", () => ({
  subscribeToSinpeNotificationPreference: vi.fn(() => vi.fn()),
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";

const initialUser = {
  id: "user-1",
  name: "Ana",
  role: "user" as const,
  ownerId: "owner-1",
  ownercompanie: "EMPRESA A",
  eliminate: true,
  isActive: true,
  permissions: { anotaciones: false },
};

describe("renovacion de claims Firebase", () => {
  beforeEach(() => {
    authMocks.ensureFirebaseCustomTokenAuth.mockClear();
    authMocks.clearFirebaseCustomTokenAuth.mockClear();
    authMocks.userSubscriber = undefined;
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          user: initialUser,
          session: { expiresAt: Date.now() + 60_000 },
        }),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("renueva el token cuando cambia un permiso incluido en sus claims", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.firebaseAuthReady).toBe(true);
      expect(authMocks.userSubscriber).toBeTypeOf("function");
      expect(authMocks.ensureFirebaseCustomTokenAuth).toHaveBeenCalledTimes(1);
    });

    act(() => {
      authMocks.userSubscriber?.({
        ...initialUser,
        permissions: { anotaciones: true },
      });
    });

    await waitFor(() => {
      expect(authMocks.ensureFirebaseCustomTokenAuth).toHaveBeenCalledTimes(2);
      expect(result.current.firebaseAuthReady).toBe(true);
    });
  });
});
