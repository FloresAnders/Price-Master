// @vitest-environment jsdom

import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  value: {
    user: { id: "superadmin-id", role: "superadmin" },
    isAuthenticated: true,
    firebaseAuthReady: false,
  },
}));

const maintenanceMocks = vi.hoisted(() => ({
  subscribeToMaintenance: vi.fn(() => vi.fn()),
}));

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(() => ({ path: "version/current" })),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState.value,
}));

vi.mock("@/services/maintenance", () => ({
  createDefaultMaintenanceConfig: () => ({
    global: { enabled: false, message: "" },
    companies: {},
    activeCompanyIdentifiers: [],
  }),
  subscribeToMaintenance: maintenanceMocks.subscribeToMaintenance,
}));

vi.mock("@/config/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  doc: firestoreMocks.doc,
  getDoc: firestoreMocks.getDoc,
  onSnapshot: firestoreMocks.onSnapshot,
}));

import { MaintenanceProvider } from "@/contexts/MaintenanceContext";
import { subscribeToVersionDoc } from "@/services/version-doc";

beforeEach(() => {
  authState.value = {
    user: { id: "superadmin-id", role: "superadmin" },
    isAuthenticated: true,
    firebaseAuthReady: false,
  };
  maintenanceMocks.subscribeToMaintenance.mockClear();
  firestoreMocks.doc.mockClear();
  firestoreMocks.getDoc.mockReset();
  firestoreMocks.onSnapshot.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("maintenance listener lifecycle", () => {
  it("waits for Firebase Auth before subscribing to maintenance", async () => {
    const view = render(
      <MaintenanceProvider>
        <div>contenido</div>
      </MaintenanceProvider>,
    );

    expect(maintenanceMocks.subscribeToMaintenance).not.toHaveBeenCalled();

    authState.value = {
      ...authState.value,
      firebaseAuthReady: true,
    };
    view.rerender(
      <MaintenanceProvider>
        <div>contenido</div>
      </MaintenanceProvider>,
    );

    await waitFor(() => {
      expect(maintenanceMocks.subscribeToMaintenance).toHaveBeenCalledTimes(1);
    });
  });

  it("opens a replacement version listener after the active listener fails", () => {
    let failFirstListener: ((error: unknown) => void) | undefined;
    const closeFirstListener = vi.fn();
    const closeReplacementListener = vi.fn();
    const firstErrorListener = vi.fn();

    firestoreMocks.onSnapshot
      .mockImplementationOnce(
        (_reference, _onValue, onError: (error: unknown) => void) => {
          failFirstListener = onError;
          return closeFirstListener;
        },
      )
      .mockImplementationOnce(() => closeReplacementListener);

    const stopFirstSubscriber = subscribeToVersionDoc(
      vi.fn(),
      firstErrorListener,
    );
    const listenerError = new Error("permission-denied");
    failFirstListener?.(listenerError);

    expect(firstErrorListener).toHaveBeenCalledWith(listenerError);
    expect(closeFirstListener).toHaveBeenCalledTimes(1);

    const stopReplacementSubscriber = subscribeToVersionDoc(vi.fn());

    expect(firestoreMocks.onSnapshot).toHaveBeenCalledTimes(2);

    stopFirstSubscriber();
    stopReplacementSubscriber();
    expect(closeReplacementListener).toHaveBeenCalledTimes(1);
  });
});
