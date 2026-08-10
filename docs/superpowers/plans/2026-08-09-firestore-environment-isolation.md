# Firestore Environment Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production server Firestore use `restauracion`, keep development on `(default)`, and return safe device-link user payloads.

**Architecture:** Add small pure helpers beside Firebase Admin initialization so database selection and user serialization can be tested without connecting to Firebase. Keep route behavior unchanged except for including `user.id` and removing `password`.

**Tech Stack:** Next.js API routes, TypeScript, Firebase Admin SDK, Node built-in test runner.

## Global Constraints

- Production must use `restauracion` for browser and server Firestore access.
- Development and tests must use `(default)` unless explicitly overridden.
- `FIRESTORE_DATABASE_ID` remains the preferred server-side override.
- `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` remains a compatible fallback.
- Device authentication must receive the Firestore document ID as `user.id`.
- Device authentication must not return the stored password field.
- Existing data must not be migrated or deleted by this change.
- No production deployment is part of this implementation unless separately authorized.

---

### Task 1: Admin Firestore Database Resolver

**Files:**
- Modify: `src/lib/firebase-admin.ts`
- Test: `src/lib/firebase-admin-config.test.ts`

**Interfaces:**
- Produces: `resolveAdminFirestoreDatabaseId(env: Record<string, string | undefined>): string | undefined`
- Produces: `getAdminDb()` uses `resolveAdminFirestoreDatabaseId(process.env)`.

- [ ] **Step 1: Write failing resolver tests**

```typescript
test("resolveAdminFirestoreDatabaseId uses restauracion in production without overrides", () => {
  assert.equal(
    resolveAdminFirestoreDatabaseId({
      NODE_ENV: "production",
      FIRESTORE_DATABASE_ID: "",
      NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "",
    }),
    "restauracion",
  );
});

test("resolveAdminFirestoreDatabaseId keeps default database in development without overrides", () => {
  assert.equal(
    resolveAdminFirestoreDatabaseId({
      NODE_ENV: "development",
      FIRESTORE_DATABASE_ID: "",
      NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "",
    }),
    undefined,
  );
});

test("resolveAdminFirestoreDatabaseId prefers server override before public override", () => {
  assert.equal(
    resolveAdminFirestoreDatabaseId({
      NODE_ENV: "production",
      FIRESTORE_DATABASE_ID: "server-db",
      NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "public-db",
    }),
    "server-db",
  );
});

test("resolveAdminFirestoreDatabaseId uses public override when server override is empty", () => {
  assert.equal(
    resolveAdminFirestoreDatabaseId({
      NODE_ENV: "production",
      FIRESTORE_DATABASE_ID: " ",
      NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "public-db",
    }),
    "public-db",
  );
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --test src/lib/firebase-admin-config.test.ts`
Expected: FAIL because `resolveAdminFirestoreDatabaseId` is not exported.

- [ ] **Step 3: Implement resolver and wire `getAdminDb()`**

```typescript
export function resolveAdminFirestoreDatabaseId(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const explicitDatabaseId = (
    env.FIRESTORE_DATABASE_ID ||
    env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID ||
    ""
  ).trim();

  if (explicitDatabaseId) return explicitDatabaseId;
  if (env.NODE_ENV === "production") return "restauracion";
  return undefined;
}
```

Then update `getAdminDb()` to call this helper and use `getFirestore(getAdminApp())` only when the helper returns `undefined`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `node --test src/lib/firebase-admin-config.test.ts`
Expected: PASS for all resolver and service account tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase-admin.ts src/lib/firebase-admin-config.test.ts
git commit -m "fix: isolate production firestore database"
```

### Task 2: Device Link User Serialization

**Files:**
- Modify: `src/app/api/device-link/whoami/route.ts`
- Test: `src/app/api/device-link/whoami/route.test.ts`

**Interfaces:**
- Consumes: `getAdminDb()` already bound to correct database by Task 1.
- Produces: `serializeDeviceLinkUser(id: string, data: Record<string, unknown> | undefined): Record<string, unknown> | null`

- [ ] **Step 1: Write failing serialization tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { serializeDeviceLinkUser } from "./route.ts";

test("serializeDeviceLinkUser includes firestore document id", () => {
  assert.deepEqual(
    serializeDeviceLinkUser("user-123", { name: "DELIFOOD", role: "admin" }),
    { id: "user-123", name: "DELIFOOD", role: "admin" },
  );
});

test("serializeDeviceLinkUser removes stored password", () => {
  assert.deepEqual(
    serializeDeviceLinkUser("user-123", {
      name: "PALMARES",
      password: "secret",
    }),
    { id: "user-123", name: "PALMARES" },
  );
});

test("serializeDeviceLinkUser keeps missing users absent", () => {
  assert.equal(serializeDeviceLinkUser("user-123", undefined), null);
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --test src/app/api/device-link/whoami/route.test.ts`
Expected: FAIL because `serializeDeviceLinkUser` is not exported.

- [ ] **Step 3: Implement serialization and route usage**

```typescript
export function serializeDeviceLinkUser(
  id: string,
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!data) return null;
  const { password, ...safeUser } = data;
  return { id, ...safeUser };
}
```

Then replace `const userData = userSnap.exists ? userSnap.data() : null;` with `const userData = serializeDeviceLinkUser(userSnap.id, userSnap.exists ? userSnap.data() : undefined);`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `node --test src/app/api/device-link/whoami/route.test.ts`
Expected: PASS for all serialization tests.

- [ ] **Step 5: Run focused regression tests**

Run: `node --test src/lib/firebase-admin-config.test.ts src/app/api/device-link/whoami/route.test.ts`
Expected: PASS for all tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/device-link/whoami/route.ts src/app/api/device-link/whoami/route.test.ts
git commit -m "fix: sanitize device link user payload"
```
