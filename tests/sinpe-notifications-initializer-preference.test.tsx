// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SinpeNotificationsInitializer from "@/components/sinpe/SinpeNotificationsInitializer";

const testState = vi.hoisted(() => ({
  auth: {
    user: {
      id: "admin-123",
      name: "Admin",
      role: "admin" as const,
      permissions: { reportessinpe: true },
      sinpeNotificationsEnabled: false,
      sinpeNotificationsPreferenceLoaded: true,
    },
    loading: false,
  },
  unsubscribe: vi.fn(),
  onSnapshot: vi.fn(),
  signOut: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => testState.auth,
}));

vi.mock("@/utils/permissions", () => ({
  normalizeUserPermissions: (permissions: unknown) => permissions,
}));

vi.mock("@/config/firebase", () => ({
  firebaseConfig: {},
  firestoreDatabaseId: "(default)",
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    custom: vi.fn(),
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("firebase/app", () => ({
  getApps: () => [{ name: "sinpe-realtime" }],
  initializeApp: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => ({}),
  inMemoryPersistence: {},
  setPersistence: vi.fn(async () => undefined),
  signInWithCustomToken: vi.fn(async () => undefined),
  signOut: testState.signOut,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getFirestore: () => ({}),
  limit: vi.fn(),
  onSnapshot: testState.onSnapshot,
  orderBy: vi.fn(),
  query: vi.fn(),
  Timestamp: { fromMillis: vi.fn(() => ({})) },
  where: vi.fn(),
}));

describe("SinpeNotificationsInitializer preference", () => {
  beforeEach(() => {
    testState.auth = {
      user: {
        id: "admin-123",
        name: "Admin",
        role: "admin",
        permissions: { reportessinpe: true },
        sinpeNotificationsEnabled: false,
        sinpeNotificationsPreferenceLoaded: true,
      },
      loading: false,
    };
    testState.unsubscribe.mockReset();
    testState.onSnapshot.mockReset();
    testState.onSnapshot.mockImplementation(() => testState.unsubscribe);
    testState.signOut.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          token: "realtime-token",
          empresas: [{ id: "DELIKOR PALMARES", name: "Palmares" }],
        }),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("no conecta desactivado, conecta al activar y limpia el listener al desactivar", async () => {
    const view = render(<SinpeNotificationsInitializer />);

    await act(async () => undefined);
    expect(fetch).not.toHaveBeenCalled();

    testState.auth = {
      ...testState.auth,
      user: {
        ...testState.auth.user,
        sinpeNotificationsEnabled: true,
        sinpeNotificationsPreferenceLoaded: true,
      },
    };
    view.rerender(<SinpeNotificationsInitializer />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/gmail/realtime", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      expect(testState.onSnapshot).toHaveBeenCalledTimes(1);
    });

    testState.auth = {
      ...testState.auth,
      user: {
        ...testState.auth.user,
        sinpeNotificationsEnabled: false,
        sinpeNotificationsPreferenceLoaded: true,
      },
    };
    view.rerender(<SinpeNotificationsInitializer />);

    await waitFor(() => {
      expect(testState.unsubscribe).toHaveBeenCalledTimes(1);
      expect(testState.signOut).toHaveBeenCalled();
    });
  });
});
