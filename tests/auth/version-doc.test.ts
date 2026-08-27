import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({ path: "version/current" })),
  getDoc: mocks.getDoc,
  onSnapshot: mocks.onSnapshot,
}));

const versionSnapshot = {
  id: "current",
  exists: () => true,
  data: () => ({ version: "1.2.3", versionstorage: "7" }),
};

describe("shared version document listener", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getDoc.mockResolvedValue(versionSnapshot);
    mocks.onSnapshot.mockImplementation((_reference, onNext) => {
      onNext(versionSnapshot);
      return () => undefined;
    });
  });

  it("no agrega un getDoc cuando onSnapshot ya entrega el estado inicial", async () => {
    const { subscribeToVersionDoc } = await import("@/services/version-doc");
    const listener = vi.fn();

    const unsubscribe = subscribeToVersionDoc(listener);
    await Promise.resolve();

    expect(mocks.onSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.getDoc).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
