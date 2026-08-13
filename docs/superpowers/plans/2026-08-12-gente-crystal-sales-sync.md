# Gente Crystal Sales Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably synchronize active and deleted Gente Crystal tickets from the existing browser extension into company-scoped TimeMaster Firestore records without duplicates.

**Architecture:** The content script emits normalized ticket states to a Manifest V3 service worker, which persists a revisioned queue in `chrome.storage.local` and posts it to a dedicated Next.js Route Handler. The server hashes a per-device bearer token, authenticates it inside the same Firestore transaction that upserts the company/ticket document, and never trusts company or device identifiers from the extension.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript, Firebase Admin/Firestore, Manifest V3 Chrome extensions, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-08-12-gente-crystal-sales-sync-design.md`

## Global Constraints

- Treat the existing `extensions/` directory as the extension source of truth.
- Preserve the detector's current ticket, draw, amount, timestamp, and deletion behavior.
- Enforce `company + ticket = one sale` with the Firestore document path.
- Derive company and device only from the authenticated token document.
- Store only the SHA-256 token hash in Firestore and never log the bearer token.
- Persist deleted tickets as tombstones rather than physically deleting them.
- Keep the administration UI and TimeMaster sales-report UI outside this MVP.
- Do not write to production Firestore during automated or browser verification.
- Add no runtime dependencies.

---

### Task 1: Tested server contract and Firestore transaction

**Files:**
- Create: `src/lib/gente-crystal/sales.ts`
- Create: `src/lib/gente-crystal/sales.test.ts`
- Create: `src/lib/gente-crystal/firestore-sales.ts`

**Interfaces:**
- Consumes: `hashToken(token)` from `src/lib/devices/tokens.ts` and `getAdminDb()` from `src/lib/firebase-admin.ts`.
- Produces: `parseGenteCrystalSale`, `readBearerToken`, `mergeGenteCrystalSale`, `GenteCrystalSalesRepository`, and `FirestoreGenteCrystalSalesRepository.sync(tokenHash, sale, now)`.

- [ ] **Step 1: Write failing contract tests**

Create `sales.test.ts` with literal fixtures that cover the accepted active payload, minimal deletion payload, malformed ticket, missing active fields, strict bearer parsing, identical replay, active update, and deletion tombstone:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeGenteCrystalSale,
  parseGenteCrystalSale,
  readBearerToken,
} from "./sales.ts";

const active = {
  ticketId: "41783-2204-59175496",
  sorteo: "12/08/2026 NY NOCHE",
  monto: 100,
  saleAt: "2026-08-13T02:14:00.000Z",
  status: "active",
} as const;
const now = new Date("2026-08-13T02:15:00.000Z");

test("active sales are normalized", () => {
  assert.deepEqual(parseGenteCrystalSale(active), {
    ...active,
    saleAt: new Date(active.saleAt),
  });
});

test("deleted sales require only a ticket", () => {
  assert.deepEqual(
    parseGenteCrystalSale({ ticketId: active.ticketId, status: "deleted" }),
    { ticketId: active.ticketId, status: "deleted" },
  );
});

test("active sales reject invalid required fields", () => {
  assert.throws(() => parseGenteCrystalSale({ ...active, monto: 0 }), /monto/);
  assert.throws(() => parseGenteCrystalSale({ ...active, ticketId: "bad" }), /ticketId/);
  assert.throws(() => parseGenteCrystalSale({ ...active, sorteo: " " }), /sorteo/);
  assert.throws(() => parseGenteCrystalSale({ ...active, saleAt: "bad" }), /saleAt/);
});

test("bearer authorization is strict", () => {
  assert.equal(readBearerToken("Bearer tm_gc_secret"), "tm_gc_secret");
  assert.throws(() => readBearerToken("Basic tm_gc_secret"), /authorization/);
  assert.throws(() => readBearerToken("Bearer "), /authorization/);
});

test("identical active replay does not rewrite the sale", () => {
  const existing = {
    ...active,
    saleAt: new Date(active.saleAt),
    receivedAt: now,
    updatedAt: now,
    deviceId: "palmares-01",
    source: "gente-crystal" as const,
  };
  assert.equal(
    mergeGenteCrystalSale(existing, parseGenteCrystalSale(active), "palmares-01", now).action,
    "already_exists",
  );
});

test("deletion creates an auditable tombstone", () => {
  const result = mergeGenteCrystalSale(
    undefined,
    parseGenteCrystalSale({ ticketId: active.ticketId, status: "deleted" }),
    "palmares-01",
    now,
  );
  assert.equal(result.action, "deleted");
  assert.deepEqual(result.record, {
    ticketId: active.ticketId,
    status: "deleted",
    receivedAt: now,
    updatedAt: now,
    deviceId: "palmares-01",
    source: "gente-crystal",
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/lib/gente-crystal/sales.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `sales.ts`.

- [ ] **Step 3: Implement the pure contract**

Implement exact input types, `GenteCrystalSaleError` with HTTP status, strict validation, timestamp comparison that accepts Firestore `Timestamp.toDate()`, and this merge contract:

```ts
export type GenteCrystalSaleAction =
  | "created"
  | "already_exists"
  | "updated"
  | "deleted";

export function mergeGenteCrystalSale(
  existing: Record<string, unknown> | undefined,
  sale: GenteCrystalSaleInput,
  deviceId: string,
  now: Date,
): { action: GenteCrystalSaleAction; record?: GenteCrystalSaleRecord } {
  if (sale.status === "deleted") {
    return {
      action: "deleted",
      record: {
        ...existing,
        ticketId: sale.ticketId,
        status: "deleted",
        receivedAt: existing?.receivedAt ?? now,
        updatedAt: now,
        deviceId,
        source: "gente-crystal",
      },
    };
  }

  if (existing && activeFieldsEqual(existing, sale)) {
    return { action: "already_exists" };
  }

  return {
    action: existing ? "updated" : "created",
    record: {
      ticketId: sale.ticketId,
      sorteo: sale.sorteo,
      monto: sale.monto,
      saleAt: sale.saleAt,
      receivedAt: existing?.receivedAt ?? now,
      updatedAt: now,
      status: "active",
      deviceId,
      source: "gente-crystal",
    },
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/lib/gente-crystal/sales.test.ts`

Expected: all contract tests pass and 0 fail.

- [ ] **Step 5: Add repository behavior tests before its implementation**

Extend `sales.test.ts` with an in-memory transaction harness that proves unknown/revoked tokens return 401, missing permission returns 403, company IDs containing `/` are rejected, and the repository uses these exact paths:

```text
genteCrystalIntegrationDevices/{sha256-token}
genteCrystalSales/company-palmares/sales/41783-2204-59175496
```

The successful test must also assert that `lastSeenAt` is updated and that an identical replay produces no sale write.

- [ ] **Step 6: Verify repository RED**

Run: `node --test src/lib/gente-crystal/sales.test.ts`

Expected: FAIL because `FirestoreGenteCrystalSalesRepository` does not exist.

- [ ] **Step 7: Implement the repository transaction**

Implement `sync` with one Firestore transaction that reads the hashed device document, validates `revokedAt`, `companyId`, `deviceId`, and `gentecrystal.sales.write`, reads the ticket document, calls `mergeGenteCrystalSale`, conditionally writes the sale, and always updates `lastSeenAt` for a successful request.

- [ ] **Step 8: Verify GREEN and commit**

Run: `node --test src/lib/gente-crystal/sales.test.ts`

Expected: all tests pass and 0 fail.

```powershell
git add src/lib/gente-crystal/sales.ts src/lib/gente-crystal/sales.test.ts src/lib/gente-crystal/firestore-sales.ts
git commit -m "feat: add Gente Crystal sales transaction"
```

### Task 2: Route Handler, protected rules, and device provisioning

**Files:**
- Create: `src/app/api/integrations/gente-crystal/sales/route.ts`
- Create: `src/app/api/integrations/gente-crystal/sales/route.test.ts`
- Create: `scripts/provision-gente-crystal-device.mjs`
- Create: `scripts/provision-gente-crystal-device.test.mjs`
- Modify: `firestore.rules`
- Modify: `package.json`

**Interfaces:**
- Consumes: server contract and repository from Task 1.
- Produces: `POST /api/integrations/gente-crystal/sales`, `createGenteCrystalSalesPost(deps)`, and `npm run provision:gente-crystal-device -- <companyId> <deviceId> <deviceName>`.

- [ ] **Step 1: Write the failing Route Handler tests**

Use an injected repository and fixed clock. Assert malformed JSON returns 400, missing authorization returns 401, repository permission errors preserve 401/403, success returns `{ ok: true, action, ticketId }`, and an unexpected error returns 500 without exposing its message.

```ts
const POST = createGenteCrystalSalesPost({
  now: () => new Date("2026-08-13T02:15:00.000Z"),
  createRepository: () => ({
    sync: async () => ({ action: "created" as const }),
  }),
});

const response = await POST(new Request("http://localhost/api/integrations/gente-crystal/sales", {
  method: "POST",
  headers: { authorization: "Bearer tm_gc_secret", "content-type": "application/json" },
  body: JSON.stringify(active),
}));

assert.equal(response.status, 201);
assert.deepEqual(await response.json(), {
  ok: true,
  action: "created",
  ticketId: active.ticketId,
});
```

- [ ] **Step 2: Verify route RED**

Run: `node --test src/app/api/integrations/gente-crystal/sales/route.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `route.ts`.

- [ ] **Step 3: Implement the Route Handler**

Parse JSON inside a guarded block, call `readBearerToken`, `parseGenteCrystalSale`, hash with `hashToken`, and pass only the hash to the repository. Return 201 only for `created`; return 200 for the other successful actions. Map `GenteCrystalSaleError.status` directly and use the generic `internal_server_error` body for other failures.

- [ ] **Step 4: Verify route GREEN**

Run: `node --test src/app/api/integrations/gente-crystal/sales/route.test.ts`

Expected: all route tests pass and 0 fail.

- [ ] **Step 5: Write failing provisioning helper tests**

Test an injected token so expected values are literal and no Firestore call occurs:

```js
test("buildProvisionedDevice stores only the hash", () => {
  const result = buildProvisionedDevice({
    companyId: "company-palmares",
    deviceId: "palmares-01",
    deviceName: "PALMARES-PC-01",
    token: "tm_gc_test_secret",
    now: new Date("2026-08-13T02:15:00.000Z"),
  });
  assert.equal(result.token, "tm_gc_test_secret");
  assert.equal(result.documentPath.startsWith("genteCrystalIntegrationDevices/"), true);
  assert.equal("token" in result.document, false);
  assert.deepEqual(result.document.permissions, ["gentecrystal.sales.write"]);
});
```

- [ ] **Step 6: Verify provisioning RED, implement, and verify GREEN**

Run: `node --test scripts/provision-gente-crystal-device.test.mjs`

Expected RED: FAIL because the script does not exist.

Implement exported pure `buildProvisionedDevice`, CLI argument validation, `tm_gc_` token generation, service-account environment parsing, selected Firestore database support, the single device-document write, and one-time token output. Guard `main()` so importing the file never writes.

Run: `node --test scripts/provision-gente-crystal-device.test.mjs`

Expected GREEN: all tests pass and 0 fail.

- [ ] **Step 7: Protect integration collections in Firestore rules**

Add explicit deny blocks and exclude both top-level collections from the existing authenticated catch-all:

```text
match /genteCrystalIntegrationDevices/{document=**} {
  allow read, write: if false;
}
match /genteCrystalSales/{document=**} {
  allow read, write: if false;
}
```

Add `provision:gente-crystal-device` to `package.json`. Do not execute the provisioning script.

- [ ] **Step 8: Verify and commit**

Run:

```powershell
node --test src/app/api/integrations/gente-crystal/sales/route.test.ts scripts/provision-gente-crystal-device.test.mjs
npx tsc --noEmit
```

Expected: all tests pass and TypeScript exits 0.

```powershell
git add src/app/api/integrations/gente-crystal/sales/route.ts src/app/api/integrations/gente-crystal/sales/route.test.ts scripts/provision-gente-crystal-device.mjs scripts/provision-gente-crystal-device.test.mjs firestore.rules package.json
git commit -m "feat: expose authenticated Gente Crystal sales API"
```

### Task 3: Tested extension queue and service-worker delivery

**Files:**
- Create: `extensions/sync-core.js`
- Create: `extensions/sync-core.test.cjs`
- Create: `extensions/background.js`
- Modify: `extensions/content.js`
- Modify: `extensions/manifest.json`

**Interfaces:**
- Consumes: normalized sales already produced by the detector and the API contract from Task 2.
- Produces: global/CommonJS `TimeMasterGenteCrystalSync`, `TM_GC_QUEUE_SALES`, `TM_GC_CONFIG_UPDATED`, storage key `genteCrystalSyncQueue`, and a periodic `tmGcSync` alarm.

- [ ] **Step 1: Write failing queue-core tests**

Cover active/deleted payload creation, unchanged-event deduplication, latest-state replacement, revision-safe success, retry classification, and capped backoff:

```js
test("a newer deletion replaces a synced active state", () => {
  const activeQueue = enqueueEvents({}, [{
    ticketId: "41783-2204-59175496",
    sorteo: "12/08/2026 NY NOCHE",
    monto: 100,
    saleAt: "2026-08-13T02:14:00.000Z",
    status: "active",
  }], 1000);
  const synced = markSucceeded(activeQueue, activeQueue["41783-2204-59175496"].revision, "41783-2204-59175496", 1100);
  const deleted = enqueueEvents(synced, [{ ticketId: "41783-2204-59175496", status: "deleted" }], 1200);
  assert.equal(deleted["41783-2204-59175496"].state, "pending");
  assert.equal(deleted["41783-2204-59175496"].revision, 2);
});

test("an old response cannot sync a newer revision", () => {
  const result = markSucceeded(queueAtRevisionTwo, 1, "41783-2204-59175496", 1300);
  assert.equal(result["41783-2204-59175496"].state, "pending");
});
```

- [ ] **Step 2: Verify core RED**

Run: `node --test extensions/sync-core.test.cjs`

Expected: FAIL because `sync-core.js` does not exist.

- [ ] **Step 3: Implement the minimal pure queue core**

Expose the same object through `globalThis.TimeMasterGenteCrystalSync` and `module.exports`. Treat 408, 429, and 5xx as retryable; cap backoff at 15 minutes; keep terminal 4xx errors visible; and never include configuration or bearer tokens in queue records.

- [ ] **Step 4: Verify core GREEN**

Run: `node --test extensions/sync-core.test.cjs`

Expected: all queue tests pass and 0 fail.

- [ ] **Step 5: Implement service-worker orchestration**

Use `importScripts("sync-core.js")`, serialize storage mutations through one promise chain, enqueue batches before fetching, set `sending` before each request, and apply success/error only when ticket plus revision still match. Fetch `${apiBaseUrl}/api/integrations/gente-crystal/sales` with JSON and the bearer header. Create/recreate the one-minute alarm on install/startup and flush it on queue/config messages.

- [ ] **Step 6: Connect the existing detector**

Load `sync-core.js` before `content.js`, retain the active popup list behavior, and send one `TM_GC_QUEUE_SALES` batch containing each resolved visible active sale plus every detected deletion. Build payloads through the tested core so polling the same DOM does not create a new queue revision.

- [ ] **Step 7: Update Manifest V3 metadata**

Set version `1.4.0`, add `background.service_worker`, add the `alarms` permission, and add these host permissions:

```json
[
  "https://gentecrystal.net/*",
  "https://timemaster.es/*",
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*"
]
```

- [ ] **Step 8: Verify and commit**

Run:

```powershell
node --test extensions/sync-core.test.cjs
node -e "JSON.parse(require('node:fs').readFileSync('extensions/manifest.json','utf8')); console.log('manifest ok')"
node --check extensions/sync-core.js
node --check extensions/background.js
node --check extensions/content.js
```

Expected: tests pass; manifest parses; all syntax checks exit 0.

```powershell
git add extensions/sync-core.js extensions/sync-core.test.cjs extensions/background.js extensions/content.js extensions/manifest.json
git commit -m "feat: queue Gente Crystal extension sales"
```

### Task 4: Extension setup UI, diagnostics, and complete verification

**Files:**
- Modify: `extensions/popup.html`
- Modify: `extensions/popup.css`
- Modify: `extensions/popup.js`
- Modify: `extensions/README.txt`

**Interfaces:**
- Consumes: `genteCrystalIntegrationConfig` and `genteCrystalSyncQueue` from Task 3.
- Produces: editable TimeMaster URL/token fields, save action, and queue counts for pending/synced/error states.

- [ ] **Step 1: Add the minimal setup form**

Add labeled `apiUrl` and password-type `token` inputs, a `guardar-config` button, and a `sync-status` diagnostic block. Default the URL to `https://timemaster.es`; allow plain HTTP only for `localhost` and `127.0.0.1`; require the token to start with `tm_gc_` when non-empty.

- [ ] **Step 2: Save configuration and wake the worker**

On save, normalize the URL without a trailing slash, persist:

```js
{
  genteCrystalIntegrationConfig: {
    apiBaseUrl,
    token,
  },
}
```

Then send `{ type: "TM_GC_CONFIG_UPDATED" }`. Show queue totals by state and update them from `chrome.storage.onChanged` without exposing the token in diagnostics.

- [ ] **Step 3: Update operator documentation**

Document version 1.4.0, extension reload, one-time token provisioning command, popup configuration, retry meanings, and the fact that `Limpiar` clears only the local display list—not Firestore tombstones or the delivery queue.

- [ ] **Step 4: Run full static verification**

Run:

```powershell
node --test src/lib/gente-crystal/sales.test.ts src/app/api/integrations/gente-crystal/sales/route.test.ts scripts/provision-gente-crystal-device.test.mjs extensions/sync-core.test.cjs
npx eslint src/lib/gente-crystal/sales.ts src/lib/gente-crystal/sales.test.ts src/lib/gente-crystal/firestore-sales.ts src/app/api/integrations/gente-crystal/sales/route.ts src/app/api/integrations/gente-crystal/sales/route.test.ts
npx tsc --noEmit
npm run build
node --check extensions/popup.js
```

Expected: all tests pass, lint/typecheck/build exit 0, and popup syntax is valid.

- [ ] **Step 5: Verify in the already connected browser**

Reload the unpacked extension from its extensions page, reload the existing Gente Crystal `entradas.php` tab, open the popup, and verify:

- detector version 1.4.0 connects;
- existing ticket rows still render;
- API URL/token settings render and persist;
- queue diagnostics render without showing the token;
- no production request is made without an intentionally provisioned token.

- [ ] **Step 6: Inspect scope and commit**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only the spec, plan, server integration, extension integration, rules, package script, and tests are changed.

```powershell
git add extensions/popup.html extensions/popup.css extensions/popup.js extensions/README.txt
git commit -m "feat: configure Gente Crystal synchronization"
```
