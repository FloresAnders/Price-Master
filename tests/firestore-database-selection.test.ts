import { describe, expect, it } from "vitest";

import {
  normalizeFirestoreDatabaseId,
  resolveFirestoreDatabaseId,
  toFirestoreDatabaseLabel,
} from "@/config/firestore-database";
import { resolveAdminFirestoreDatabaseId } from "@/lib/firebase-admin";

describe("Firestore database selection", () => {
  it.each([undefined, "", "   ", "default", "(default)"])(
    "normalizes %p to the default database",
    (value) => {
      expect(normalizeFirestoreDatabaseId(value)).toBeUndefined();
    },
  );

  it("trims and preserves a named database", () => {
    expect(normalizeFirestoreDatabaseId("  restauracion  ")).toBe(
      "restauracion",
    );
  });

  it("uses default in production when no override exists", () => {
    expect(resolveFirestoreDatabaseId({ nodeEnv: "production" })).toBeUndefined();
  });

  it.each(["development", "test", undefined, "staging"])(
    "uses restauracion outside production for NODE_ENV=%p",
    (nodeEnv) => {
      expect(resolveFirestoreDatabaseId({ nodeEnv })).toBe("restauracion");
    },
  );

  it("honors an explicit named database", () => {
    expect(
      resolveFirestoreDatabaseId({
        nodeEnv: "production",
        explicitDatabaseId: "restauracion",
      }),
    ).toBe("restauracion");
  });

  it("normalizes an explicit default alias", () => {
    expect(
      resolveFirestoreDatabaseId({
        nodeEnv: "development",
        explicitDatabaseId: "(default)",
      }),
    ).toBeUndefined();
  });

  it("exposes a stable public label", () => {
    expect(toFirestoreDatabaseLabel(undefined)).toBe("(default)");
    expect(toFirestoreDatabaseLabel("restauracion")).toBe("restauracion");
  });
});

describe("Firebase Admin database selection", () => {
  it("uses default in production when no override exists", () => {
    expect(
      resolveAdminFirestoreDatabaseId({ NODE_ENV: "production" }),
    ).toBeUndefined();
  });

  it.each(["development", "test"])(
    "uses restauracion for NODE_ENV=%s",
    (nodeEnv) => {
      expect(resolveAdminFirestoreDatabaseId({ NODE_ENV: nodeEnv })).toBe(
        "restauracion",
      );
    },
  );

  it("normalizes an explicit default database", () => {
    expect(
      resolveAdminFirestoreDatabaseId({
        NODE_ENV: "development",
        FIRESTORE_DATABASE_ID: "(default)",
      }),
    ).toBeUndefined();
  });

  it("prefers the private Admin override over the public override", () => {
    expect(
      resolveAdminFirestoreDatabaseId({
        NODE_ENV: "development",
        FIRESTORE_DATABASE_ID: "admin-db",
        NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "client-db",
      }),
    ).toBe("admin-db");
  });
});
