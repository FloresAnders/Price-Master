import assert from "node:assert/strict";
import test from "node:test";
import { readFirebaseServiceAccountFromEnv } from "./firebase-admin.ts";

test("readFirebaseServiceAccountFromEnv reads only FIREBASE_SERVICE_ACCOUNT_KEY", () => {
  const legacyServiceAccount = JSON.stringify({
    project_id: "legacy-project",
    client_email: "legacy@example.com",
    private_key: "legacy",
  });
  const serviceAccount = JSON.stringify({
    project_id: "env-project",
    client_email: "firebase@example.com",
    private_key: "line1\\nline2",
  });

  const parsed = readFirebaseServiceAccountFromEnv({
    FIREBASE_SERVICE_ACCOUNT_KEY: serviceAccount,
    FIREBASE_ADMIN_SERVICE_ACCOUNT: legacyServiceAccount,
  });

  assert.equal(parsed.projectId, "env-project");
  assert.equal(parsed.clientEmail, "firebase@example.com");
  assert.equal(parsed.privateKey, "line1\nline2");
});

test("readFirebaseServiceAccountFromEnv fails when FIREBASE_SERVICE_ACCOUNT_KEY is missing", () => {
  assert.throws(
    () =>
      readFirebaseServiceAccountFromEnv({
        FIREBASE_ADMIN_SERVICE_ACCOUNT: JSON.stringify({
          project_id: "legacy-project",
          client_email: "legacy@example.com",
          private_key: "legacy",
        }),
      }),
    /FIREBASE_SERVICE_ACCOUNT_KEY/,
  );
});
