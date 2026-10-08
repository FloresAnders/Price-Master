// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  onSnapshot: vi.fn(),
  getPrimaryAdminByOwner: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("@/services/users", () => ({
  UsersService: {
    getPrimaryAdminByOwner: mocks.getPrimaryAdminByOwner,
  },
}));
vi.mock("@/services/fondo-cache", () => ({
  invalidateFondoCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn((...segments: string[]) => segments.join("/")),
  deleteDoc: vi.fn(),
  doc: vi.fn((...segments: string[]) => segments.join("/")),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: mocks.onSnapshot,
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  query: vi.fn((reference: unknown) => reference),
  updateDoc: vi.fn(),
}));

import { FondoMovementTypesService } from "@/services/fondo-movement-types";

type ListenerLifecycleApi = typeof FondoMovementTypesService & {
  acquireListener?: (ownerId: string) => Promise<() => void>;
};

const lifecycleApi = FondoMovementTypesService as ListenerLifecycleApi;

describe("Fondo movement types listener lifecycle", () => {
  beforeEach(() => {
    FondoMovementTypesService.stopListener();
    mocks.unsubscribe.mockReset();
    mocks.onSnapshot.mockReset();
    mocks.onSnapshot.mockReturnValue(mocks.unsubscribe);
    mocks.getPrimaryAdminByOwner.mockReset();
    mocks.getPrimaryAdminByOwner.mockResolvedValue({ fullName: "Admin Uno" });
    localStorage.clear();
  });

  it("shares one Firestore listener and closes it after last module leaves", async () => {
    expect(typeof lifecycleApi.acquireListener).toBe("function");
    if (!lifecycleApi.acquireListener) return;

    const releaseProvider = await lifecycleApi.acquireListener("owner-1");
    const releaseReport = await lifecycleApi.acquireListener("owner-1");

    expect(mocks.onSnapshot).toHaveBeenCalledTimes(1);

    releaseProvider();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();

    releaseReport();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("release is idempotent and cannot reduce another module reference", async () => {
    expect(typeof lifecycleApi.acquireListener).toBe("function");
    if (!lifecycleApi.acquireListener) return;

    const releaseA = await lifecycleApi.acquireListener("owner-1");
    const releaseB = await lifecycleApi.acquireListener("owner-1");

    releaseA();
    releaseA();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();

    releaseB();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not attach a pending listener after the session stops", async () => {
    expect(typeof lifecycleApi.acquireListener).toBe("function");
    if (!lifecycleApi.acquireListener) return;

    let resolveAdmin: ((value: { fullName: string }) => void) | undefined;
    mocks.getPrimaryAdminByOwner.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAdmin = resolve;
        }),
    );

    const pendingRelease = lifecycleApi.acquireListener("owner-1");
    FondoMovementTypesService.stopListener();
    resolveAdmin?.({ fullName: "Admin Uno" });
    const release = await pendingRelease;

    expect(mocks.onSnapshot).not.toHaveBeenCalled();
    release();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });

  it("an old release cannot close a replacement listener", async () => {
    expect(typeof lifecycleApi.acquireListener).toBe("function");
    if (!lifecycleApi.acquireListener) return;

    const releaseOld = await lifecycleApi.acquireListener("owner-1");
    FondoMovementTypesService.stopListener();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);

    const releaseReplacement = await lifecycleApi.acquireListener("owner-1");
    releaseOld();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);

    releaseReplacement();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(2);
  });
});
