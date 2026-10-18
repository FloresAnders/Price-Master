import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateFirestoreDatabaseTarget } from "../scripts/validate-firestore-database-target.mjs";

describe("Firestore database build target validation", () => {
  it.each([
    {},
    {
      NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "(default)",
      FIRESTORE_DATABASE_ID: "default",
    },
  ])("accepts default for Vercel Production", (databaseEnv) => {
    expect(
      validateFirestoreDatabaseTarget({
        VERCEL_ENV: "production",
        ...databaseEnv,
      }),
    ).toEqual({
      stage: "production",
      clientDatabaseId: "(default)",
      adminDatabaseId: "(default)",
    });
  });

  it.each([
    { NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "restauracion" },
    { FIRESTORE_DATABASE_ID: "restauracion" },
  ])("rejects restauracion for Vercel Production", (databaseEnv) => {
    expect(() =>
      validateFirestoreDatabaseTarget({
        VERCEL_ENV: "production",
        ...databaseEnv,
      }),
    ).toThrow(/production.*\(default\)/i);
  });

  it("accepts explicit restauracion for Preview", () => {
    expect(
      validateFirestoreDatabaseTarget({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "restauracion",
      }),
    ).toEqual({
      stage: "preview",
      clientDatabaseId: "restauracion",
      adminDatabaseId: "restauracion",
    });
  });

  it("rejects Preview without an explicit database", () => {
    expect(() =>
      validateFirestoreDatabaseTarget({ VERCEL_ENV: "preview" }),
    ).toThrow(/preview.*restauracion/i);
  });

  it("rejects different client and Admin targets", () => {
    expect(() =>
      validateFirestoreDatabaseTarget({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "restauracion",
        FIRESTORE_DATABASE_ID: "(default)",
      }),
    ).toThrow(/cliente.*admin/i);
  });

  it.each(["production", "preview"])(
    "rejects NODE_ENV other than production for Vercel %s",
    (stage) => {
      expect(() =>
        validateFirestoreDatabaseTarget({
          VERCEL_ENV: stage,
          NODE_ENV: "test",
          NEXT_PUBLIC_FIRESTORE_DATABASE_ID:
            stage === "preview" ? "restauracion" : "(default)",
        }),
      ).toThrow(/NODE_ENV.*production/i);
    },
  );

  it("does not require a Vercel target during local execution", () => {
    expect(validateFirestoreDatabaseTarget({})).toEqual({
      stage: "local",
      clientDatabaseId: "restauracion",
      adminDatabaseId: "restauracion",
    });
  });

  it("rejects a production target loaded from a Next env file", () => {
    const workingDirectory = mkdtempSync(
      path.join(tmpdir(), "firestore-target-test-"),
    );
    const scriptPath = path.resolve(
      "scripts/validate-firestore-database-target.mjs",
    );
    const env = {
      ...process.env,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    };
    delete env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;
    delete env.FIRESTORE_DATABASE_ID;

    try {
      writeFileSync(
        path.join(workingDirectory, ".env"),
        "NEXT_PUBLIC_FIRESTORE_DATABASE_ID=restauracion\n",
      );

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: workingDirectory,
        env,
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/production.*\(default\)/i);
    } finally {
      rmSync(workingDirectory, { recursive: true, force: true });
    }
  });
});
