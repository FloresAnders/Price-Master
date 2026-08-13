# Gente Crystal Sales Sync Design

## Scope

Build the first production-ready synchronization path between the existing
Manifest V3 extension in `extensions/` and TimeMaster. The MVP includes:

- the authenticated TimeMaster sales endpoint;
- idempotent Firestore persistence scoped by company and ticket;
- a durable extension-side synchronization queue with retry;
- minimal extension settings for the API URL and per-device token.

The TimeMaster administration screen for issuing/revoking credentials and the
TimeMaster sales report UI are explicitly deferred. A provisioning script will
create the initial device credential until that administration screen exists.

## Chosen Approach

The extension sends sales to a dedicated TimeMaster Route Handler using a
per-device bearer token. TimeMaster hashes the token, resolves the company and
device from a server-only Firestore document, validates the payload, and writes
the sale through Firebase Admin.

Alternatives considered:

1. Direct Firestore writes from the extension were rejected because they expose
   Firebase client configuration and make device-scoped authorization and
   revocation harder to enforce.
2. Reusing the existing TimeMaster browser session was rejected because the
   extension needs a long-lived machine identity independent from a user's web
   login and cookies.
3. A dedicated integration token and API is selected because it provides the
   narrow `gentecrystal.sales.write` permission and maps the company on the
   server instead of trusting request data.

## Components and Responsibilities

### Extension detector (`extensions/content.js`)

The existing DOM detector remains responsible for recognizing tickets, draws,
amounts, sale timestamps, and deleted rows on Gente Crystal. It continues to
maintain the active local sales list used by the popup.

For every active or deleted ticket it emits a normalized event to the extension
service worker. Active events contain `ticketId`, `sorteo`, `monto`, `saleAt`,
and `status: "active"`. Deleted events contain at least `ticketId`,
`status: "deleted"`, and the observation time. The detector never calls
TimeMaster directly.

### Extension service worker (`extensions/background.js`)

The service worker receives normalized events, places them in
`chrome.storage.local`, and then attempts delivery. Queue records are keyed by
ticket so the latest known state replaces an older pending state for the same
ticket. Each update increments a revision; a fetch response can only mark the
same revision as synchronized, preventing an in-flight active request from
overwriting a newer deletion state.

Queue states are `pending`, `sending`, `synced`, and `error`. Network failures,
5xx responses, and 429 responses remain retryable with bounded exponential
backoff. Validation and authentication failures remain visible as `error` and
are retried only after configuration or payload changes. A Chrome alarm wakes
the service worker periodically so retry does not depend on the Gente Crystal
tab staying active.

The popup stores the TimeMaster base URL and raw device token in extension-local
storage. The raw token is never written into project source or Firestore.

### TimeMaster API

`POST /api/integrations/gente-crystal/sales` accepts JSON with this contract:

```json
{
  "ticketId": "41783-2204-59175496",
  "sorteo": "12/08/2026 NY NOCHE",
  "monto": 100,
  "saleAt": "2026-08-13T02:14:00.000Z",
  "status": "active"
}
```

For deletion, only `ticketId` and `status: "deleted"` are mandatory. The route
accepts `Authorization: Bearer <token>`, hashes the token with SHA-256, loads the
device record, rejects revoked devices, and checks the exact
`gentecrystal.sales.write` permission. `companyId` and `deviceId` always come
from the authenticated device record.

Validation rejects malformed JSON, ticket IDs outside the observed hyphenated
numeric format, empty/oversized draw names, non-positive or non-finite active
amounts, invalid timestamps, and unknown statuses.

### Firestore

Device credentials use:

```text
genteCrystalIntegrationDevices/{tokenHash}
```

Each device document stores `companyId`, `deviceId`, `deviceName`,
`permissions`, `createdAt`, optional `lastSeenAt`, and optional `revokedAt`.
Only the SHA-256 hash is stored.

Sales use:

```text
genteCrystalSales/{companyId}/sales/{ticketId}
```

An active sale stores `ticketId`, `sorteo`, `monto`, `saleAt`, `receivedAt`,
`updatedAt`, `status`, `deviceId`, and `source: "gente-crystal"`. A deletion is
a tombstone update with `status: "deleted"`; documents are not physically
removed. A deletion received before its active event creates a tombstone so the
deletion cannot be lost.

A Firestore transaction provides upsert semantics. The unique path implements
the invariant:

```text
COMPANY + TICKET = ONE SALE
```

## API Responses

Successful responses contain `ok`, `action`, and `ticketId`. `action` is:

- `created` for a new active sale;
- `already_exists` for an identical active replay;
- `updated` when active sale details change;
- `deleted` when the resulting state is deleted.

Error status codes are:

- 400 for malformed or invalid input;
- 401 for a missing, malformed, unknown, or revoked token;
- 403 for a valid device without the required permission;
- 429 when a future rate limiter rejects a request;
- 500 for an unexpected server or Firestore failure.

Rate limiting itself is outside this MVP; the response contract and extension
retry behavior reserve 429 for adding it later.

## Provisioning

Until the TimeMaster integration settings UI is built, a server-side script
accepts `companyId`, `deviceId`, and `deviceName`, generates a token with the
`tm_gc_` prefix, writes only its SHA-256 hash and metadata to Firestore, and
prints the raw token once. Running this script is an explicit operator action;
tests and builds never provision or mutate production Firestore.

## Testing and Verification

Implementation follows red-green-refactor.

- Pure API tests cover payload validation, bearer parsing, revoked and
  unauthorized devices, idempotent action selection, deletion tombstones, and
  company/ticket document paths.
- Route tests use injected in-memory dependencies so no test writes to
  production Firestore.
- Extension unit tests cover payload normalization, queue replacement,
  revision-safe completion, retry classification, and backoff.
- Static verification runs the focused Node test files, TypeScript checking,
  extension manifest parsing, linting of changed files, and the Next.js build.
- Browser verification reloads the already installed unpacked extension,
  confirms the service worker and popup configuration are available, and checks
  that the detector remains connected on the Gente Crystal tab. It does not
  send a production sale unless a real provisioned token is intentionally
  configured.

## Security Boundaries

- The extension never contains Firebase Admin credentials or a shared global
  secret.
- The raw integration token is shown only at provisioning and is stored only in
  extension-local storage on the linked computer.
- The API never accepts `companyId` or `deviceId` from the extension payload.
- Firestore Admin access stays server-side; client rules do not grant access to
  either integration collection.
- Logs must not include bearer tokens or authorization headers.
