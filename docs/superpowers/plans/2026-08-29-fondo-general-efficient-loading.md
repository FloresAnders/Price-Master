# Fondo General Efficient Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fondo General open with at most 50 current-day movements, reuse tenant-safe IndexedDB data, avoid duplicate company reads, and replace the startup scan of up to 800 invoices with a lazy paginated pending index.

**Architecture:** Pure helpers own Costa Rica day boundaries and pending-invoice projection. A small IndexedDB service stores provider, movement-type, and current-day page records with exact TTLs and tenant-scoped keys. Existing hooks consume those helpers, while `FacturasService` owns the derived pending flag and paginated Firestore query.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Firebase/Firestore 11, IndexedDB, Vitest 4, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-08-29-fondo-general-efficient-loading-design.md`

## Global Constraints

- Work directly on `master`, as explicitly authorized by the user.
- The default operational range is the current `America/Costa_Rica` calendar day: `[00:00:00, next-day 00:00:00)`.
- Initial movement and pending-invoice pages are hard-capped at 50 documents.
- Providers expire after 5 minutes, movement types after 30 minutes, and current-day movements after 45 seconds.
- Cache keys include database ID, user ID, owner ID, company ID, account ID where applicable, resource, and date key.
- Firestore remains authoritative for writes, balances, permissions, closing guards, and final validation.
- No test, build, or implementation step connects to production Firestore or executes a backfill with `--apply`.
- Do not restore the legacy 800-document startup query as an error fallback.

---

### Task 1: Costa Rica day range and balanced loading

**Files:**
- Create: `src/app/fondogeneral/utils/costaRicaDay.ts`
- Modify: `src/app/fondogeneral/utils/v2movements.ts`
- Modify: `src/app/fondogeneral/hooks/fondo/useFondoFilters.ts`
- Modify: `src/app/fondogeneral/components/layout/FondoSection.tsx`
- Test: `tests/fondogeneral/costa-rica-day.test.ts`
- Test: `tests/fondogeneral/v2-movements-query.test.ts`

**Interfaces:**
- Produces: `buildCostaRicaCurrentDayRange(now: Date): FondoDayRange` and `buildCostaRicaDayRange(dateKey: string): FondoDayRange`.
- Produces: `resolveActiveMovementsQuery(...)` using Costa Rica ranges.
- Preserves: explicit historical range selection, but ignores persisted date filters and starts every mount on today's Costa Rica date.

- [x] **Step 1: Write failing boundary and query tests**

```ts
expect(buildCostaRicaCurrentDayRange(new Date("2026-08-29T05:59:59.000Z"))).toEqual({
  dateKey: "2026-08-28",
  startIso: "2026-08-28T06:00:00.000Z",
  endIsoExclusive: "2026-08-29T06:00:00.000Z",
});
expect(buildCostaRicaDayRange("2026-08-29").endIsoExclusive)
  .toBe("2026-08-30T06:00:00.000Z");
expect(resolveActiveMovementsQuery({
  fromFilter: null, toFilter: null, pageSize: "daily",
  currentDailyKey: "2026-08-29", todayKey: "2026-08-29",
}).startIso).toBe("2026-08-29T06:00:00.000Z");
```

- [x] **Step 2: Run the focused tests and confirm missing/wrong-local-time failures**

Run: `npm test -- tests/fondogeneral/costa-rica-day.test.ts tests/fondogeneral/v2-movements-query.test.ts`

- [x] **Step 3: Implement strict date-key validation, `-06:00` conversion, Costa Rica `todayKey`, and unconditional loading cleanup**

```ts
export type FondoDayRange = { dateKey: string; startIso: string; endIsoExclusive: string };
export function buildCostaRicaDayRange(dateKey: string): FondoDayRange;
export function buildCostaRicaCurrentDayRange(now: Date): FondoDayRange;
```

Move `endMovementsLoading()` outside the `isMounted` condition in `FondoSection`'s `finally`. Initialize `pageSize` to `"daily"`, `fromFilter`/`toFilter` to `null`, and `currentDailyKey`/`todayKey` from the Costa Rica helper.

- [x] **Step 4: Run focused tests and TypeScript**

Run: `npm test -- tests/fondogeneral/costa-rica-day.test.ts tests/fondogeneral/v2-movements-query.test.ts`

Run: `npx tsc --noEmit`

- [x] **Step 5: Commit**

```powershell
git add src/app/fondogeneral/utils/costaRicaDay.ts src/app/fondogeneral/utils/v2movements.ts src/app/fondogeneral/hooks/fondo/useFondoFilters.ts src/app/fondogeneral/components/layout/FondoSection.tsx tests/fondogeneral/costa-rica-day.test.ts tests/fondogeneral/v2-movements-query.test.ts
git commit -m "Fix Fondo current-day loading boundaries"
```

### Task 2: Tenant-safe IndexedDB cache

**Files:**
- Create: `src/services/fondo-cache.ts`
- Test: `tests/fondogeneral/fondo-cache.test.ts`

**Interfaces:**
- Produces: `FondoCacheScope`, `FondoCacheResource`, `FondoCacheHit<T>`.
- Produces: `buildFondoCacheKey`, `readFondoCache`, `writeFondoCache`, `invalidateFondoCache`, `subscribeFondoCacheInvalidation`, and `clearFondoCacheForUser`.

- [x] **Step 1: Write failing tests using `fake-indexeddb/auto`**

```ts
const scope = { databaseId: "restauracion", userId: "u1", ownerId: "o1", companyId: "ACME", accountId: "FondoGeneral", resource: "movements", dateKey: "2026-08-29" } as const;
await writeFondoCache(scope, [{ id: "m1" }], 45_000, 1_000);
expect(await readFondoCache(scope, 20_000)).toMatchObject({ freshness: "fresh" });
expect(await readFondoCache(scope, 50_000)).toMatchObject({ freshness: "stale" });
expect(await readFondoCache({ ...scope, userId: "u2" }, 20_000)).toBeNull();
```

Also cover schema mismatch, IndexedDB open failure returning `null`, targeted invalidation, and clearing only one user's records.

- [x] **Step 2: Run and confirm the cache API is missing**

Run: `npm test -- tests/fondogeneral/fondo-cache.test.ts`

- [x] **Step 3: Implement one IndexedDB object store named `records`**

```ts
export type FondoCacheResource = "providers" | "movement-types" | "movements";
export type FondoCacheHit<T> = { data: T; freshness: "fresh" | "stale"; storedAt: number; expiresAt: number };
export async function readFondoCache<T>(scope: FondoCacheScope, now?: number): Promise<FondoCacheHit<T> | null>;
export async function writeFondoCache<T>(scope: FondoCacheScope, data: T, ttlMs: number, now?: number): Promise<void>;
export async function invalidateFondoCache(match: Partial<FondoCacheScope>): Promise<void>;
export async function clearFondoCacheForUser(userId: string): Promise<void>;
export function subscribeFondoCacheInvalidation(listener: (match: Partial<FondoCacheScope>) => void): () => void;
```

All public operations catch IndexedDB errors, log one warning, and return a non-blocking fallback. Successful invalidation broadcasts `pricemaster-fondo-cache-invalidated` through `BroadcastChannel`, falling back to a `localStorage` event.

- [x] **Step 4: Run cache tests**

Run: `npm test -- tests/fondogeneral/fondo-cache.test.ts`

- [x] **Step 5: Commit**

```powershell
git add src/services/fondo-cache.ts tests/fondogeneral/fondo-cache.test.ts
git commit -m "Add tenant-safe Fondo IndexedDB cache"
```

### Task 3: Cache providers, types, and current-day movements

**Files:**
- Modify: `src/config/firebase.ts`
- Modify: `src/hooks/useProviders.ts`
- Modify: `src/app/fondogeneral/hooks/fondo/useFondoMovementTypes.ts`
- Modify: `src/app/fondogeneral/utils/v2movementsLoader.ts`
- Modify: `src/app/fondogeneral/hooks/fondo/useV2MovementsHydration.ts`
- Modify: `src/app/fondogeneral/components/layout/FondoSection.tsx`
- Modify: `src/app/fondogeneral/utils/fondo/persistence.ts`
- Modify: `src/hooks/useAuth.ts`
- Test: `tests/fondogeneral/fondo-cached-loaders.test.ts`
- Test: `tests/fondogeneral/v2-movements-loader.test.ts`

**Interfaces:**
- Consumes: Task 2 cache API and Task 1 date keys.
- Produces: optional `FondoCacheIdentity` arguments for Fondo-specific provider/type/movement loaders.
- Exports: `firestoreDatabaseId` from Firebase config, normalized to `"(default)"` when empty.

- [x] **Step 1: Write failing loader tests**

Use dependency injection around cache/remote functions and assert real returned values: fresh providers/types/movements do not invoke the remote loader; stale values render once and then refresh; a cache exception still returns remote data; daily remote page size is exactly 50.

- [x] **Step 2: Run and confirm cache integration failures**

Run: `npm test -- tests/fondogeneral/fondo-cached-loaders.test.ts tests/fondogeneral/v2-movements-loader.test.ts`

- [x] **Step 3: Wire exact TTLs and invalidation**

```ts
const PROVIDERS_TTL_MS = 5 * 60_000;
const MOVEMENT_TYPES_TTL_MS = 30 * 60_000;
const CURRENT_DAY_MOVEMENTS_TTL_MS = 45_000;
```

Fondo passes `user.id ?? user.email`, `activeOwnerId`, company, account, database, and date key. Provider/type fresh hits skip their Firestore service. Stale hits render then refresh once. The hooks subscribe to matching cross-tab invalidation events and refresh only their own resource. `ensureV2MovementsLoaded` stores display-only base pages, never cursors. Its remote operation uses a 15-second UI timeout; timed-out responses cannot mutate the active request, and the returned module error exposes a retry action without hiding cached data. `persistMovementToFirestore` invalidates matching movement records after Firestore succeeds. Logout clears the signed-in user's Fondo records. The normal Fondo type hook calls `getAllMovementTypes` and never initializes a permanent listener.

- [x] **Step 4: Run focused tests and TypeScript**

Run: `npm test -- tests/fondogeneral/fondo-cached-loaders.test.ts tests/fondogeneral/v2-movements-loader.test.ts`

Run: `npx tsc --noEmit`

- [x] **Step 5: Commit**

```powershell
git add src/config/firebase.ts src/hooks/useProviders.ts src/app/fondogeneral/hooks/fondo/useFondoMovementTypes.ts src/app/fondogeneral/utils/v2movementsLoader.ts src/app/fondogeneral/hooks/fondo/useV2MovementsHydration.ts src/app/fondogeneral/components/layout/FondoSection.tsx src/app/fondogeneral/utils/fondo/persistence.ts src/hooks/useAuth.ts tests/fondogeneral/fondo-cached-loaders.test.ts tests/fondogeneral/v2-movements-loader.test.ts
git commit -m "Cache Fondo startup data in IndexedDB"
```

### Task 4: Deduplicate company reads and reuse resolved metadata

**Files:**
- Modify: `src/services/empresas.ts`
- Modify: `src/app/fondogeneral/hooks/company/useFondoCompanyMetadata.ts`
- Modify: `src/app/fondogeneral/components/layout/FondoSection.tsx`
- Test: `tests/fondogeneral/empresas-cache.test.ts`

**Interfaces:**
- Produces: one shared in-flight `Promise<Empresas[]>` inside `getAllEmpresas()`.
- Changes: `useFondoCompanyMetadata` accepts `resolvedEmpresa: Empresas | null` and avoids a collection read when provided.

- [x] **Step 1: Write a failing concurrency test**

```ts
const [first, second, third] = await Promise.all([
  EmpresasService.getAllEmpresas(),
  EmpresasService.getAllEmpresas(),
  EmpresasService.getAllEmpresas(),
]);
expect(firestoreGetAllCalls).toBe(1);
expect(first).not.toBe(second);
```

- [x] **Step 2: Run and confirm three underlying reads occur**

Run: `npm test -- tests/fondogeneral/empresas-cache.test.ts`

- [x] **Step 3: Add in-flight promise cleanup and metadata reuse**

The in-flight promise is cleared in `finally`, successful data enters the existing 30-second cache, and every caller receives a clone. Fondo passes `activeEmpresaForCompany` to metadata so employees/company data are derived locally.

- [x] **Step 4: Run test and TypeScript**

Run: `npm test -- tests/fondogeneral/empresas-cache.test.ts`

Run: `npx tsc --noEmit`

- [x] **Step 5: Commit**

```powershell
git add src/services/empresas.ts src/app/fondogeneral/hooks/company/useFondoCompanyMetadata.ts src/app/fondogeneral/components/layout/FondoSection.tsx tests/fondogeneral/empresas-cache.test.ts
git commit -m "Deduplicate Fondo company metadata reads"
```

### Task 5: Derived pending-invoice write field

**Files:**
- Modify: `src/services/facturas.ts`
- Modify: `src/app/fondogeneral/utils/invoicePayment/closingInvoicePayment.ts`
- Modify: `src/app/fondogeneral/facturas/FacturasPage.tsx`
- Modify: `src/app/fondogeneral/utils/submitFondo.ts`
- Modify: `src/app/fondogeneral/utils/movementDeletion.ts`
- Modify: `firestore.indexes.json`
- Test: `tests/fondogeneral/factura-pending-projector.test.ts`

**Interfaces:**
- Produces: `isFacturaPendingForClosing(movement): boolean` and `withFacturaPendingForClosing(movement): FacturaMovement`.

- [x] **Step 1: Write failing projector tests**

Cover FCR pending/partial/paid/rebated, FCO false, NC positive balance, NC zero amount, and malformed numeric fields.

- [x] **Step 2: Run and confirm the projector API is missing**

Run: `npm test -- tests/fondogeneral/factura-pending-projector.test.ts`

- [x] **Step 3: Implement projector and centralize the write field**

`upsertMovement` always writes the derived boolean. Batch updates include a complete projected movement or explicitly write the correctly projected flag. The legacy reader remains in place in this commit so this writer can be deployed before migration.

- [x] **Step 4: Add the Firestore composite index**

```json
{
  "collectionGroup": "movements",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isPendingForClosing", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

- [x] **Step 5: Run focused tests and TypeScript**

Run: `npm test -- tests/fondogeneral/factura-pending-projector.test.ts`

Run: `npx tsc --noEmit`

- [x] **Step 6: Commit the independently deployable writer**

```powershell
git add src/services/facturas.ts src/app/fondogeneral firestore.indexes.json tests/fondogeneral/factura-pending-projector.test.ts
git commit -m "Write pending invoice index field"
```

### Task 6: Safe pending-index backfill

**Files:**
- Create: `scripts/backfill-factura-pending-index.mjs`
- Modify: `package.json`
- Test: `tests/fondogeneral/backfill-factura-pending-index.test.ts`

**Interfaces:**
- Produces command: `npm run backfill:factura-pending-index -- --database <id> --company <name> --verify-only`.
- Apply mode additionally requires `--apply`; exactly one of `--apply` and `--verify-only` is accepted.

- [ ] **Step 1: Write failing argument/projection/verification tests**

Test missing `--database`, missing `--company`, mutually supplied modes, verification mismatch exit code, dry verification with no writes, and transaction re-read before each apply write. Use an injected fake Admin adapter; never initialize real Firebase Admin in tests.

- [ ] **Step 2: Run and confirm the script is missing**

Run: `npm test -- tests/fondogeneral/backfill-factura-pending-index.test.ts`

- [ ] **Step 3: Implement explicit, idempotent operator modes**

The script prints project/database/company/mode before work, enumerates the selected company's `Facturas/<normalized>/movements` collection, re-reads each target in a transaction in apply mode, writes only changed flags, and verifies projected IDs against `isPendingForClosing == true`. Mismatches set `process.exitCode = 1`.

- [ ] **Step 4: Run the backfill tests**

Run: `npm test -- tests/fondogeneral/backfill-factura-pending-index.test.ts`

- [ ] **Step 5: Commit the operator tool**

```powershell
git add scripts/backfill-factura-pending-index.mjs package.json package-lock.json tests/fondogeneral/backfill-factura-pending-index.test.ts
git commit -m "Add pending invoice index backfill"
```

### Task 7: Lazy paginated pending reader and final verification

**Files:**
- Modify: `src/services/facturas.ts`
- Modify: `src/app/fondogeneral/hooks/usePendingClosingCreditInvoices.ts`
- Modify: `src/app/fondogeneral/components/invoices/PendingCreditInvoicesSection.tsx`
- Modify: `src/app/fondogeneral/components/layout/FondoSection.tsx`
- Test: `tests/fondogeneral/factura-pending-index.test.ts`
- Test: `tests/fondogeneral/pending-invoices-hook.test.tsx`

**Interfaces:**
- Consumes: Task 5 derived flag and Task 6 verified migration contract.
- Produces: `FacturasService.listPendingForClosingPage(empresa, { pageSize, cursor })` returning `{ items, cursor, exhausted }`.
- Hook accepts `{ company, enabled }` and exposes `loading`, `error`, `hasMore`, `loadMore`, and `reload` in addition to the three partitioned arrays/setter.

- [ ] **Step 1: Write failing query and hook tests**

Cover page size clamped to 50, cursor forwarding, `where("isPendingForClosing", "==", true)`, descending `createdAt`, disabled hook with zero calls, first enabled page, and cursor-based merge without duplicate IDs.

- [ ] **Step 2: Run and confirm missing reader/lazy behavior failures**

Run: `npm test -- tests/fondogeneral/factura-pending-index.test.ts tests/fondogeneral/pending-invoices-hook.test.tsx`

- [ ] **Step 3: Implement reader, hook, and UI pagination**

```ts
export type PendingFacturaPage = {
  items: FacturaMovement[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  exhausted: boolean;
};
```

Fondo enables the hook only when the movement drawer or pending section is open. The pending section shows retry/error/loading and a `Cargar más` action when `hasMore` is true. Remove the call to `listMovementsByEmpresa(company, { limit: 800 })` from Fondo and never call it on indexed-query failure.

- [ ] **Step 4: Run all focused tests, full tests, lint, TypeScript, and build**

Run: `npm test -- tests/fondogeneral/costa-rica-day.test.ts tests/fondogeneral/v2-movements-query.test.ts tests/fondogeneral/fondo-cache.test.ts tests/fondogeneral/fondo-cached-loaders.test.ts tests/fondogeneral/v2-movements-loader.test.ts tests/fondogeneral/empresas-cache.test.ts tests/fondogeneral/factura-pending-projector.test.ts tests/fondogeneral/factura-pending-index.test.ts tests/fondogeneral/pending-invoices-hook.test.tsx tests/fondogeneral/backfill-factura-pending-index.test.ts`

Run: `npm test`

Run: `npx tsc --noEmit`

Run: `npx eslint src/services/fondo-cache.ts src/services/facturas.ts src/services/empresas.ts src/hooks/useProviders.ts src/hooks/useAuth.ts src/app/fondogeneral scripts/backfill-factura-pending-index.mjs tests/fondogeneral`

Run: `npm run build`

- [ ] **Step 5: Confirm no startup 800-read remains**

Run: `rg -n "listMovementsByEmpresa\(company, \{ limit: 800 \}\)" src/app/fondogeneral`

Expected: no matches.

- [ ] **Step 6: Commit the cutover reader**

```powershell
git add src/services/facturas.ts src/app/fondogeneral/hooks/usePendingClosingCreditInvoices.ts src/app/fondogeneral/components/invoices/PendingCreditInvoicesSection.tsx src/app/fondogeneral/components/layout/FondoSection.tsx tests/fondogeneral/factura-pending-index.test.ts tests/fondogeneral/pending-invoices-hook.test.tsx
git commit -m "Lazily page pending invoices"
```

## Deployment Gate

Deploy the central writer first while the current production reader remains active, execute `--verify-only`, run the explicit `--apply`, verify again, deploy the indexed reader and committed Firestore index, and only then consider the 800-document reader retired in production. The implementation must never run these commands automatically.
