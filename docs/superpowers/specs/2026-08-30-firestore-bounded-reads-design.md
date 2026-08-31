# Firestore Bounded Reads Design

## Goal

Reduce routine Firestore reads for schedules, movement-detail reports, users, and owner functions while preserving complete results when explicitly requested.

## Scope

- Cache only the current schedule fortnight in IndexedDB.
- Replace normal full-schedule loads with company and date-bounded reads.
- Add detail-report limits of 25, 50, 75, 100, and all within the selected range.
- Scope user queries at Firestore instead of filtering all users in memory.
- Scope owner-function queries and replace full-collection numeric ID discovery with a transactional owner counter.
- Leave scan queries and occasional test/export full reads unchanged.

## Schedule Architecture

Create a focused browser-side schedule cache service backed by IndexedDB. Cache keys contain the normalized company identifier plus the fortnight start and end dates. A fortnight is days 1–15 or day 16 through the last day of the month.

Normal schedule consumers request an explicit company and date range. For the current fortnight, the service uses cache-first loading: return a valid IndexedDB entry immediately and fetch Firestore only when the entry is absent, expired, or invalidated. Schedule writes invalidate every cached fortnight intersecting the modified date. Non-current and multi-month reports query only the monthly schedule documents required by their selected companies and date range; they do not populate the current-fortnight cache.

IndexedDB unavailability or corruption is non-fatal. The service falls back to the bounded Firestore query and does not block the screen.

## Report Pagination

Detail-report requests require a valid inclusive/exclusive date range and accept `limit: 25 | 50 | 75 | 100 | "all"`. Numeric limits issue one bounded query. The result includes a cursor and `hasMore` so the same limit can load subsequent pages if the UI needs it.

The `all` option repeatedly requests bounded internal pages using `startAfter`; it never issues an unbounded query. It stops only when Firestore exhausts the selected date range. Existing company, account, currency, classification, and payment filters remain part of every page. Non-superadmin callers must supply an allowed company scope before the service runs.

The report screen exposes the five choices and keeps the selected limit stable while changing filters. Changing the date range or filters clears the cursor and results.

## User Query Scoping

`getAllUsers()` remains explicit for superadmin export and maintenance. Operational consumers use actor-scoped queries:

- Regular users and admins query by their resolved `ownerId`.
- Role restrictions are included in Firestore constraints where compatible; remaining small-result authorization checks stay defensive in memory.
- Superadmin operational views may query the roles they actually display rather than downloading every user.

The service validates that a non-superadmin actor has an owner scope and returns no rows when it cannot establish one.

## Owner Functions and Numeric IDs

Shared functions are queried using their persisted discriminator rather than loading the entire shared collection. Owner-specific functions are read only from the active owner's subcollection. Multi-owner loading is reserved for explicit superadmin views and remains parallel but owner-scoped.

Numeric function IDs use a counter document inside each owner scope. Allocation runs in a Firestore transaction, increments atomically, and returns the padded value. To preserve compatibility, the first allocation initializes the counter from existing documents once; subsequent allocations read only the counter document. Concurrent allocations must return distinct IDs.

## Data Flow and Invalidation

Firestore remains authoritative. IndexedDB contains only derived schedule cache records with schema version, company, range, records, and expiration timestamp. Successful schedule writes invalidate relevant entries after Firestore commits. Failed writes do not invalidate valid cache data.

All bounded-query APIs reject malformed ranges and unsupported limits before contacting Firestore. Errors propagate to existing UI error paths; IndexedDB errors are logged as cache misses and fall back to Firestore.

## Testing

- Fortnight boundary calculation, cache hit/miss/expiry, company isolation, write invalidation, and IndexedDB fallback.
- Schedule range resolution across one or more months without full collection reads.
- Report limits, cursor continuation, filter preservation, range validation, and complete `all` traversal.
- Actor-scoped user constraints and missing-owner behavior.
- Owner-function query constraints, one-time counter initialization, and concurrent unique allocation.
- Existing full test suite, TypeScript, ESLint on changed files, JSON/index validation, and diff checks.

## Deployment Notes

Add required Firestore composite indexes alongside the code. The function counter is backward compatible because it initializes lazily from existing owner documents. No remote migration or destructive operation is performed as part of implementation.
