# Fondo Ledger Sync and Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fondo General ledger mutations authoritative and transactional, synchronize confirmed balances across devices with bounded reads, and block daily closings when the ledger disagrees with the movement chain.

**Architecture:** Pure ledger-state functions calculate movement deltas from a Firestore-provided snapshot. `MovimientosFondosService` owns transaction and listener primitives; the Fondo hooks apply confirmed revisions to UI/cache and selectively fetch a changed movement. Closing integrity is checked from a fresh ledger plus the movement range since the applicable opening before any closing record is saved. The obsolete UI-to-ledger autosave is removed because this screen has no user-editable ledger settings.

**Tech Stack:** Next.js 16, React 19, TypeScript, Firebase Web SDK 11 (`runTransaction`, `onSnapshot`), Vitest 4, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-23-fondo-ledger-sync-transactions-design.md`

## Global Constraints

- Do not modify or repair production data as part of this implementation.
- Do not listen to the entire movements subcollection in real time.
- `amountPayment` is the effective cash debit whenever a positive `amountEgreso` has an `amountPayment` field; otherwise use `amountEgreso`.
- Existing ledger documents without `revision` or `lastChange` must continue to load and behave as revision zero.
- Firestore writes that affect a balance must derive from the ledger read inside the active transaction, never from `storageSnapshotRef.current`.
- A remote snapshot applied to React state must not trigger an automatic settings write back to Firestore.
- No deployment or historical correction is included; the existing version/maintenance mechanism is handled after code verification.

## Review Focus

- A legacy ledger without revision metadata must accept its first mutation as revision 1; Task 1 pins this behavior.
- An edit that changes currency must remove the old currency impact and add the new currency impact without losing either balance; Task 1 pins this behavior.
- A transaction whose target movement is missing must abort before changing the ledger; Task 2 pins this behavior.
- A listener reconnecting after multiple missed revisions must perform one bounded range refresh rather than one read per missed movement; Task 4 pins this behavior.
- Closing integrity must query from the opening and must not trust the currently filtered UI list; Task 5 pins this behavior.

---

### Task 1: Pure authoritative ledger state calculations

**Files:**
- Create: `src/app/fondogeneral/utils/fondo/ledgerState.ts`
- Modify: `src/services/movimientos-fondos.ts:100-125`
- Test: `tests/fondogeneral/ledgerState.test.ts`

**Interfaces:**
- Consumes: `MovementStorage<FondoEntry>`, `resolveEffectiveEgresoAmount`, `APERTURA_FONDO_PROVIDER_CODE`.
- Produces:
  - `LedgerLastChange` and `LedgerMovementChange` in `src/services/movimientos-fondos.ts`.
  - `applyLedgerMovementMutation(input): LedgerStateMutationResult`.
  - `extractLedgerSnapshot(storage, accountKey): LedgerBalanceSnapshot`.

- [ ] **Step 1: Write failing movement-state tests**

Create `tests/fondogeneral/ledgerState.test.ts` with fixtures that prove stale UI state is irrelevant, legacy revision starts at one, effective payments are used, edits use before/after deltas, deletes reverse the stored movement, currency changes update both balances, and openings set counted balances:

```ts
import { describe, expect, it } from "vitest";
import {
  applyLedgerMovementMutation,
  extractLedgerSnapshot,
} from "@/app/fondogeneral/utils/fondo/ledgerState";
import type { FondoEntry } from "@/app/fondogeneral/types";
import { MovimientosFondosService } from "@/services/movimientos-fondos";

const storage = (crc = 138_000) => {
  const value = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
    "DELIKOR SINAI",
  );
  const balance = value.state.balancesByAccount.find(
    (item) => item.accountId === "FondoGeneral" && item.currency === "CRC",
  )!;
  balance.currentBalance = crc;
  return value;
};

describe("applyLedgerMovementMutation", () => {
  it("uses the authoritative storage balance and initializes a legacy revision", () => {
    const result = applyLedgerMovementMutation({
      storage: storage(138_000),
      operation: "create",
      after: {
        id: "sale-1",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 5_000,
        amountEgreso: 0,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
      clientMutationId: "client-a-1",
    });

    expect(extractLedgerSnapshot(result.storage, "FondoGeneral").currentCRC)
      .toBe(143_000);
    expect(result.storage.state.revision).toBe(1);
    expect(result.storage.state.lastChange).toMatchObject({
      kind: "movement",
      revision: 1,
      movementId: "sale-1",
      operation: "create",
    });
  });

  it("uses amountPayment as the effective debit", () => {
    const result = applyLedgerMovementMutation({
      storage: storage(),
      operation: "create",
      after: {
        id: "expense-1",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 0,
        amountEgreso: 10,
        amountPayment: 0,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
    });

    expect(extractLedgerSnapshot(result.storage, "FondoGeneral").currentCRC)
      .toBe(138_000);
  });

  it("reverses the server before value and applies an edited currency", () => {
    const value = storage();
    const usd = value.state.balancesByAccount.find(
      (item) => item.accountId === "FondoGeneral" && item.currency === "USD",
    )!;
    usd.currentBalance = 20;

    const result = applyLedgerMovementMutation({
      storage: value,
      operation: "edit",
      before: {
        id: "expense-1",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 0,
        amountEgreso: 5_000,
        amountPayment: 5_000,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      after: {
        id: "expense-1",
        accountId: "FondoGeneral",
        currency: "USD",
        amountIngreso: 0,
        amountEgreso: 10,
        amountPayment: 10,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:01:00.000Z",
    });

    const snapshot = extractLedgerSnapshot(result.storage, "FondoGeneral");
    expect(snapshot.currentCRC).toBe(143_000);
    expect(snapshot.currentUSD).toBe(10);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerState.test.ts --reporter=verbose
```

Expected: FAIL because `ledgerState.ts` and the revision types do not exist.

- [ ] **Step 3: Add revision metadata types**

Extend `MovementStorageState` in `src/services/movimientos-fondos.ts`:

```ts
export type LedgerMovementChange = {
  kind: "movement";
  revision: number;
  movementId: string;
  operation: "create" | "edit" | "delete";
  accountId: MovementAccountKey;
  currency: MovementCurrencyKey;
  updatedAt: string;
  clientMutationId?: string;
};

export type LedgerLastChange = LedgerMovementChange;

export type MovementStorageState = {
  balancesByAccount: MovementAccountBalance[];
  updatedAt: string;
  lockedUntil?: string;
  revision?: number;
  lastChange?: LedgerLastChange;
};
```

Update `sanitizeState` so finite non-negative revisions and valid last-change objects survive hydration; invalid legacy metadata is ignored rather than zeroing balances.

- [ ] **Step 4: Implement the pure ledger helpers**

Create `ledgerState.ts`. Clone the storage before modification, normalize money to two decimals, subtract `before` and add `after` for ordinary movements, and handle opening create/edit/delete using the persisted opening fields. Increment `state.revision` from `Math.max(0, Math.trunc(state.revision ?? 0))` and set the discriminated `lastChange` union.

Reject create without `after`, edit without both `before` and `after`, and
delete without `before` before changing the cloned ledger.

The exported signatures must be:

```ts
export type LedgerBalanceSnapshot = {
  initialCRC: number;
  currentCRC: number;
  initialUSD: number;
  currentUSD: number;
};

export type LedgerMovementValue = Partial<FondoEntry> &
  Pick<FondoEntry, "id" | "createdAt">;

export type LedgerMovementMutationInput = {
  storage: MovementStorage<FondoEntry>;
  operation: "create" | "edit" | "delete";
  before?: LedgerMovementValue | null;
  after?: LedgerMovementValue | null;
  nowISO: string;
  clientMutationId?: string;
};

export type LedgerStateMutationResult = {
  storage: MovementStorage<FondoEntry>;
  ledgerSnapshot: LedgerBalanceSnapshot;
};
```

Return the active account snapshot and never mutate the input object.

- [ ] **Step 5: Add delete, opening, and immutability tests**

Append tests verifying that invalid revision metadata is discarded without changing balances, invalid missing before/after operands throw without mutating input, the input storage is unchanged, active-account `initialBalance`/`enabled` settings and unrelated account balances are preserved, deleting a CRC 5,000 expense adds CRC 5,000, editing an opening applies the difference between persisted before/after values, deleting an opening restores its persisted `openingPreviousBalanceCRC/USD`, and creating an opening with CRC 138,000 sets the current balance to CRC 138,000 without treating it as income.

- [ ] **Step 6: Run the focused tests**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerState.test.ts --reporter=verbose
```

Expected: all ledger-state tests PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/services/movimientos-fondos.ts src/app/fondogeneral/utils/fondo/ledgerState.ts tests/fondogeneral/ledgerState.test.ts
git commit -m "Add authoritative Fondo ledger state calculations"
```

### Task 2: Firestore transaction primitive and persistence integration

**Files:**
- Modify: `src/services/movimientos-fondos.ts:1-20, 896-961`
- Modify: `src/app/fondogeneral/utils/fondo/persistence.ts:1-492`
- Modify: `src/app/fondogeneral/utils/fondo/mutations.ts:24-46`
- Modify: `src/app/fondogeneral/utils/movementDeletion.ts:1-55`
- Modify: `src/app/fondogeneral/components/layout/FondoSection.tsx:120-130, 1995-2010`
- Test: `tests/fondogeneral/ledgerPersistenceTransaction.test.ts`

**Interfaces:**
- Consumes: Task 1 `applyLedgerMovementMutation` and `LedgerBalanceSnapshot`.
- Produces:
  - `MovimientosFondosService.commitLedgerTransaction(request)`.
  - `LedgerAtomicWriter = Pick<Transaction, "set" | "update" | "delete">`.
  - Existing `persistMovementToFirestore(...)` signature remains compatible with all current callers.

- [ ] **Step 1: Write a failing transaction-service test**

Mock `firebase/firestore` before importing the service. Make `runTransaction` provide a ledger snapshot containing CRC 138,000 even though the caller fixture represents CRC 103,000. The mock exports every Firestore name imported by the service (`collection`, `deleteDoc`, `doc`, `getDocs`, `getCountFromServer`, `limit`, `orderBy`, `query`, `runTransaction`, `serverTimestamp`, `setDoc`, `startAfter`, `where`, `writeBatch`) and returns inert spies for the APIs outside this test. Assert the committed ledger becomes CRC 143,000 and the movement is written in the same transaction:

```ts
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts) => parts.join("/")),
  deleteDoc: vi.fn(),
  doc: vi.fn((...parts) => parts.join("/")),
  getDocs: vi.fn(),
  getCountFromServer: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  setDoc: vi.fn(),
  startAfter: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

expect(transactionSet).toHaveBeenCalledWith(
  expect.stringContaining("MovimientosFondos/movements_DELIKOR SINAI"),
  expect.objectContaining({
    state: expect.objectContaining({ revision: 1 }),
  }),
);
expect(transactionSet).toHaveBeenCalledWith(
  expect.stringContaining("movements/sale-1"),
  expect.objectContaining({ amountIngreso: 5_000 }),
);
```

- [ ] **Step 2: Run the test and confirm the missing transaction API**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerPersistenceTransaction.test.ts --reporter=verbose
```

Expected: FAIL because `commitLedgerTransaction` is undefined.

- [ ] **Step 3: Implement the service transaction primitive**

Import `runTransaction`, `Transaction`, `DocumentReference`, and `DocumentSnapshot`. Add:

```ts
export type LedgerTransactionRequest<
  TMovement extends Partial<MovementRecordBase>,
  TStorage,
> = {
  docId: string;
  company: string;
  operation: "create" | "edit" | "delete";
  movementId: string;
  accountId: MovementAccountKey;
  after?: TMovement & { id: string };
  mutateLedger: (context: {
    ledger: MovementStorage<TStorage>;
    before: (TMovement & { id: string }) | null;
  }) => {
    ledger: MovementStorage<TStorage>;
    storedMovement?: TMovement & { id: string };
  };
  extraWrites?: (
    writer: LedgerAtomicWriter,
    context: { before: (TMovement & { id: string }) | null },
  ) => void;
};

export type LedgerTransactionResult<
  TMovement extends Partial<MovementRecordBase>,
  TStorage,
> = {
  ledger: MovementStorage<TStorage>;
  before: (TMovement & { id: string }) | null;
};
```

`commitLedgerTransaction` must read the ledger first, create an empty shaped
ledger with `company` only when the document does not exist, and, for
edit/delete, read the movement before issuing any write. Throw
`MOVEMENT_NOT_FOUND` if the target is absent. Call `mutateLedger`, strip `id`
from stored movement data, add `serverCreatedAt`, then transactionally
set/delete the movement and set the ledger. Return
`Promise<LedgerTransactionResult<TMovement, TStorage>>`.

After migrating the sole caller, delete `commitLedgerAndMovement`; leaving the
blind batch API public would allow the stale-overwrite bug to return. Keep
`writeBatch` imports used by the separate bulk migration helpers.

Replace the Fondo-local `WriteBatch` callback types in `persistence.ts`,
`mutations.ts`, `movementDeletion.ts`, and `FondoSection.tsx` with
`LedgerAtomicWriter`. Existing callbacks only use `set`, `update`, and `delete`,
so their behavior remains the same while the writes move inside the transaction.

- [ ] **Step 4: Replace the stale-snapshot balance calculation in persistence**

In `persistMovementToFirestore`, retain company validation and cache updates, but replace lines that derive `prevCurrent*` from `baseStorage` with:

```ts
const nowISO = await getAuthoritativeNowISO();
const clientMutationId = crypto.randomUUID();
deps.registerLocalMutation?.(clientMutationId);
const movementId = change?.upsert?.id ?? change?.deleteId ?? "";
if (!movementId) throw new Error("MOVEMENT_ID_REQUIRED");
let committedSnapshot: LedgerBalanceSnapshot | null = null;

const committed = await MovimientosFondosService.commitLedgerTransaction<
  FondoEntry,
  FondoEntry
>({
  docId: companyKey,
  company: normalizedCompany,
  operation: operationType,
  movementId,
  accountId: accountKey,
  after: change?.upsert,
  mutateLedger: ({ ledger, before }) => {
    const result = applyLedgerMovementMutation({
      storage: MovimientosFondosService.ensureMovementStorageShape(
        ledger,
        normalizedCompany,
      ),
      operation: operationType,
      before,
      after: change?.upsert,
      nowISO,
      clientMutationId,
    });
    committedSnapshot = result.ledgerSnapshot;
    return {
      ledger: result.storage,
      storedMovement: change?.upsert,
    };
  },
  extraWrites: (writer, { before }) => {
    extraWrites?.(writer);
    if (operationType === "delete" && before && shouldDeleteFacturasMirror(before)) {
      const deletedId = before.id;
      writer.delete(FacturasService.buildMovementRef(normalizedCompany, deletedId));
      writer.delete(FacturasService.buildMovementRef(normalizedCompany, `${deletedId}-NC`));
      const manualCreditNotes = Array.isArray(before.appliedCreditNotes)
        ? before.appliedCreditNotes.filter((note) =>
            String(note?.id || "").startsWith(`manual-nc-${deletedId}-`),
          )
        : [];
      manualCreditNotes.forEach((_, index) => {
        writer.delete(FacturasService.buildMovementRef(
          normalizedCompany,
          `${deletedId}-NC-${index + 1}`,
        ));
      });
    }
  },
});
```

Use the transaction callback's authoritative `before` for edit/delete effects,
including the decision and IDs for Facturas/NC mirror deletion; do not use
`change.before` for any server-side write decision. Remove `initialAmount`,
`initialAmountUSD`, and `ledgerSnapshot` from arithmetic; they may remain
temporarily in the dependency type only while callers are migrated. Invoke
`deps.registerLocalMutation(clientMutationId)` immediately after generating the
ID and before starting the transaction, so a fast confirmed listener echo
cannot race the registration. Set `storageSnapshotRef.current` from the
committed ledger and return `confirmed: true` only after the transaction
resolves.

Remove the `waitForPendingWrites` timeout path: `runTransaction` itself requires
a server-confirmed commit and rejects while offline, so a second global pending
write wait is both redundant and able to be delayed by unrelated writes.

Extend the persistence result with `revision` and `clientMutationId` so the
realtime hook can recognize its own confirmed echo:

```ts
return {
  ok: true,
  confirmed: true,
  ledgerSnapshot: committedSnapshot,
  revision: committed.ledger.state.revision ?? 0,
  clientMutationId,
};
```

Add `registerLocalMutation?: (clientMutationId: string) => void` to
`PersistMovementDeps`; Task 4 supplies it from the realtime hook.

- [ ] **Step 5: Add missing-movement and concurrent-retry tests**

Add a test where edit/delete receives a missing server movement and assert no `transaction.set` or `transaction.delete` occurs. Add a retry harness where `runTransaction` invokes the callback first with CRC 103,000 and then with CRC 138,000; assert the result from the successful attempt is CRC 143,000 rather than CRC 108,000. Add two create commits whose second transaction reads the first committed ledger and assert both deltas survive in the final balance and revision advances twice. Add a delete whose caller-provided `before` is stale but the server movement requires Facturas mirrors; assert the mirror deletions follow the server movement.

- [ ] **Step 6: Run transaction and existing accounting tests**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerPersistenceTransaction.test.ts tests/fondogeneral/ledgerState.test.ts tests/fondogeneral/incomeRounding.test.tsx --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/services/movimientos-fondos.ts src/app/fondogeneral/utils/fondo/persistence.ts src/app/fondogeneral/utils/fondo/mutations.ts src/app/fondogeneral/utils/movementDeletion.ts src/app/fondogeneral/components/layout/FondoSection.tsx tests/fondogeneral/ledgerPersistenceTransaction.test.ts
git commit -m "Persist Fondo ledger mutations transactionally"
```

### Task 3: Remove remaining blind full-ledger writes

**Files:**
- Modify: `src/services/movimientos-fondos.ts`
- Modify: `src/app/fondogeneral/components/layout/FondoSection.tsx:3241-3425`
- Modify: `src/app/fondogeneral/utils/closing/dailyClosing.ts:1048-1070`
- Modify: `src/app/fondogeneral/utils/fondo/mutations.ts:175-215`
- Test: `tests/fondogeneral/noBlindLedgerAutosave.test.ts`
- Test: `tests/fondogeneral/ledgerMaintenanceWrites.test.ts`

**Interfaces:**
- Consumes: the existing hydration setters for `initialAmount`, `initialAmountUSD`, and `currencyEnabled`.
- Produces:
  - no persistence API for hydrated settings;
  - `MovimientosFondosService.updateLedgerLockTransaction(input)`;
  - `MovimientosFondosService.clearLegacyMovements(docId)`.

- [ ] **Step 1: Write a failing structural regression test**

The current blind effect is embedded in a large component and has no user event boundary. Pin its removal directly so it cannot silently return:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Fondo ledger persistence boundaries", () => {
  it.each([
    "../../src/app/fondogeneral/components/layout/FondoSection.tsx",
    "../../src/app/fondogeneral/utils/closing/dailyClosing.ts",
    "../../src/app/fondogeneral/utils/fondo/mutations.ts",
  ])("does not save a full ledger from UI state in %s", (relativePath) => {
    const source = readFileSync(
      fileURLToPath(new URL(relativePath, import.meta.url)),
      "utf8",
    );
    expect(source).not.toContain("MovimientosFondosService.saveDocument(");
  });
});
```

- [ ] **Step 2: Run the test and confirm it detects the current effect**

Run:

```bash
npx vitest run tests/fondogeneral/noBlindLedgerAutosave.test.ts --reporter=verbose
```

Expected: FAIL because all three files currently call `saveDocument` with a
full ledger assembled from local state.

- [ ] **Step 3: Delete the blind persistence effect**

Remove the `FondoSection` effect that copies `initialAmount`, `initialAmountUSD`, and
`currencyEnabled` into `storageSnapshotRef.current` and calls
`MovimientosFondosService.saveDocument`.

Do not replace the effect with a transaction: repository search confirms this
screen has no user-editable controls for those ledger settings. They are only
hydrated from authoritative storage or reset when company/account context
changes.

- [ ] **Step 4: Add safe maintenance-write service methods**

Write `ledgerMaintenanceWrites.test.ts` with a `runTransaction` harness whose
authoritative ledger is CRC 138,000 while the caller's cache is CRC 103,000.
Assert `updateLedgerLockTransaction` returns and writes CRC 138,000 while
changing only `lockedUntil` and `updatedAt`. Test `lockedUntil: null` removes the
field. Mock `updateDoc` and assert `clearLegacyMovements` writes exactly:

```ts
expect(updateDoc).toHaveBeenCalledWith(
  ledgerRef,
  { "operations.movements": [] },
);
```

Implement these signatures:

```ts
static async updateLedgerLockTransaction<TMovement>(input: {
  docId: string;
  company: string;
  lockedUntil: string | null;
  nowISO: string;
}): Promise<MovementStorage<TMovement>>;

static async clearLegacyMovements(docId: string): Promise<void>;
```

The lock transaction reads and normalizes the ledger inside `runTransaction`,
changes only `state.lockedUntil` and `state.updatedAt`, preserves revision and
lastChange, and then writes that fresh copy. `clearLegacyMovements` uses
Firestore `updateDoc` with the single dotted field above.

- [ ] **Step 5: Replace the three remaining full-ledger writes**

In the one-time migration inside `FondoSection`, replace the cleaned-storage
construction and `saveDocument` call with `clearLegacyMovements(docKey)`. In `dailyClosing.ts`,
await `updateLedgerLockTransaction` after a newly created close and replace the
local snapshot/cache from its return value. In `mutations.ts`, use the same
method after deleting the latest close, passing the previous close timestamp
or `null`.

- [ ] **Step 6: Run the regression tests and typecheck**

Run:

```bash
npx vitest run tests/fondogeneral/noBlindLedgerAutosave.test.ts tests/fondogeneral/ledgerMaintenanceWrites.test.ts --reporter=verbose
npx tsc --noEmit
```

Expected: test and typecheck PASS; removing the effect leaves no unused imports
or stale callback dependencies; maintenance tests preserve the authoritative
balance.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/services/movimientos-fondos.ts src/app/fondogeneral/components/layout/FondoSection.tsx src/app/fondogeneral/utils/closing/dailyClosing.ts src/app/fondogeneral/utils/fondo/mutations.ts tests/fondogeneral/noBlindLedgerAutosave.test.ts tests/fondogeneral/ledgerMaintenanceWrites.test.ts
git commit -m "Remove blind Fondo ledger writes"
```

### Task 4: Realtime ledger listener with bounded movement synchronization

**Files:**
- Modify: `src/services/movimientos-fondos.ts`
- Modify: `src/app/fondogeneral/hooks/fondo/useV2MovementsHydration.ts`
- Modify: `src/app/fondogeneral/components/layout/FondoSection.tsx:1110-1150, 1996-2031`
- Create: `src/app/fondogeneral/hooks/fondo/ledgerRevisionSync.ts`
- Test: `tests/fondogeneral/ledgerRevisionSync.test.ts`
- Test: `tests/fondogeneral/ledgerSubscriptionService.test.ts`
- Test: `tests/fondogeneral/ledgerRealtimeHydration.test.tsx`

**Interfaces:**
- Consumes: `MovementStorageState.revision`, discriminated `lastChange`, existing `ensureV2MovementsLoaded` and cache refs.
- Produces:
  - `MovimientosFondosService.subscribeToLedger(docId, onNext, onError): () => void`.
  - `MovimientosFondosService.getMovementById(docId, movementId, accountId)`.
  - `decideLedgerRevisionSync(input): LedgerRevisionAction`.
  - `movementMatchesActiveQuery(entry, query): boolean`.
  - Hook state `ledgerSyncStatus: "connecting" | "synced" | "offline" | "error"`.
  - Hook callback `registerLocalMutation(clientMutationId: string): void`.

- [ ] **Step 1: Write failing pure revision-decision tests**

Test the exact action matrix:

```ts
expect(decideLedgerRevisionSync({
  previousRevision: 4,
  nextRevision: 5,
  activeAccountId: "FondoGeneral",
  lastChange: {
    kind: "movement",
    revision: 5,
    movementId: "m5",
    operation: "create",
    accountId: "FondoGeneral",
    currency: "CRC",
    updatedAt: "2026-09-23T00:00:00.000Z",
  },
  locallyAppliedMutationIds: new Set(),
})).toEqual({ type: "fetch-one", movementId: "m5" });

expect(decideLedgerRevisionSync({
  previousRevision: 2,
  nextRevision: 5,
  activeAccountId: "FondoGeneral",
  lastChange: null,
  locallyAppliedMutationIds: new Set(),
})).toEqual({ type: "refresh-range" });
```

Also test delete returns `remove-one`, another account returns `ledger-only`, the same/lower revision returns `ignore`, a consecutive local mutation ID returns `ledger-only`, a revision gap still returns `refresh-range` even when the latest ID is local, and legacy zero-to-zero initial hydration does not refresh. Pin `movementMatchesActiveQuery` for both date boundaries and the optional provider, payment-type, and invoice filters.

- [ ] **Step 2: Run the revision test and confirm failure**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerRevisionSync.test.ts --reporter=verbose
```

Expected: FAIL because `ledgerRevisionSync.ts` is missing.

- [ ] **Step 3: Implement the pure revision action reducer**

Create the discriminated result:

```ts
export type LedgerRevisionAction =
  | { type: "ignore" }
  | { type: "ledger-only" }
  | { type: "fetch-one"; movementId: string }
  | { type: "remove-one"; movementId: string }
  | { type: "refresh-range" };
```

Return `refresh-range` only when `nextRevision > previousRevision + 1`; this guarantees one bounded reload for a reconnect gap.

- [ ] **Step 4: Write failing subscription and hydration lifecycle tests**

First write `ledgerSubscriptionService.test.ts` with a mocked `onSnapshot`.
Capture its callbacks, emit a document snapshot, and assert the service returns
normalized storage plus exact `hasPendingWrites`/`fromCache` metadata; assert
the returned unsubscribe function and error callback are forwarded.

Then mock `subscribeToLedger`, capture its callback, and use `renderHook` to verify:

- subscription occurs only while `document.visibilityState === "visible"`;
- hiding unsubscribes;
- showing resubscribes;
- `offline` unsubscribes and sets `ledgerSyncStatus` to `offline`;
- `online` resubscribes with `connecting`, while listener errors online set `error`;
- confirmed remote state updates `storageSnapshotRef.current` and `ledgerSnapshot`;
- `fetch-one` reads one movement and upserts it in cache;
- a revision gap calls `ensureV2MovementsLoaded(docKey, { forceRefresh: true })` exactly once;
- a `fetch-one` whose server document is already missing performs one forced
  active-range refresh;
- snapshots with `hasPendingWrites` or `fromCache` do not update confirmed state
  or mark the hook as synced.

- [ ] **Step 5: Implement service listener and single-document server read**

Add `onSnapshot` and `getDocFromServer` imports. `subscribeToLedger` must normalize the document with `ensureMovementStorageShape`, pass `{ storage, hasPendingWrites, fromCache }`, and return Firestore's unsubscribe function. `getMovementById` must use `getDocFromServer` with `buildMovementRef`, return `null` for a missing document, and normalize the `id` plus account/currency envelope. If that server read fails, keep the confirmed ledger balance, set sync status to `error`, and leave the movement cache unchanged until retry/refresh.

- [ ] **Step 6: Wire realtime synchronization into useV2MovementsHydration**

Track the last applied revision by ledger document key, a bounded insertion-ordered set of at most 100 local mutation IDs, document visibility, and browser online state. Subscribe only when visible and online. Set `connecting` before subscribing, `synced` only after a snapshot where both `hasPendingWrites` and `fromCache` are false, `offline` on the browser `offline` event, and `error` only for listener failures while online; clean up `visibilitychange`, `online`, `offline`, and Firestore listeners on unmount or context change.

Expose `registerLocalMutation`; `FondoSection` passes it through the dependencies of every `persistMovementToFirestore` call. When a listener observes one of those IDs, remove it from the set after returning `ledger-only`.

Apply ledger state first, then run the revision action. For `fetch-one`, resolve the same active query used by `ensureV2MovementsLoaded`; upsert the returned movement only when it matches the active date and optional provider/payment/invoice filters, otherwise remove that ID from the active cache (an edit may have moved it out of view). If the referenced movement is already missing, force-refresh the active range once. For delete, remove by ID; for a gap, invalidate/reload the active range once. Protect asynchronous fetches with the ledger document key captured when the action started, so a company/account switch cannot write stale results into the new context.

Do not subscribe to `movements`. Do not call `ensureV2MovementsLoaded` for changes belonging to another account.

- [ ] **Step 7: Run listener tests**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerRevisionSync.test.ts tests/fondogeneral/ledgerSubscriptionService.test.ts tests/fondogeneral/ledgerRealtimeHydration.test.tsx --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/services/movimientos-fondos.ts src/app/fondogeneral/hooks/fondo/useV2MovementsHydration.ts src/app/fondogeneral/hooks/fondo/ledgerRevisionSync.ts src/app/fondogeneral/components/layout/FondoSection.tsx tests/fondogeneral/ledgerRevisionSync.test.ts tests/fondogeneral/ledgerSubscriptionService.test.ts tests/fondogeneral/ledgerRealtimeHydration.test.tsx
git commit -m "Synchronize Fondo ledger revisions across devices"
```

### Task 5: Authoritative closing-integrity guard

**Files:**
- Create: `src/app/fondogeneral/utils/closing/ledgerIntegrity.ts`
- Modify: `src/app/fondogeneral/utils/closing/dailyClosing.ts:111-200`
- Modify: `src/services/movimientos-fondos.ts:1021-1100`
- Modify: `src/services/daily-closings.ts:616-730`
- Test: `tests/fondogeneral/ledgerIntegrity.test.ts`
- Test: `tests/fondogeneral/dailyClosingIntegrityGuard.test.ts`
- Test: `tests/services/dailyClosingLedgerPrecondition.test.ts`

**Interfaces:**
- Consumes: new server-only ledger/range reads and `resolveEffectiveEgresoAmount`.
- Produces:
  - `MovimientosFondosService.getDocumentFromServer(docId)`.
  - `calculateLedgerIntegrity(input): LedgerIntegrityCalculation`.
  - `loadLedgerIntegrity(input): Promise<LedgerIntegrityResult>`.
  - `buildOperationalStartISO(operationalDateKey, horarioApertura): string`.
  - `formatLedgerIntegrityMismatch(result: LedgerIntegrityCalculation): string`.
  - exported `LEDGER_CHANGED_BEFORE_CLOSING` error code in `daily-closings.ts`.
  - A discriminated integrity result with per-currency drift.

- [ ] **Step 1: Write failing integrity calculation tests**

Use the verified incident sequence:

```ts
const result = calculateLedgerIntegrity({
  ledgerCRC: 138_000,
  ledgerUSD: 0,
  opening: {
    id: "opening",
    createdAt: "2026-09-22T22:03:49.580Z",
    openingBalanceCRC: 138_000,
    openingBalanceUSD: 0,
  },
  movements: [
    { id: "zero-in", createdAt: "2026-09-22T22:20:26.972Z", amountIngreso: 0, amountEgreso: 0, currency: "CRC" },
    { id: "zero-out", createdAt: "2026-09-22T22:20:42.587Z", amountIngreso: 0, amountEgreso: 10, amountPayment: 0, currency: "CRC" },
    { id: "purchase", createdAt: "2026-09-22T23:05:57.044Z", amountIngreso: 0, amountEgreso: 54_000, amountPayment: 54_000, currency: "CRC" },
    { id: "sales", createdAt: "2026-09-23T05:46:47.372Z", amountIngreso: 89_000, amountEgreso: 0, currency: "CRC" },
  ],
});

expect(result).toMatchObject({
  ok: false,
  expectedCRC: 173_000,
  ledgerCRC: 138_000,
  driftCRC: -35_000,
});
```

Add a healthy case, USD case, no-opening error, an `amountPayment: 0` case, and a case proving movements before the opening are ignored. Mock the server-only service methods for `loadLedgerIntegrity`: verify a stable revision calculates once, a revision/`updatedAt` change retries the whole range, three unstable attempts reject with `LEDGER_CHANGED_DURING_INTEGRITY_CHECK`, and a server-read rejection is propagated rather than using cache.

- [ ] **Step 2: Run the test and confirm the missing integrity module**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerIntegrity.test.ts --reporter=verbose
```

Expected: FAIL because `ledgerIntegrity.ts` does not exist.

- [ ] **Step 3: Implement bounded range loading**

Import `getDocFromServer` and `getDocsFromServer`. Expose
`getDocumentFromServer` for the ledger and
`listAllMovementsByCreatedAtRange` as a loop over the existing paged range
query, but with every page forced to the server. It must page movements ordered
by `createdAt` between an explicit `startIso` and `endIsoExclusive`, scoped to
`accountId: "FondoGeneral"`, until exhausted so integrity never depends on the
UI's date filter or page size. Derive `endIsoExclusive` as one millisecond after
`closingISO` so a movement stamped at the closing instant is included.

- [ ] **Step 4: Implement pure and remote integrity functions**

`calculateLedgerIntegrity` starts from the applicable opening balances and
applies only later non-opening movements. Round money consistently with
`roundMoney2`. `loadLedgerIntegrity` receives `operationalStartISO` and
`closingISO`, reads the ledger from the server, fetches every movement in that
bounded operational range, and reads the ledger from the server again. It
accepts the view only when both `revision` (default zero) and `updatedAt` match;
otherwise it retries the complete read at most three times and then throws
`LEDGER_CHANGED_DURING_INTEGRITY_CHECK`. From a stable view it selects the most
recent opening at or before `closingISO`, then calculates from that opening
forward. If the range has no opening, it returns a typed `opening-missing`
failure and blocks the close.

Define:

```ts
type LedgerIntegrityBalances = {
  expectedCRC: number;
  expectedUSD: number;
  ledgerCRC: number;
  ledgerUSD: number;
  driftCRC: number;
  driftUSD: number;
};

export type LedgerIntegrityCalculation =
  | (LedgerIntegrityBalances & {
      ok: true;
      reason: "balanced";
      openingId: string;
    })
  | (LedgerIntegrityBalances & {
      ok: false;
      reason: "mismatch";
      openingId: string;
    })
  | {
      ok: false;
      reason: "opening-missing";
      openingId: null;
      expectedCRC: null;
      expectedUSD: null;
      ledgerCRC: number;
      ledgerUSD: number;
      driftCRC: null;
      driftUSD: null;
    };

export type LedgerIntegrityResult = LedgerIntegrityCalculation & {
  ledgerRevision: number;
  ledgerUpdatedAt: string;
};

export function buildOperationalStartISO(
  operationalDateKey: string,
  horarioApertura: string,
): string;

export type LoadLedgerIntegrityInput = {
  company: string;
  accountId: "FondoGeneral";
  operationalStartISO: string;
  closingISO: string;
};
```

`buildOperationalStartISO` validates `YYYY-MM-DD` and `HH:mm`, constructs the
Costa Rica instant with the `-06:00` offset, and returns UTC ISO. Add exact
tests for `2026-09-22` plus `06:00` becoming
`2026-09-22T12:00:00.000Z`, and reject malformed input rather than querying an
unbounded range.

`drift` is `ledger - expected`, so the incident returns CRC `-35000`.

- [ ] **Step 5: Write failing closing-guard and ledger-precondition tests**

In `dailyClosingIntegrityGuard.test.ts`, mock `loadLedgerIntegrity` with a
mismatch and assert `DailyClosingsService.saveClosing`, `addDoc`, and
`persistMovementToFirestore` are not called. Mock an `opening-missing` result
and a rejected query and assert both block. Mock a healthy result and assert the
existing closing flow reaches `saveClosing`, passes the revision precondition,
and calculates `diffCRC` from the authoritative ledger even when the local
balance prop is stale. Make `saveClosing` reject with
`LEDGER_CHANGED_BEFORE_CLOSING` and assert the flow releases its guard, shows
the retry message, and does not enqueue `addDoc` alert mail.

In `dailyClosingLedgerPrecondition.test.ts`, mock `runTransaction` and provide
both ledger and closing snapshots. Assert a matching revision/`updatedAt`
writes the closing, while either mismatch throws
`LEDGER_CHANGED_BEFORE_CLOSING` before `transaction.set`.

Run both tests and confirm they fail because the guard and precondition do not
exist yet.

- [ ] **Step 6: Block daily closing before saveClosing**

In `handleConfirmDailyClosing`, keep the existing schedule, turn,
single-closing-reason, and reconciliation validations first. Before building
the record or acquiring the closing guard, derive:

```ts
const operationalStartISO = buildOperationalStartISO(
  closingDateKey,
  horarioApertura!,
);
const integrity = await loadLedgerIntegrity({
  company: company!.trim(),
  accountId: "FondoGeneral",
  operationalStartISO,
  closingISO: createdAtISO,
});
```

If `reason === "mismatch"`, show:

```text
No se puede cerrar el fondo. El ledger está desviado por ₡ 35 000. Actualice la pantalla y solicite revisión administrativa.
```

`formatLedgerIntegrityMismatch` includes every non-zero currency drift (CRC,
USD, or both) using the existing currency formatter and absolute values; add
message tests for CRC-only and mixed-currency mismatches.

If the opening is missing or the authoritative check throws, show a specific
error and block rather than falling back to local state. Return `null` before
`DailyClosingsService.saveClosing`, email creation, notification writes, or
automatic adjustment movement creation.

Build `record.recordedBalanceCRC`, `record.recordedBalanceUSD`, `diffCRC`, and
`diffUSD` from `integrity.ledgerCRC`/`ledgerUSD`, not from the React
`currentBalance*` arguments. Pass the stable read metadata to the save:

```ts
await DailyClosingsService.saveClosing(
  normalizedCompany,
  record,
  dailyClosingSchedule,
  {
    ledgerDocId: MovimientosFondosService.buildCompanyMovementsKey(
      normalizedCompany,
    ),
    expectedRevision: integrity.ledgerRevision,
    expectedUpdatedAt: integrity.ledgerUpdatedAt,
  },
);
```

Extend `DailyClosingsService.saveClosing` with that optional fourth argument.
Inside its existing Firestore transaction, read both the closing document and
ledger document before any writes, interpret a missing revision as zero, and
throw `LEDGER_CHANGED_BEFORE_CLOSING` unless both revision and `updatedAt`
match. The transaction then writes the closing as it does today; Firestore
retries guarantee that a concurrent ledger write invalidates the precondition.
Handle that code explicitly in `handleConfirmDailyClosing`: release any
acquired closing guard, show "El saldo cambió mientras se preparaba el cierre.
Actualice e inténtelo de nuevo.", and return `null` without enqueuing the generic
failure-alert email.

- [ ] **Step 7: Run closing tests**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerIntegrity.test.ts tests/fondogeneral/dailyClosingIntegrityGuard.test.ts tests/services/dailyClosingLedgerPrecondition.test.ts --reporter=verbose
```

Expected: all integrity and closing-orchestration tests PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add src/services/movimientos-fondos.ts src/services/daily-closings.ts src/app/fondogeneral/utils/closing/ledgerIntegrity.ts src/app/fondogeneral/utils/closing/dailyClosing.ts tests/fondogeneral/ledgerIntegrity.test.ts tests/fondogeneral/dailyClosingIntegrityGuard.test.ts tests/services/dailyClosingLedgerPrecondition.test.ts
git commit -m "Block Fondo closing when ledger integrity fails"
```

### Task 6: Sync status UI, compatibility cleanup, and full verification

**Files:**
- Create: `src/app/fondogeneral/components/LedgerSyncStatus.tsx`
- Modify: `src/app/fondogeneral/components/layout/FondoSection.tsx`
- Modify: `src/app/fondogeneral/hooks/fondo/useV2MovementsHydration.ts`
- Modify: `src/app/fondogeneral/utils/fondo/persistence.ts`
- Test: `tests/fondogeneral/ledgerSyncStatus.test.tsx`

**Interfaces:**
- Consumes: Task 4 `ledgerSyncStatus`; existing toast/status UI conventions.
- Produces: `LedgerSyncStatus({ status })`, a visible non-blocking sync status, and a verified backward-compatible implementation.

- [ ] **Step 1: Write the failing status UI test**

Render `LedgerSyncStatus` and assert accessible labels for `connecting`, `synced`, `offline`, and `error`. The error state must not claim the ledger is current, and the synced state must not add a permanent high-contrast alert.

```tsx
expect(screen.getByText("Sincronizando saldo…")).toBeTruthy();
expect(screen.getByText("Saldo actualizado")).toBeTruthy();
expect(screen.getByText("Saldo sin conexión")).toBeTruthy();
expect(screen.getByText("No se pudo sincronizar el saldo")).toBeTruthy();
```

- [ ] **Step 2: Run the UI test and confirm failure**

Run:

```bash
npx vitest run tests/fondogeneral/ledgerSyncStatus.test.tsx --reporter=verbose
```

Expected: FAIL because the sync status surface is absent.

- [ ] **Step 3: Add the minimal status surface**

Create a presentational component with
`status: "connecting" | "synced" | "offline" | "error"` and render it near
the existing balance controls. Use muted styling for `synced`, an animated but
reduced-motion-safe indicator for `connecting`, amber for `offline`, and red
for `error`. Do not introduce a listener or polling from the component; it only
renders hook state.

- [ ] **Step 4: Remove obsolete stale-state dependencies**

Remove arithmetic uses of `initialAmount`, `initialAmountUSD`, and `ledgerSnapshot` from `persistMovementToFirestore` dependencies and update every caller. Keep `storageSnapshotRef` only for confirmed local cache replacement. Search for remaining full-ledger writes; `saveDocument` may remain only inside service-owned import/export compatibility methods, never in Fondo UI hooks or utilities.

Run:

```bash
rg -n "saveDocument\(|commitLedgerAndMovement\(|storageSnapshotRef\.current" src/app/fondogeneral src/services/movimientos-fondos.ts
```

Expected: ordinary movement and lock writes use transaction APIs; legacy-array cleanup uses a dotted-field update; `commitLedgerAndMovement` has no definition or caller; no app-level path writes an entire stale ledger.

- [ ] **Step 5: Run all focused Fondo tests**

Run:

```bash
npx vitest run tests/fondogeneral --reporter=verbose
```

Expected: all Fondo General tests PASS.

- [ ] **Step 6: Run the full verification suite**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Record the exit code and summary for each command. Fix regressions introduced by this plan. If a repository-wide command fails only on demonstrably pre-existing findings, preserve the output and report those findings exactly instead of describing the check as clean.

- [ ] **Step 7: Review the final diff for scope and production safety**

Run:

```bash
git status --short
git diff --stat 6cb80803..HEAD
git diff 6cb80803..HEAD -- src/services/movimientos-fondos.ts src/services/daily-closings.ts src/app/fondogeneral tests/fondogeneral tests/services
```

Confirm that no production data scripts, credentials, Firebase configuration, Firestore rules, or deployment files changed.

- [ ] **Step 8: Commit Task 6**

```bash
git add src/app/fondogeneral/components/LedgerSyncStatus.tsx src/app/fondogeneral/components/layout/FondoSection.tsx src/app/fondogeneral/hooks/fondo/useV2MovementsHydration.ts src/app/fondogeneral/utils/fondo/persistence.ts tests/fondogeneral/ledgerSyncStatus.test.tsx
git commit -m "Expose Fondo ledger synchronization status"
```

- [ ] **Step 9: Perform an independent whole-branch review**

Review all commits from the plan against the spec, emphasizing transaction retry behavior, missing movement handling, listener cleanup, revision gaps, closing-query completeness, and read amplification. Apply any required correction with a failing regression test first, then rerun Step 6.
