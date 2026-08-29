# Gente Crystal Daily Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and read one minimal Gente Crystal daily document per company/date while preserving complete individual sales and the public API contracts.

**Architecture:** A pure daily-sales module converts canonical individual records into minimal map entries and reconstructs the existing API result. The existing `POST` transaction dual-writes targeted map fields, a feature-gated reader performs one direct daily-document read after backfill, and an explicit transactional script migrates existing records safely.

**Tech Stack:** TypeScript 5, Next.js 16 Route Handlers, Firebase Admin/Firestore transactions, Node.js ESM migration scripts, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-28-gente-crystal-daily-consolidation-design.md`

## Global Constraints

- The individual `genteCrystalSales/{companyId}/sales/{ticketId}` document remains the source of truth.
- Daily entries contain only `sorteo`, `captureOrigin`, `monto`, `saleAt`, and `status`; `ticketId` is the map key.
- Deleted tickets are removed from the daily map but remain tombstones in the individual collection.
- The extension request and response contracts do not change.
- Production migration is an explicit operator action and never runs from tests or builds.
- Daily reads remain disabled until live backfill and verification succeed.

---

### Task 1: Pure Daily Sales Model

**Files:**
- Create: `src/lib/gente-crystal/daily-sales.ts`
- Create: `tests/gente-crystal/daily-sales.test.ts`
- Modify: `src/lib/gente-crystal/read-sales.ts`

**Interfaces:**
- Consumes: `GenteCrystalSaleRecord`, `GenteCrystalDailyResult`, and `buildGenteCrystalDailyResult`.
- Produces: `readGenteCrystalDate(value)`, `genteCrystalCostaRicaDateKey(value)`, `buildGenteCrystalDailyEntry(record)`, `planGenteCrystalDailyMutation(existing, resulting)`, and `buildGenteCrystalDailyResultFromDocument(data)`.

- [ ] **Step 1: Write failing model tests**

Create tests covering UTC-to-Costa-Rica boundaries, the exact minimal fields,
create/update/delete/date-move mutation plans, and reconstruction from a map:

```ts
import { describe, expect, it } from "vitest";
import {
  buildGenteCrystalDailyEntry,
  buildGenteCrystalDailyResultFromDocument,
  genteCrystalCostaRicaDateKey,
  planGenteCrystalDailyMutation,
} from "@/lib/gente-crystal/daily-sales";

const active = {
  ticketId: "42148-2204-59468315",
  sorteo: "LOTERIA",
  captureOrigin: "local_button",
  monto: 2000,
  saleAt: new Date("2026-08-24T00:02:00.000Z"),
  status: "active",
};

it("uses the Costa Rica day and stores only the minimal active fields", () => {
  expect(genteCrystalCostaRicaDateKey(active.saleAt)).toBe("2026-08-23");
  expect(buildGenteCrystalDailyEntry(active)).toEqual({
    sorteo: "LOTERIA",
    captureOrigin: "local_button",
    monto: 2000,
    saleAt: active.saleAt,
    status: "active",
  });
});

it("removes an active ticket when the result is deleted", () => {
  const resulting = { ...active, status: "deleted" };
  expect(planGenteCrystalDailyMutation(active, resulting)).toEqual({
    remove: { date: "2026-08-23", ticketId: active.ticketId },
  });
});
```

- [ ] **Step 2: Run tests and confirm the missing module failure**

Run: `npx vitest run tests/gente-crystal/daily-sales.test.ts`

Expected: FAIL because `@/lib/gente-crystal/daily-sales` does not exist.

- [ ] **Step 3: Implement the pure model**

Move the current private timestamp conversion in `read-sales.ts` behind an
exported `readGenteCrystalDate` function. Implement the daily module with these
exact public types and behavior:

```ts
export type GenteCrystalDailySaleEntry = {
  sorteo: string;
  captureOrigin: "local_button" | "indirect";
  monto: number;
  saleAt: Date;
  status: "active";
};

export type GenteCrystalDailyMutation = {
  remove?: { date: string; ticketId: string };
  upsert?: {
    date: string;
    ticketId: string;
    entry: GenteCrystalDailySaleEntry;
  };
};
```

`planGenteCrystalDailyMutation` removes the old active entry when the result is
deleted or changes Costa Rica day, and upserts every valid resulting active
record. `buildGenteCrystalDailyResultFromDocument` accepts `{sales: {...}}`,
rebuilds `ticketId` from each key, and delegates validation, sorting, and totals
to `buildGenteCrystalDailyResult`.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/gente-crystal/daily-sales.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the pure model**

```bash
git add src/lib/gente-crystal/daily-sales.ts src/lib/gente-crystal/read-sales.ts tests/gente-crystal/daily-sales.test.ts
git commit -m "Add Gente Crystal daily sales model"
```

### Task 2: Transactional Dual Write

**Files:**
- Modify: `src/lib/gente-crystal/firestore-sales.ts`
- Create: `tests/gente-crystal/firestore-sales.test.ts`

**Interfaces:**
- Consumes: `planGenteCrystalDailyMutation(existing, resulting)` from Task 1.
- Produces: the existing `FirestoreGenteCrystalSalesRepository.sync()` contract with atomic daily-map writes.

- [ ] **Step 1: Write failing repository tests with a fake transaction**

The fake Firestore records document paths, reads, and `set` operations. Assert:

```ts
expect(writePaths).toEqual([
  "genteCrystalSales/DELIKOR PALMARES/sales/42148-2204-59468315",
  `genteCrystalIntegrationDevices/${tokenHash}`,
  "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
]);
expect(dailyWrite.options).toEqual({ merge: true });
expect(dailyWrite.data.sales["42148-2204-59468315"]).toMatchObject({
  sorteo: "LOTERIA",
  captureOrigin: "local_button",
  monto: 2000,
  status: "active",
});
```

Add cases verifying same-day replacement, old-day removal plus new-day upsert,
deletion via `FieldValue.delete()`, delete-before-create without a daily write,
and `already_exists` with zero writes.

- [ ] **Step 2: Run tests and confirm missing daily writes**

Run: `npx vitest run tests/gente-crystal/firestore-sales.test.ts`

Expected: FAIL because `sync()` currently writes only the individual sale and
device record.

- [ ] **Step 3: Apply the daily mutation inside the existing transaction**

Import `FieldValue` and the Task 1 planner. After `mergeGenteCrystalSale`, build
the mutation from `existingSale` and `merged.record`. Keep the existing two
writes, then apply targeted merge writes:

```ts
if (dailyMutation.remove) {
  transaction.set(
    this.firestore.doc(
      `genteCrystalSales/${companyId}/daily/${dailyMutation.remove.date}`,
    ),
    {
      sales: {
        [dailyMutation.remove.ticketId]: FieldValue.delete(),
      },
    },
    { merge: true },
  );
}

if (dailyMutation.upsert) {
  transaction.set(
    this.firestore.doc(
      `genteCrystalSales/${companyId}/daily/${dailyMutation.upsert.date}`,
    ),
    {
      sales: {
        [dailyMutation.upsert.ticketId]: dailyMutation.upsert.entry,
      },
    },
    { merge: true },
  );
}
```

Do not plan or write daily mutations when `merged.record` is absent.

- [ ] **Step 4: Run model and repository tests**

Run: `npx vitest run tests/gente-crystal/daily-sales.test.ts tests/gente-crystal/firestore-sales.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit dual writes**

```bash
git add src/lib/gente-crystal/firestore-sales.ts tests/gente-crystal/firestore-sales.test.ts
git commit -m "Write Gente Crystal daily consolidations"
```

### Task 3: One-Document Daily Reader and Safe Cutover

**Files:**
- Modify: `src/lib/gente-crystal/firestore-sales-reader.ts`
- Modify: `src/app/api/integrations/gente-crystal/sales/route.ts`
- Create: `tests/gente-crystal/firestore-sales-reader.test.ts`

**Interfaces:**
- Consumes: `buildGenteCrystalDailyResultFromDocument(data)` from Task 1.
- Produces: `FirestoreGenteCrystalDailySalesReader`, `FirestoreGenteCrystalSalesQueryReader`, and `shouldUseGenteCrystalDailyReads(env)`.

- [ ] **Step 1: Write failing direct-reader and flag tests**

Use a fake Firestore document snapshot to assert that `listDaily(companyId,
range)` reads exactly:

```text
genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23
```

Assert a populated map becomes the unchanged `GenteCrystalDailyResult`, a
missing document returns zero totals and an empty list, and no collection query
method is called. Assert the cutover helper is true only for exact string
`"true"`.

- [ ] **Step 2: Run the reader tests and confirm failure**

Run: `npx vitest run tests/gente-crystal/firestore-sales-reader.test.ts`

Expected: FAIL because only the range-query reader exists.

- [ ] **Step 3: Add the daily reader while retaining the migration reader**

Rename the current implementation to
`FirestoreGenteCrystalSalesQueryReader`. Add:

```ts
export class FirestoreGenteCrystalDailySalesReader
  implements GenteCrystalSalesReader {
  constructor(readonly firestore: Firestore) {}

  async listDaily(companyId: string, range: GenteCrystalDayRange) {
    const normalizedCompanyId = readCompanyDocumentId(companyId);
    const snapshot = await this.firestore
      .collection("genteCrystalSales")
      .doc(normalizedCompanyId)
      .collection("daily")
      .doc(range.date)
      .get();
    return buildGenteCrystalDailyResultFromDocument(
      snapshot.exists ? snapshot.data() : undefined,
    );
  }
}
```

Export `shouldUseGenteCrystalDailyReads(env)` and choose the daily reader only
when `GENTE_CRYSTAL_DAILY_READS_ENABLED=true`; otherwise use the retained query
reader. This lets writer deployment and live backfill happen before cutover.

- [ ] **Step 4: Run focused and full tests**

Run: `npx vitest run tests/gente-crystal`

Expected: PASS with the public GET result unchanged.

- [ ] **Step 5: Commit the reader and cutover flag**

```bash
git add src/lib/gente-crystal/firestore-sales-reader.ts src/app/api/integrations/gente-crystal/sales/route.ts tests/gente-crystal/firestore-sales-reader.test.ts
git commit -m "Read Gente Crystal daily consolidations"
```

### Task 4: Explicit Transactional Backfill

**Files:**
- Create: `scripts/backfill-gente-crystal-daily.mjs`
- Modify: `package.json`
- Create: `tests/gente-crystal/backfill-gente-crystal-daily.test.ts`

**Interfaces:**
- Consumes: live individual sales under a required `--company` document ID.
- Produces: `npm run backfill:gente-crystal-daily -- --company "<id>" --apply` and `--verify-only` operator modes.

- [ ] **Step 1: Write failing script-helper tests**

Import the ESM script under Vitest and test exported `parseBackfillArgs`,
`costaRicaDateKey`, `buildBackfillMutation`, and `compareDailyTotals`. Require a
company ID, reject slashes, reject simultaneous `--apply`/`--verify-only`,
project the exact minimal active entry, and plan deletion only when a tombstone
retains a valid `saleAt`.

- [ ] **Step 2: Run the helper tests and confirm the missing script failure**

Run: `npx vitest run tests/gente-crystal/backfill-gente-crystal-daily.test.ts`

Expected: FAIL because the migration script does not exist.

- [ ] **Step 3: Implement guarded live migration**

The script must not initialize Firebase until argument validation succeeds. It
loads Next environment configuration, selects `FIRESTORE_DATABASE_ID` (or
`restauracion` in production), enumerates the required company's individual
sales, and re-reads each document in a Firestore transaction before a merge
write:

```js
await firestore.runTransaction(async (transaction) => {
  const current = await transaction.get(saleRef);
  if (!current.exists) return;
  const mutation = buildBackfillMutation(companyId, current.id, current.data());
  if (!mutation) return;
  transaction.set(
    firestore.doc(mutation.dailyPath),
    mutation.data,
    { merge: true },
  );
});
```

Active records set the minimal map entry. Deleted records with a date use
`FieldValue.delete()`. After `--apply`, re-read individual and daily records,
compare active counts and monetary totals by Costa Rica date, print structured
JSON, and exit nonzero on mismatch. `--verify-only` performs only the comparison.

Add to `package.json`:

```json
"backfill:gente-crystal-daily": "node scripts/backfill-gente-crystal-daily.mjs"
```

- [ ] **Step 4: Run all Gente Crystal tests**

Run: `npx vitest run tests/gente-crystal`

Expected: PASS without connecting to Firebase because the script's main guard
does not execute during import.

- [ ] **Step 5: Commit the guarded backfill**

```bash
git add scripts/backfill-gente-crystal-daily.mjs package.json tests/gente-crystal/backfill-gente-crystal-daily.test.ts
git commit -m "Add Gente Crystal daily backfill"
```

### Task 5: Integration Verification and Operational Handoff

**Files:**
- Modify only files required to fix failures attributable to Tasks 1-4.

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: verified build plus exact migration and cutover commands.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run static checks**

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `npx eslint src/lib/gente-crystal src/app/api/integrations/gente-crystal/sales scripts/backfill-gente-crystal-daily.mjs tests/gente-crystal`

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js build exits successfully.

- [ ] **Step 4: Review the final diff and confirm production was untouched**

Run: `git diff --check 2f167e32..HEAD`

Expected: no whitespace errors. Confirm no command invoked the backfill script
with `--apply` and no environment file containing credentials was changed.

- [ ] **Step 5: Provide the operator sequence without executing it**

After deploying dual writes with daily reads disabled:

```bash
npm run backfill:gente-crystal-daily -- --company "DELIKOR PALMARES" --apply
npm run backfill:gente-crystal-daily -- --company "DELIKOR PALMARES" --verify-only
```

Only after both report matching counts/totals, set
`GENTE_CRYSTAL_DAILY_READS_ENABLED=true` and redeploy. Report that this final
environment change is required for the read count to fall from about 91 to
about 7.
