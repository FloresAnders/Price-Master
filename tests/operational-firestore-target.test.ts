import { describe, expect, it } from "vitest";

import {
  getOperationalFirestore,
  resolveOperationalFirestoreDatabaseId,
} from "../scripts/operational-firestore-target.mjs";

describe("operational Firestore target", () => {
  it.each([{}, { FIRESTORE_DATABASE_ID: "" }, { FIRESTORE_DATABASE_ID: "(default)" }, { FIRESTORE_DATABASE_ID: "default" }])(
    "uses the default database for production maintenance by default",
    (env) => {
      expect(resolveOperationalFirestoreDatabaseId(env)).toBeUndefined();
    },
  );

  it("allows an explicit named database", () => {
    expect(
      resolveOperationalFirestoreDatabaseId({
        FIRESTORE_DATABASE_ID: " restauracion ",
      }),
    ).toBe("restauracion");
  });

  it("prefers the private database variable", () => {
    expect(
      resolveOperationalFirestoreDatabaseId({
        FIRESTORE_DATABASE_ID: "admin-db",
        NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "client-db",
      }),
    ).toBe("admin-db");
  });

  it("returns default Admin Firestore without applying database settings", () => {
    const defaultDb = { id: "default" };
    const namedDb = { id: "named" };
    const admin = {
      firestore: () => defaultDb,
      app: () => ({ firestore: () => namedDb }),
    };

    expect(getOperationalFirestore(admin, {})).toEqual({
      db: defaultDb,
      databaseId: undefined,
      databaseLabel: "(default)",
    });
  });

  it("returns named Admin Firestore only when explicitly requested", () => {
    const defaultDb = { id: "default" };
    const namedDb = { id: "restauracion" };
    const admin = {
      firestore: () => defaultDb,
      app: () => ({ firestore: (databaseId: string) => ({ ...namedDb, databaseId }) }),
    };

    expect(
      getOperationalFirestore(admin, {
        FIRESTORE_DATABASE_ID: "restauracion",
      }),
    ).toEqual({
      db: { ...namedDb, databaseId: "restauracion" },
      databaseId: "restauracion",
      databaseLabel: "restauracion",
    });
  });
});
