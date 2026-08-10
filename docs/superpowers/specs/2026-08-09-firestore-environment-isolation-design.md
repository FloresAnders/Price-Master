# Firestore environment isolation

## Context

Production browser code uses the named Firestore database `restauracion`, while server API routes currently fall back to `(default)` when no database environment variable is set. Device-link requests and sessions are therefore written to `(default)`, but production users are read and maintained in `restauracion`.

This split makes `/api/device-link/exchange` consume a request successfully and mark it `used`, after which `/api/device-link/whoami` cannot find users that exist only in `restauracion`.

## Requirements

- Production must use `restauracion` for browser and server Firestore access.
- Development and tests must use `(default)` unless explicitly overridden.
- `FIRESTORE_DATABASE_ID` remains the preferred server-side override.
- `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` remains a compatible fallback.
- Device authentication must receive the Firestore document ID as `user.id`.
- Device authentication must not return the stored password field.
- Existing data must not be migrated or deleted by this change.

## Considered approaches

1. Central server resolver with a production fallback to `restauracion` (selected). This matches browser behavior, preserves explicit overrides, and prevents deployment configuration omissions from silently selecting `(default)`.
2. Set only a deployment environment variable. This is smaller but remains vulnerable to missing or empty deployment configuration.
3. Hardcode `restauracion`. This prevents production drift but breaks development isolation.

## Design

`getAdminDb()` will resolve the database in this order:

1. Non-empty `FIRESTORE_DATABASE_ID`.
2. Non-empty `NEXT_PUBLIC_FIRESTORE_DATABASE_ID`.
3. `restauracion` when `NODE_ENV === "production"`.
4. `(default)` otherwise.

All device-link API routes already use `getAdminDb()`, so one central change aligns creation, approval, exchange, session lookup, and user lookup.

`/api/device-link/whoami` will return a sanitized user object formed from the document data plus `id: userSnap.id`. The `password` property will be removed before serialization. Missing users will continue to prevent client authentication; no cross-database fallback will be added because environments must remain isolated.

## Tests

Automated tests will cover:

- production without an override selects `restauracion`;
- development without an override selects `(default)`;
- explicit server and public database IDs override environment defaults;
- user serialization includes the document ID;
- user serialization excludes `password`;
- a missing user remains absent instead of falling back to another database.

Tests must fail against current behavior before production code changes are made.

## Deployment behavior

After deployment, newly created device-link requests and sessions will live in `restauracion`. Existing requests and sessions in `(default)` will not be read or migrated. Users must generate a new QR after deployment. No production deployment is part of this implementation unless separately authorized.

## Success criteria

- PALMARES and DELIFOOD complete automatic authentication using new QR requests.
- Production creates no new `deviceLinkRequests` or `deviceSessions` in `(default)`.
- Development continues using `(default)` without extra configuration.
- No password field is returned by `whoami`.
