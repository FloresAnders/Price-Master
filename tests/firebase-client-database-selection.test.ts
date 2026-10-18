import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  app: { name: "test-app" },
  initializeApp: vi.fn(),
  initializeFirestore: vi.fn(),
  getFirestore: vi.fn(),
  getStorage: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: firebaseMocks.getFirestore,
  initializeFirestore: firebaseMocks.initializeFirestore,
  memoryLocalCache: vi.fn(() => ({ kind: "memory" })),
  persistentLocalCache: vi.fn(() => ({ kind: "persistent" })),
  persistentMultipleTabManager: vi.fn(() => ({ kind: "tabs" })),
}));

vi.mock("firebase/storage", () => ({
  getStorage: firebaseMocks.getStorage,
}));

describe("Firebase client database selection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    firebaseMocks.initializeApp.mockReturnValue(firebaseMocks.app);
    firebaseMocks.initializeFirestore.mockReturnValue({ kind: "firestore" });
    firebaseMocks.getStorage.mockReturnValue({ kind: "storage" });
    vi.stubEnv("NEXT_PUBLIC_FIRESTORE_DATABASE_ID", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("initializes the default database in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const firebase = await import("@/config/firebase");

    expect(firebase.firestoreDatabaseId).toBe("(default)");
    expect(firebaseMocks.initializeFirestore).toHaveBeenCalledOnce();
    expect(firebaseMocks.initializeFirestore.mock.calls[0]).toHaveLength(2);
  });

  it("initializes restauracion in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const firebase = await import("@/config/firebase");

    expect(firebase.firestoreDatabaseId).toBe("restauracion");
    expect(firebaseMocks.initializeFirestore).toHaveBeenCalledOnce();
    expect(firebaseMocks.initializeFirestore.mock.calls[0]?.[2]).toBe(
      "restauracion",
    );
  });
});
