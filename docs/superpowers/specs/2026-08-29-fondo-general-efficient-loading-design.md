# Fondo General Efficient Loading Design

## Objective

Reduce Firestore reads and eliminate intermittent infinite loading in Fondo
General without weakening accounting correctness. The initial screen must load
only the current Costa Rica calendar day, reuse safe reference data from
IndexedDB, and stop downloading up to 800 invoice movements merely to discover
which invoices remain pending.

## Scope

This design covers the main `FondoSection` flow:

- company/provider/type reference loading;
- the first page of Fondo movements;
- pending credit invoices and credit notes used by Fondo workflows;
- module-level loading and error state;
- migration and rollout of the pending-invoice index.

It does not redesign invoice history, reports, balances, closing guards,
authentication, permissions, or Firestore database selection.

## Confirmed Product Rules

1. The operational day is only the current calendar day in
   `America/Costa_Rica`.
2. Its range is `[00:00:00, next-day 00:00:00)` in Costa Rica.
3. The initial movement request reads at most 50 movements inside that range.
4. Every new Fondo General mount resets the date filter to the current Costa
   Rica day, even if an older date range was persisted previously. Other
   non-date filters may remain persisted.
5. Older movements are loaded only after the user selects another date/range
   or explicitly asks for more history during the active session.
6. Pending invoices are not restricted to the current day. An old unpaid
   invoice must remain available until paid, rebated, or otherwise closed.
7. Initial pending-invoice pages contain at most 50 documents, with explicit
   pagination for additional pending documents.
8. Cached data may accelerate rendering, but Firestore remains authoritative
   for balances, writes, permission checks, closing guards, and final
   validation.

## Current Problems

### Pending invoices

`usePendingClosingCreditInvoices` calls
`FacturasService.listMovementsByEmpresa(company, { limit: 800 })` on every
company load and filters the result in the browser. This can bill hundreds of
reads even when only a few documents are pending.

### Duplicate company reads

Company resolution and company metadata can start three concurrent
`getAllEmpresas()` calls. The existing 30-second memory cache only helps after
one call completes; it does not share an in-flight promise.

### Reference data reloads

Providers have only a 15-second memory cache. Movement types use localStorage
but can perform an initial query followed immediately by the initial snapshot
of a real-time listener.

### Stuck loading counter

The main movement effect increments a shared counter. When an obsolete effect
finishes after a company or account change, its local `isMounted` guard can
skip the matching decrement, leaving the overlay active indefinitely.

### Time-zone ambiguity

The current range helper builds local-midnight dates using the browser time
zone. Fondo General must use Costa Rica boundaries regardless of the device
time zone.

## Architecture

### 1. Costa Rica current-day range

Create one pure date module for Fondo queries:

```ts
type FondoDayRange = {
  dateKey: string;
  startIso: string;
  endIsoExclusive: string;
};

function buildCostaRicaCurrentDayRange(now: Date): FondoDayRange;
function buildCostaRicaDayRange(dateKey: string): FondoDayRange;
```

`buildCostaRicaCurrentDayRange` derives the `YYYY-MM-DD` key using
`America/Costa_Rica`. `buildCostaRicaDayRange` converts that key to an explicit
UTC range using Costa Rica's `-06:00` offset. The default V2 query uses the
current range. Explicit historical filters use the selected Costa Rica date
keys and remain server-bounded.

Tests must include the UTC boundary around Costa Rica midnight so a browser in
another time zone cannot change the selected documents.

### 2. IndexedDB service cache

Add a focused Fondo cache service instead of storing large datasets in
localStorage. Firestore's persistent local cache remains enabled; this service
adds application TTL semantics that can intentionally skip a server request.

Cache records use this envelope:

```ts
type FondoCacheRecord<T> = {
  schemaVersion: 1;
  key: string;
  storedAt: number;
  expiresAt: number;
  data: T;
};
```

Keys must include the Firestore database ID, signed-in user ID, owner ID,
company ID, account ID where applicable, resource name, and movement date.
This prevents data from one tenant, account, or database appearing in another
context.

Exact TTLs:

- providers: 5 minutes;
- movement types: 30 minutes;
- current-day movements: 45 seconds.

The cache API returns both data and freshness:

```ts
type FondoCacheHit<T> = {
  data: T;
  freshness: "fresh" | "stale";
};
```

A fresh hit skips Firestore. A stale hit renders immediately and starts a
background refresh. Cache misses use Firestore. Successful application writes
update or invalidate the affected keys, and cross-tab invalidation uses
`BroadcastChannel` with a `storage`-event fallback. Logout removes user-scoped
Fondo cache entries. IndexedDB failure falls back to the current Firestore
flow without blocking the UI.

Firestore cursors are not serialized. A cached movement page is display data;
if the user requests another page after a cache-only render, the loader first
refreshes the server page to obtain a valid runtime cursor.

### 3. Reference data loaders

Providers and movement types become independently loadable modules:

```ts
type FondoModuleStatus =
  | "idle"
  | "loading-cache"
  | "ready-cache"
  | "syncing"
  | "ready"
  | "error";
```

Providers load once per company and are filtered by account in memory, allowing
account-tab switches without another query. Provider mutations invalidate and
repopulate the provider cache.

Movement types use the 30-minute cache and a bounded refresh. The normal Fondo
screen does not open a permanent listener after a cache hit. The type-management
screen remains responsible for invalidating the cache after a mutation.

`EmpresasService.getAllEmpresas()` gains an in-flight promise shared by
concurrent callers. Company metadata reuses the company list already resolved
for the selector instead of starting separate full-collection reads.

### 4. Current-day movement loading

The first V2 movement request uses the Costa Rica current-day range and a hard
limit of 50. Cache identity includes company, account, and `dateKey`.

The UI may show a cached page immediately. A fresh 45-second cache avoids a
server query. A stale cache keeps the table usable while one background request
updates it. A module error displays a retry action but does not hide providers,
types, or cached movements.

At Costa Rica midnight, the previous key is no longer eligible for the default
screen. The loader creates a new current-day key and does not mix yesterday's
records into today's table.

### 5. Pending-invoice index

Add the derived boolean `isPendingForClosing` to every `FacturaMovement` write.
One pure projector owns the rule:

```ts
function isFacturaPendingForClosing(
  movement: Pick<
    FacturaMovement,
    | "invoiceDocType"
    | "paymentStatus"
    | "amount"
    | "originalAmount"
    | "paidAmount"
    | "balanceDue"
  >,
): boolean;
```

The result is true only when:

- the type is `FCR`, the effective balance is greater than zero, and status is
  neither `PAGADA` nor `REBAJADA`; or
- the type is `NC`, its balance is greater than zero or it is the existing
  zero-amount pending-note case, and status is neither `PAGADA` nor
  `REBAJADA`.

`FCO` is always false. `FacturasService.upsertMovement` calculates the field
centrally so creation, editing, payments, credit-note application, rollback,
and closing flows cannot apply different rules.

The new reader uses:

```text
where isPendingForClosing == true
order by createdAt descending
limit 50
```

It returns a cursor and `exhausted` state. The Fondo hook loads this reader only
when pending invoices are actually needed: opening the movement workflow,
opening an invoice-payment/closing workflow, or expanding the pending-invoices
section. It does not run during the default Fondo mount.

The required composite index is committed with the application. A missing
index produces a module error with retry guidance and never falls back silently
to the 800-document query.

### 6. Pending-index migration and safe rollout

The rollout has two application phases:

1. Deploy central writes of `isPendingForClosing` while retaining the legacy
   reader.
2. Run an idempotent backfill over existing invoice movements, re-reading each
   document inside its transaction before writing the derived field.
3. Run verification that compares the identities and projected state of all
   legacy-derived pending records with the indexed query.
4. Only after verification succeeds, deploy the paginated pending reader and
   remove the 800-document startup read.

The operator script requires explicit `--database`, `--company`, and exactly
one of `--apply` or `--verify-only`. It prints the selected project/database
before work and exits nonzero on mismatches. No backfill runs during tests,
build, page load, or deployment.

This two-phase rollout prevents a write made during migration from losing its
pending flag and prevents old unpaid invoices from disappearing at cutover.

### 7. Loading correctness and diagnostics

Every `beginMovementsLoading()` call must have an unconditional matching
`endMovementsLoading()` in `finally`. Local request identity may suppress stale
state updates, but it must not suppress counter cleanup.

Each startup module records:

- cache/server source;
- start and finish time;
- returned document count;
- success or normalized error category.

The preparation UI reports module status independently. A provider/type failure
does not keep the movement table under a permanent overlay. Remote movement
requests receive a 15-second UI timeout and a retry action; late responses are
discarded using request identity.

## Data Flow

```text
Open Fondo General
  -> resolve user/company
  -> read providers, types, and today's movement page from IndexedDB in parallel
  -> render available cached modules
  -> refresh only missing/stale modules
  -> do not read pending invoices yet

Open movement/closing/pending-invoice UI
  -> query first 50 isPendingForClosing documents
  -> load additional pages only on explicit demand

Create/edit/pay/rebate invoice
  -> FacturasService.upsertMovement computes isPendingForClosing
  -> Firestore write succeeds
  -> invalidate/update affected pending-query state and visible state
```

## Error and Consistency Rules

- Cached balances never override the ledger document.
- Cached permissions never authorize an action.
- Writes never succeed only in IndexedDB; Firestore must confirm them.
- Stale data is visibly marked while synchronizing.
- Switching company/account invalidates request identity and balances all
  loading counters.
- A failed pending query never falls back to the unbounded legacy reader after
  cutover.
- Pending pages may be partial in the UI; correctness checks that require a
  specific invoice must fetch it directly or ensure its page is loaded.

## Expected Read Reduction

Cold load after cutover:

- pending invoices: 0 on initial mount instead of up to 800;
- movements: at most 50 for the current Costa Rica day;
- companies: one shared collection request instead of up to three concurrent
  requests;
- providers and types: one bounded refresh each when cache is missing or
  expired.

Warm load within TTL:

- providers: 0 server reads;
- movement types: 0 server reads;
- current-day movements: 0 server reads during the 45-second window;
- pending invoices: 0 unless the user opens a workflow that needs them, then
  at most 50 per requested page.

The first load on a new browser still reads required reference/current-day
data. IndexedDB improves repeat visits; the pending index is what removes the
largest cold-load cost.

## Testing Strategy

Use focused tests rather than production data:

- pure Costa Rica day-boundary tests;
- pure pending-projector tests covering FCR, FCO, NC, partial, paid, rebated,
  missing fields, and zero-amount notes;
- IndexedDB cache tests with a fake adapter/clock for tenant isolation, TTL,
  stale hits, invalidation, schema changes, and failure fallback;
- service tests proving concurrent company calls share one request;
- reader tests proving `isPendingForClosing == true`, order, limit 50, cursor,
  and no legacy 800 fallback;
- hook tests proving pending invoices are lazy and module failures do not block
  unrelated modules;
- loading-counter regression test for company/account changes during an
  in-flight movement request;
- focused Fondo tests, TypeScript, scoped ESLint, and one production build.

No test or build may connect to production Firestore or run the migration with
`--apply`.

## Acceptance Criteria

1. Entering Fondo General does not query up to 800 invoice documents.
2. The default movement query is exactly the current Costa Rica calendar day
   and returns at most 50 documents.
3. Older pending invoices remain discoverable through the pending index and
   pagination regardless of their creation date.
4. Returning within each TTL skips the matching Firestore query.
5. Company, account, user, and database cache keys cannot collide.
6. Changing company/account during load cannot leave the movement overlay
   active.
7. Missing IndexedDB, a rejected cache operation, or a module failure leaves a
   usable retry path.
8. Backfill verification must succeed before the indexed reader is deployed.
