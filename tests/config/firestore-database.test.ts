// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAdminDb,
  resolveAdminFirestoreDatabaseId,
} from "@/lib/firebase-admin";

const firebaseMocks = vi.hoisted(() => ({
  app: { name: "test-app" },
  getFirestore: vi.fn(),
  getStorage: vi.fn(),
  initializeApp: vi.fn(),
  initializeFirestore: vi.fn(),
  memoryLocalCache: vi.fn(),
  persistentLocalCache: vi.fn(),
  persistentMultipleTabManager: vi.fn(),
}));

const adminMocks = vi.hoisted(() => ({
  app: { name: "admin-test-app" },
  cert: vi.fn(),
  getApps: vi.fn(),
  getAuth: vi.fn(),
  getFirestore: vi.fn(),
  initializeApp: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: firebaseMocks.getFirestore,
  initializeFirestore: firebaseMocks.initializeFirestore,
  memoryLocalCache: firebaseMocks.memoryLocalCache,
  persistentLocalCache: firebaseMocks.persistentLocalCache,
  persistentMultipleTabManager: firebaseMocks.persistentMultipleTabManager,
}));

vi.mock("firebase/storage", () => ({
  getStorage: firebaseMocks.getStorage,
}));

vi.mock("firebase-admin/app", () => ({
  cert: adminMocks.cert,
  getApps: adminMocks.getApps,
  initializeApp: adminMocks.initializeApp,
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: adminMocks.getAuth,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: adminMocks.getFirestore,
}));

describe("Firestore database selection", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    firebaseMocks.initializeFirestore.mockReset();
  });

  it("forces restauracion for Firebase Admin in production", () => {
    expect(
      resolveAdminFirestoreDatabaseId({
        NODE_ENV: "production",
        FIRESTORE_DATABASE_ID: "(default)",
        NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "otra-base",
      }),
    ).toBe("restauracion");
  });

  it("opens Firebase Admin against restauracion in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FIRESTORE_DATABASE_ID", "(default)");
    adminMocks.getApps.mockReturnValue([adminMocks.app]);

    getAdminDb();

    expect(adminMocks.getFirestore).toHaveBeenCalledWith(
      adminMocks.app,
      "restauracion",
    );
  });

  it("initializes the Firebase client against restauracion in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_FIRESTORE_DATABASE_ID", "otra-base");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com");
    vi.stubEnv(
      "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
      "https://test-default-rtdb.firebaseio.com",
    );
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "test-project");
    vi.stubEnv(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "test-project.appspot.com",
    );
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "987654321");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "1:987654321:web:test");
    firebaseMocks.initializeApp.mockReturnValue(firebaseMocks.app);
    firebaseMocks.persistentMultipleTabManager.mockReturnValue("tab-manager");
    firebaseMocks.persistentLocalCache.mockReturnValue("persistent-cache");

    await import("@/config/firebase");

    expect(firebaseMocks.initializeFirestore).toHaveBeenCalledWith(
      firebaseMocks.app,
      { localCache: "persistent-cache" },
      "restauracion",
    );
  });

  it("keeps restauracion when the browser falls back to memory cache", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_FIRESTORE_DATABASE_ID", "(default)");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com");
    vi.stubEnv(
      "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
      "https://test-default-rtdb.firebaseio.com",
    );
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "test-project");
    vi.stubEnv(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "test-project.appspot.com",
    );
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "987654321");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "1:987654321:web:test");
    firebaseMocks.initializeApp.mockReturnValue(firebaseMocks.app);
    firebaseMocks.persistentMultipleTabManager.mockReturnValue("tab-manager");
    firebaseMocks.persistentLocalCache.mockReturnValue("persistent-cache");
    firebaseMocks.memoryLocalCache.mockReturnValue("memory-cache");
    firebaseMocks.initializeFirestore
      .mockImplementationOnce(() => {
        throw new Error("IndexedDB unavailable");
      })
      .mockReturnValueOnce({});
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await import("@/config/firebase");

    expect(firebaseMocks.initializeFirestore).toHaveBeenNthCalledWith(
      1,
      firebaseMocks.app,
      { localCache: "persistent-cache" },
      "restauracion",
    );
    expect(firebaseMocks.initializeFirestore).toHaveBeenNthCalledWith(
      2,
      firebaseMocks.app,
      { localCache: "memory-cache" },
      "restauracion",
    );
  });
});
