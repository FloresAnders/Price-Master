// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bridgeMocks = vi.hoisted(() => ({
  ensure: vi.fn(async () => false),
  clear: vi.fn(async () => undefined),
}));

vi.mock("@/lib/firebase/auth-bridge", () => ({
  ensureFirebaseCustomTokenAuth: bridgeMocks.ensure,
  clearFirebaseCustomTokenAuth: bridgeMocks.clear,
}));
vi.mock("@/lib/auth/session-heartbeat", () => ({
  claimSessionHeartbeatLease: vi.fn(() => true),
  releaseSessionHeartbeatLease: vi.fn(),
}));
vi.mock("@/services/users", () => ({
  UsersService: { subscribeToUser: vi.fn(() => vi.fn()) },
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

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="firebase-ready">{String(auth.firebaseAuthReady)}</span>
    </div>
  );
}

describe("Firebase bridge readiness", () => {
  beforeEach(() => {
    bridgeMocks.ensure.mockReset().mockResolvedValue(false);
    bridgeMocks.clear.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            user: {
              id: "report-user",
              name: "Reportes",
              role: "user",
              isActive: true,
              permissions: { fondogeneral: true },
            },
            session: { expiresAt: Date.now() + 60_000 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("stays not ready when custom-token authentication returns false", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
      expect(bridgeMocks.ensure).toHaveBeenCalledWith("report-user");
    });

    await waitFor(() => {
      expect(screen.getByTestId("firebase-ready").textContent).toBe("false");
    });
  });
});
