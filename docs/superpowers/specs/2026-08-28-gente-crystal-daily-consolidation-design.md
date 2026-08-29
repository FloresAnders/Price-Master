# Gente Crystal Daily Consolidation Design

## Goal

Reduce the Firestore reads used by the Tiempos Gente Crystal panel by reading
one consolidated document per company and Costa Rica calendar day instead of
one document per matching sale. Preserve the current device API contract and
the complete individual sale documents as the source of truth.

## Scope

Included:

- maintain one daily consolidation document from the existing authenticated
  sales `POST` transaction;
- store the minimal ticket fields required by the current Tiempos UI;
- remove deleted tickets from the daily consolidation while retaining their
  individual tombstones;
- read the daily consolidation from the existing authenticated `GET` route;
- backfill existing active sales before switching the reader;
- preserve the current response contract and visible panel behavior.

Not included:

- removing the individual `genteCrystalSales/{companyId}/sales/{ticketId}`
  documents;
- changing the extension payload, device token, or public `POST` response;
- changing user, company, session, or schedule authorization reads;
- introducing a client-side Firestore read path;
- aggregating multiple companies or dates in one document.

## Chosen Approach

Add a materialized daily document at:

```text
genteCrystalSales/{companyId}/daily/{YYYY-MM-DD}
```

The date is the sale's calendar date in `America/Costa_Rica`. The document
contains a `sales` map keyed by `ticketId`. The ticket ID is reconstructed from
the map key when the API builds its response, so it is not duplicated inside
the stored value.

Example:

```json
{
  "sales": {
    "42148-2204-59468315": {
      "sorteo": "LOTERIA",
      "captureOrigin": "local_button",
      "monto": 2000,
      "saleAt": "2026-08-24T00:02:00.000Z",
      "status": "active"
    }
  }
}
```

Firestore stores `saleAt` as a timestamp. It remains necessary even though the
document ID identifies the day: the UI displays sale time, filters by a
From/Until time window, orders tickets, and pairs related tickets using their
sale timestamp.

The daily value intentionally excludes `deviceId`, `receivedAt`, `source`, and
per-sale `updatedAt`. Those fields remain available on the complete individual
sale document. `status` is stored as requested and is always `active` in the
daily view because deleted entries are removed.

Alternatives considered:

1. Keep querying individual sales and add only `status == active`. This saves
   deleted matches but still bills one read per active ticket.
2. Use read-time `count()` and `sum()` aggregations. This reduces summary cost
   but cannot return the individual ticket rows required by the panel.
3. Store a daily array. This provides one read but requires replacing or
   scanning the array for corrections and deletions. A map keyed by ticket ID
   allows targeted field updates and deterministic idempotency.

## Write Data Flow

The external API contract remains unchanged:

```http
POST /api/integrations/gente-crystal/sales
Authorization: Bearer <device-token>
```

The existing Firestore transaction continues to read the device record and the
individual ticket record. It derives both the previous active daily entry and
the resulting daily entry from the already-read individual record and the
normalized request. It does not need to read the daily document.

For each resulting action:

- `created`: write the complete individual sale, update device `lastSeenAt`,
  and set `sales.{ticketId}` in the new daily document;
- `updated` without a date change: write the individual sale, update the
  device, and replace `sales.{ticketId}` in the same daily document;
- `updated` with a Costa Rica date change: remove the entry from the old daily
  document and set it in the new daily document in the same transaction;
- `deleted` for an existing active sale: write the individual tombstone,
  update the device, and remove `sales.{ticketId}` from its daily document;
- deletion received before an active sale: retain the individual tombstone but
  do not create or modify a daily entry because no prior `saleAt` is known;
- `already_exists`: perform no sale, device, or daily writes, preserving the
  current idempotent behavior.

Daily field writes use Firestore field paths rather than replacing the entire
map. All writes for an accepted change remain in the same transaction so the
individual source and daily view cannot commit different states.

Expected Firestore operations for a normal accepted change on the same day:

```text
2 reads  = device + existing individual sale
3 writes = individual sale + device lastSeenAt + daily document
```

A date-changing update uses four writes because it touches both daily
documents. An idempotent replay retains the current two reads and zero writes.

## Read Data Flow

The existing authenticated `GET` contract remains unchanged. After session,
user, company, permission, and update-window validation, the reader performs a
direct document read at:

```text
genteCrystalSales/{companyId}/daily/{date}
```

A missing daily document represents an authorized day with no active sales.
For an existing document, the server:

1. validates each map key as a ticket ID;
2. accepts only entries with `status == active` and valid minimal fields;
3. reconstructs `ticketId` from the map key;
4. sorts sales by descending `saleAt`;
5. computes the existing summary from the reconstructed list;
6. returns the current API response shape.

The sales portion therefore costs one document read whether the day contains
one ticket or all 85 tickets observed in the supplied August 23 collection.
With the current authentication, company, and schedule flow, the previously
observed request is expected to fall from about 91 reads to about 7. Further
session or schedule optimizations remain separate work.

## Migration and Deployment

The rollout must avoid switching the reader before all active sales are
represented in daily documents:

1. Deploy the transaction changes while the `GET` route still reads individual
   sale documents. New changes then dual-write the source and daily view.
2. Run an idempotent server-side backfill over the current individual sales,
   not only the supplied static export, so sales received after the export are
   included. For every enumerated ticket, re-read the individual record inside
   a transaction before updating its daily field. Set the minimal entry when
   the current record is active; remove it when the current record is deleted
   and retains a usable `saleAt`. Firestore retries a transaction if a
   concurrent API write changes that individual record, preventing an older
   active snapshot from restoring a ticket deleted during migration.
3. Run the explicit commands against the intended Firestore database:

   ```bash
   npm run backfill:gente-crystal-daily -- --company "DELIKOR PALMARES" --database restauracion --apply
   npm run backfill:gente-crystal-daily -- --company "DELIKOR PALMARES" --database restauracion --verify-only
   ```

   The command must exit 0 and report `ok: true`, `mismatches: []`, and
   `entryMismatches: []` before deploying this reader change.
4. Deploy the application. The `GET` reader always uses the daily document;
   no environment flag is required.

The individual documents remain intact, allowing the daily documents to be
rebuilt or the reader to be reverted without data loss. The backfill must be an
explicit operator command and must never run automatically during tests or a
production build.

## Consistency and Limits

- The individual ticket document is the canonical record; the daily document
  is a derived read model.
- A ticket can appear in at most one daily document after a successful
  transaction.
- Deleted tickets never remain in the daily document.
- The current observed volume is suitable for one daily document. Firestore
  rejects a write that exceeds its document-size limit; the API and backfill
  must surface that failure, and production monitoring must alert before the
  observed daily volume approaches the limit.
- All tickets for a company/day update one document. The observed write volume
  is low enough for this design; sustained high-frequency contention would
  require sharded daily documents and would no longer provide a single read.

## Security Boundaries

- Device authentication, permission checks, and server-derived `companyId`
  remain unchanged.
- The browser continues to access Gente Crystal data only through the
  authenticated API.
- Daily documents contain no device ID, integration token, session value, or
  user information.
- Firestore client rules do not grant new access to the daily subcollection.

## Testing and Verification

Implementation follows red-green-refactor.

Automated tests cover:

- Costa Rica date keys at UTC day boundaries;
- minimal daily projection including `status` and required `saleAt`;
- creation and same-day correction;
- deletion removal while retaining the individual tombstone;
- deletion received before creation;
- moving a corrected sale between daily documents;
- idempotent replay without daily writes;
- direct daily reads, missing-day responses, validation, sorting, and summary;
- unchanged external `POST` and `GET` contracts;
- idempotent transactional backfill that sets active entries, removes deleted
  entries when their date is known, and groups by the Costa Rica day.

Verification runs the focused Gente Crystal tests, TypeScript checking,
linting of changed files, and the production build. Migration verification
compares counts and totals before the read cutover and does not mutate
production during automated tests.
