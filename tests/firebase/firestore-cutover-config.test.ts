import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  normalizeFirestoreDatabaseId,
  resolveFirestoreDatabaseId,
  toFirestoreDatabaseLabel,
} from "@/config/firestore-database";
import { resolveAdminFirestoreDatabaseId } from "@/lib/firebase-admin";
import { validateFirestoreDatabaseTarget } from "../../scripts/validate-firestore-database-target.mjs";

type FirebaseConfig = {
  functions: Array<{
    runtime?: string;
  }>;
  firestore: Array<{
    database: string;
    rules: string;
    indexes: string;
  }>;
};

type FunctionsPackage = {
  engines: {
    node: string;
  };
};

type FirestoreIndexes = {
  indexes: Array<{
    collectionGroup: string;
    queryScope: "COLLECTION" | "COLLECTION_GROUP";
    fields: Array<{
      fieldPath: string;
      order?: "ASCENDING" | "DESCENDING";
      arrayConfig?: "CONTAINS";
    }>;
  }>;
  fieldOverrides: unknown[];
};

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const indexSignature = (index: FirestoreIndexes["indexes"][number]) =>
  JSON.stringify(index);

describe("cambio de Firestore de produccion", () => {
  it("despliega Cloud Functions con runtime Node.js 22", () => {
    const firebaseConfig = readJson<FirebaseConfig>("firebase.json");
    const functionsPackage = readJson<FunctionsPackage>("functions/package.json");

    expect(functionsPackage.engines.node).toBe("22");
    expect(firebaseConfig.functions.every((entry) => entry.runtime === undefined)).toBe(true);
  });

  it("resuelve cliente y Admin de produccion hacia (default)", () => {
    expect(
      resolveFirestoreDatabaseId({
        nodeEnv: "production",
        explicitDatabaseId: undefined,
      }),
    ).toBeUndefined();
    expect(resolveAdminFirestoreDatabaseId({ NODE_ENV: "production" })).toBeUndefined();
    expect(toFirestoreDatabaseLabel(undefined)).toBe("(default)");
  });

  it("normaliza los alias de (default) sin convertirlos en una base nombrada", () => {
    expect(normalizeFirestoreDatabaseId("default")).toBeUndefined();
    expect(normalizeFirestoreDatabaseId("(default)")).toBeUndefined();
    expect(normalizeFirestoreDatabaseId(" restauracion ")).toBe("restauracion");
  });

  it("rechaza cualquier override de produccion hacia restauracion", () => {
    expect(() =>
      validateFirestoreDatabaseTarget({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "restauracion",
        FIRESTORE_DATABASE_ID: "restauracion",
      }),
    ).toThrow(/Production debe usar \(default\)/);
  });

  it("rechaza destinos distintos entre cliente y Admin", () => {
    expect(() =>
      validateFirestoreDatabaseTarget({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "restauracion",
        FIRESTORE_DATABASE_ID: "otra-base",
      }),
    ).toThrow(/Destino Firestore distinto/);
  });

  it("mantiene reglas e indices declarados para default y rollback", () => {
    const config = readJson<FirebaseConfig>("firebase.json");

    expect(config.firestore).toEqual([
      {
        database: "(default)",
        rules: "firestore.rules",
        indexes: "firestore.indexes.json",
      },
      {
        database: "restauracion",
        rules: "firestore.rules",
        indexes: "firestore.indexes.json",
      },
    ]);
  });

  it("no contiene indices compuestos duplicados o incompletos", () => {
    const config = readJson<FirestoreIndexes>("firestore.indexes.json");
    const signatures = config.indexes.map(indexSignature);

    expect(new Set(signatures).size).toBe(signatures.length);
    expect(config.fieldOverrides).toEqual([]);
    for (const index of config.indexes) {
      expect(index.collectionGroup.trim()).not.toBe("");
      expect(index.fields.length).toBeGreaterThanOrEqual(2);
      for (const field of index.fields) {
        expect(field.fieldPath.trim()).not.toBe("");
        expect(Boolean(field.order) !== Boolean(field.arrayConfig)).toBe(true);
      }
    }
  });
});
