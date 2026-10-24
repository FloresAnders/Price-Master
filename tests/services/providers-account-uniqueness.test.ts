import { beforeEach, describe, expect, test, vi } from "vitest";

type FakeRef = { path: string };

const firestore = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();

  const snapshotFor = (ref: FakeRef) => ({
    exists: () => documents.has(ref.path),
    data: () => documents.get(ref.path),
  });

  return {
    documents,
    collection: vi.fn((...parts: unknown[]) => ({
      path: parts.slice(1).join("/"),
    })),
    doc: vi.fn((...parts: unknown[]) => ({
      path: parts.slice(1).join("/"),
    })),
    getDocs: vi.fn(),
    increment: vi.fn((value: number) => ({ increment: value })),
    orderBy: vi.fn(),
    query: vi.fn(),
    serverTimestamp: vi.fn(() => "server-timestamp"),
    runTransaction: vi.fn(async (_db: unknown, callback: (transaction: unknown) => unknown) => {
      const transaction = {
        get: vi.fn(async (ref: FakeRef) => snapshotFor(ref)),
        set: vi.fn(
          (
            ref: FakeRef,
            data: Record<string, unknown>,
            options?: { merge?: boolean },
          ) => {
            const previous = documents.get(ref.path) ?? {};
            documents.set(ref.path, options?.merge ? { ...previous, ...data } : data);
          },
        ),
        update: vi.fn((ref: FakeRef, data: Record<string, unknown>) => {
          documents.set(ref.path, { ...(documents.get(ref.path) ?? {}), ...data });
        }),
        delete: vi.fn((ref: FakeRef) => documents.delete(ref.path)),
      };

      return callback(transaction);
    }),
  };
});

vi.mock("firebase/firestore", () => ({
  collection: firestore.collection,
  doc: firestore.doc,
  getDocs: firestore.getDocs,
  increment: firestore.increment,
  orderBy: firestore.orderBy,
  query: firestore.query,
  runTransaction: firestore.runTransaction,
  serverTimestamp: firestore.serverTimestamp,
}));

vi.mock("@/config/firebase", () => ({ db: { id: "fake-db" } }));
vi.mock("@/services/fondo-cache", () => ({
  invalidateFondoCache: vi.fn(async () => undefined),
}));

import * as providersModule from "@/services/providers";
import { ProvidersService } from "@/services/providers";

describe("provider name uniqueness by account", () => {
  beforeEach(() => {
    firestore.documents.clear();
    vi.clearAllMocks();
  });

  test("allows the same normalized name in different accounts", async () => {
    await expect(
      ProvidersService.addProvider(
        "DELIKOR",
        "Proveedor Uno",
        undefined,
        undefined,
        undefined,
        undefined,
        "BCR",
      ),
    ).resolves.toMatchObject({ name: "PROVEEDOR UNO", accountId: "BCR" });

    await expect(
      ProvidersService.addProvider(
        "DELIKOR",
        " proveedor uno ",
        undefined,
        undefined,
        undefined,
        undefined,
        "BN",
      ),
    ).resolves.toMatchObject({ name: "PROVEEDOR UNO", accountId: "BN" });
  });

  test("rejects an account-scoped duplicate of a global provider", async () => {
    await ProvidersService.addProvider("DELIKOR", "Proveedor Uno");

    await expect(
      ProvidersService.addProvider(
        "DELIKOR",
        "Proveedor Uno",
        undefined,
        undefined,
        undefined,
        undefined,
        "BCR",
      ),
    ).rejects.toThrow("Ya existe un proveedor con ese nombre.");
  });

  test("rejects a global duplicate of an account-scoped provider", async () => {
    await ProvidersService.addProvider(
      "DELIKOR",
      "Proveedor Uno",
      undefined,
      undefined,
      undefined,
      undefined,
      "BCR",
    );

    await expect(
      ProvidersService.addProvider("DELIKOR", "Proveedor Uno"),
    ).rejects.toThrow("Ya existe un proveedor con ese nombre.");
  });

  test("rejects a duplicate in the same account when the existing index is legacy", async () => {
    firestore.documents.set("proveedores/DELIKOR/items/0007", {
      code: "0007",
      name: "PROVEEDOR UNO",
      company: "DELIKOR",
      accountId: "BCR",
      movementCount: 0,
    });
    firestore.documents.set("proveedores/DELIKOR/names/PROVEEDOR%20UNO", {
      code: "0007",
      name: "PROVEEDOR UNO",
    });

    await expect(
      ProvidersService.addProvider(
        "DELIKOR",
        "Proveedor Uno",
        undefined,
        undefined,
        undefined,
        undefined,
        "BCR",
      ),
    ).rejects.toThrow("Ya existe un proveedor con ese nombre.");
  });

  test("removes the legacy name index owned by an account-scoped provider", async () => {
    firestore.documents.set("proveedores/DELIKOR/items/0007", {
      code: "0007",
      name: "PROVEEDOR UNO",
      company: "DELIKOR",
      accountId: "BCR",
      movementCount: 0,
    });
    firestore.documents.set("proveedores/DELIKOR/names/PROVEEDOR%20UNO", {
      code: "0007",
      name: "PROVEEDOR UNO",
    });

    await ProvidersService.removeProvider("DELIKOR", "0007");

    expect(
      firestore.documents.has("proveedores/DELIKOR/names/PROVEEDOR%20UNO"),
    ).toBe(false);
  });

  test("migrates a legacy name index when an account-scoped provider is updated", async () => {
    firestore.documents.set("proveedores/DELIKOR/items/0007", {
      code: "0007",
      name: "PROVEEDOR UNO",
      company: "DELIKOR",
      accountId: "BCR",
      movementCount: 0,
    });
    firestore.documents.set("proveedores/DELIKOR/names/PROVEEDOR%20UNO", {
      code: "0007",
      name: "PROVEEDOR UNO",
    });

    await ProvidersService.updateProvider(
      "DELIKOR",
      "0007",
      "Proveedor Uno",
      undefined,
      undefined,
      undefined,
      undefined,
      "BCR",
    );

    expect(
      firestore.documents.has("proveedores/DELIKOR/names/PROVEEDOR%20UNO"),
    ).toBe(false);
    expect(
      firestore.documents.has(
        "proveedores/DELIKOR/names/BCR%20PROVEEDOR%20UNO",
      ),
    ).toBe(true);
  });

  test("selects duplicate candidates that overlap the requested account", () => {
    const selectCandidates = (
      providersModule as unknown as {
        getProvidersInDuplicateScope?: (
          providers: Array<{ code: string; name: string; accountId?: string }>,
          accountId?: string,
        ) => Array<{ code: string }>;
      }
    ).getProvidersInDuplicateScope;

    const result = selectCandidates?.(
      [
        { code: "0001", name: "PROVEEDOR UNO", accountId: "BCR" },
        { code: "0002", name: "PROVEEDOR UNO", accountId: "BN" },
        { code: "0003", name: "PROVEEDOR UNO" },
      ],
      "BN",
    );

    expect(result?.map((provider) => provider.code)).toEqual(["0002", "0003"]);
  });
});
