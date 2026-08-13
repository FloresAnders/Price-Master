# Gente Crystal Sales in Tiempos Design

## Goal

Show the Gente Crystal sales already synchronized into Firestore inside the
`Tiempos/Tucan` section, specifically in the `Tiempos` column. The view must
combine a daily summary with the individual tickets for the selected day and
must enforce company access from the authenticated TimeMaster user.

## Scope

Included:

- replace the placeholder content in the `Tiempos` column;
- select a calendar day, defaulting to today in Costa Rica;
- display the active ticket count and total amount for that day;
- display each active ticket's time, draw, ticket ID, and amount;
- resolve the company automatically for a regular user;
- allow admins and superadmins to select among authorized companies;
- refresh when the date or company changes, manually on demand, and every 30
  seconds while the selected day is today;
- keep Gente Crystal integration collections inaccessible to the Firebase web
  client.

Not included:

- changes to the `Tucan` column;
- editing or deleting Gente Crystal sales from TimeMaster;
- copying integration sales into `registrotiempos`;
- aggregate reports across multiple companies or date ranges;
- pagination for a single day's sales.

## Chosen Approach

Add an authenticated `GET` handler to the existing route:

```text
/api/integrations/gente-crystal/sales
```

The existing `POST` handler remains the device-authenticated write path. The
new `GET` handler uses the TimeMaster HTTP-only session cookie, loads the user
and requested company through Firebase Admin, authorizes the company scope,
and reads the matching day's sales through Firebase Admin.

Alternatives considered:

1. Direct client reads from `genteCrystalSales` were rejected because changing
   the current server-only Firestore boundary would increase exposure and make
   role/company authorization depend on browser Firebase claims.
2. Copying tickets into `registrotiempos` was rejected because it creates two
   sources of truth and makes deletions or later corrections inconsistent.
3. An authenticated read API is selected because it preserves the existing
   Firestore boundary and independently validates every requested company.

## Company Selection and Authorization

The client represents a selected company by the actual Firestore document ID
from `empresas/{companyId}`. Labels may include `name` and `ubicacion`, but the
API never authorizes a company from a display label alone.

The `TiemposTucanSection` follows these rules:

- a regular `user` gets the company whose document ID, `name`, or `ubicacion`
  matches `user.ownercompanie`; no company selector is rendered;
- an `admin` sees companies whose `ownerId` belongs to the admin's allowed
  owner set: `user.ownerId`, plus `user.id` when `user.eliminate === false`;
- a `superadmin` sees all companies;
- the shared `fg_selected_company_shared` preference is reused only when its
  stored company remains in the current user's allowed options;
- lacking `permissions.tiempos` blocks a regular user from the Tiempos data;
  admins and superadmins retain their privileged access.

The server repeats all authorization. It reads the user ID from the signed
`pricemaster_auth` cookie, loads `users/{userId}`, requires an active user and
the appropriate permission, loads `empresas/{companyId}`, and applies the same
role rules. A forged `companyId` therefore cannot cross the user's scope.

## Daily Query and Time Zone

The API accepts a date in exact `YYYY-MM-DD` form and interprets the day in
`America/Costa_Rica`, which has offset `UTC-06:00` and no daylight-saving time.
For example, `2026-08-12` resolves to the half-open timestamp range:

```text
[2026-08-12T06:00:00.000Z, 2026-08-13T06:00:00.000Z)
```

The repository reads:

```text
genteCrystalSales/{companyId}/sales
```

using `saleAt >= start`, `saleAt < end`, and descending `saleAt` order. It
filters out every document whose status is not `active`. Deleted tombstones do
not appear and do not contribute to the summary.

The summary is computed from the returned active records:

```text
count = number of active tickets
total = sum of active ticket monto values
```

## API Contract

Request:

```http
GET /api/integrations/gente-crystal/sales?companyId=DELIKOR%20PALMARES&date=2026-08-12
Cookie: pricemaster_auth=<signed-session>
```

Successful response:

```json
{
  "ok": true,
  "companyId": "DELIKOR PALMARES",
  "date": "2026-08-12",
  "timezone": "America/Costa_Rica",
  "summary": {
    "count": 2,
    "total": 200
  },
  "sales": [
    {
      "ticketId": "41807-2204-59177102",
      "sorteo": "13/08/2026 TICA TARDE",
      "monto": 100,
      "saleAt": "2026-08-13T03:31:00.000Z"
    }
  ]
}
```

Only fields required by the UI are returned. Device IDs, received timestamps,
token hashes, and integration-device documents are never included. Every GET
response uses `Cache-Control: no-store`.

Response statuses:

- `400` for a missing or invalid company ID or date;
- `401` for a missing, invalid, expired, unknown, or inactive session user;
- `403` when the user lacks Tiempos permission or company access;
- `200` with an empty `sales` array for an authorized day without movements;
- `500` with a generic error code for an unexpected server or Firestore error.

## UI Components and Data Flow

`TiemposTucanSection` becomes a client component responsible for loading the
authenticated user, resolving allowed company options, retaining the selected
company, and preserving the two-column layout.

The `Tiempos` panel contains:

- the company selector for admins and superadmins;
- the selected-company label for a regular user;
- a native date input initialized to the current Costa Rica date;
- an `Actualizar` action;
- summary cards for `Total vendido` and `Tiquetes`;
- a responsive table with `Hora`, `Sorteo`, `Tiquete`, and `Monto` columns.

Changing the selected company or date triggers a request. The same request is
repeated every 30 seconds only when the selected date is the current Costa Rica
date. In-flight requests are cancelled or ignored when their company/date is
no longer current so a slow response cannot overwrite a newer selection.

The existing `Tucan` panel stays unchanged as a placeholder. The parent owns
the selected company so the future Tucan implementation can reuse the same
scope without redesigning the page.

## Loading, Empty, and Error States

- While users, companies, or sales load, the relevant controls are disabled
  and the panel displays a loading state.
- An authorized date with no active tickets displays `No hay movimientos para
  esta fecha` and summary values of zero.
- `401` displays `Tu sesión expiró. Inicia sesión nuevamente.`
- `403` displays `No tienes acceso a esta empresa.`
- Unexpected/network failures display `No se pudieron cargar los movimientos`
  while retaining the current company and date so the user can retry.
- Changing company or date clears stale errors and never displays sales from
  the previous scope under the new selection.

## Security Boundaries

- `genteCrystalSales` and `genteCrystalIntegrationDevices` remain denied to
  the Firebase web client in Firestore rules.
- The read API accepts no device bearer token and never exposes one.
- The server does not trust the user's role, permissions, owner IDs, company
  list, or selected label from client state.
- Authorization uses fresh Firestore user and company documents on every GET.
- Logs and responses contain no cookie values, authorization headers, device
  token hashes, or integration secrets.

## Testing and Verification

Implementation follows red-green-refactor.

Automated tests cover:

- exact `YYYY-MM-DD` validation and Costa Rica UTC range calculation;
- regular-user matching by company document ID, name, or location;
- admin owner-scope checks and unrestricted superadmin selection;
- denial for inactive users, missing Tiempos permission, and forged company
  IDs;
- repository ordering, exclusion of deleted tombstones, and summary totals;
- GET route contracts for `400`, `401`, `403`, `200` empty, `200` populated,
  and generic `500` responses;
- client-side allowed-company selection and rejection of an unauthorized
  stored preference.

Static verification runs focused Node tests, TypeScript checking, linting of
changed TypeScript/TSX files, and the production Next.js build.

Manual browser verification checks:

- a regular user sees only the assigned company and no selector;
- an admin can switch only among owner-scoped companies;
- a superadmin can select any company;
- changing date or company updates both summary and ticket rows;
- deleted tickets and tickets outside the selected Costa Rica day do not
  appear;
- a newly synchronized sale appears on manual refresh and on the 30-second
  refresh for today;
- the Tucan placeholder remains visually and functionally unchanged.
