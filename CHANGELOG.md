# Changelog

All notable changes to this project are documented in this file.

## [1.2.12] - 2025-11-26

### Added

- Server-side API: new Node-runtime API route for CCSS config (`/api/ccss-config`) that reads via the Admin SDK and returns cached responses for browser clients.
- Firebase Admin initializer: `src/config/firebase-admin.ts` (uses `FIREBASE_ADMIN_SDK` env or ADC).
- Dynamic cache rules generation and helper: `next.config.ts` updated to generate `Cache-Control` headers for files under `public/` and `scripts/print-public-headers.js` to preview them locally.

### Changed

- Static asset caching: heuristics added to `next.config.ts` to apply long `s-maxage` and `immutable` policies for icons/favicons, and medium TTLs + `stale-while-revalidate` for other public assets.
- Client → Server: `src/services/ccss-config.ts` now fetches CCSS config via the new API route when running in the browser to reduce client Firestore reads.
- UI: Home/dashboard grid updated to be responsive with 4 columns on large screens (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`).
- Edit Profile modal (`src/components/edicionPerfil/EditProfileModal.tsx`) restyled to use site theme variables, fixed a Hooks ordering bug, added a circular avatar placeholder (initials / placeholder img) and disabled upload buttons (placeholder state).
- Header (`src/components/layout/Header.tsx`) updated: the user area is now a transparent, compact card-style control that shows avatar/initials, name and role. Role icons are shown to the left of the role label (user/admin/superadmin). The dropdown and profile actions remain functional.

### Fixed

- Build-time fix: added `firebase-admin` to `package.json` and updated code so production build succeeds.
- API route runtime: added a graceful 503 response and short cache TTL when Admin credentials are not found locally (avoids noisy 500s during local dev).
- Hooks bug: moved an early `if (!isOpen) return null` so Hooks call order remains stable in `EditProfileModal`.

### Notes / Deployment

- Before deploying, install new dependency and set Admin credentials in the environment:

  - Run locally:

    ```powershell
    npm install
    npm run build
    npm run dev
    ```

  - On Vercel (or your host), set the secret `FIREBASE_ADMIN_SDK` to the service account JSON string (or configure ADC via `GOOGLE_APPLICATION_CREDENTIALS`). Deploy the app so the API route can use the Admin SDK and CDN `s-maxage` caching becomes effective.

- Note: CDN caching (`s-maxage`) only takes effect once deployed behind a CDN (Vercel, Cloudflare, etc.). Local dev simulates behavior but will not populate edge caches.

### Potential next steps

- Convert other high-traffic read endpoints to Node-runtime API routes with server-side caching (e.g., `empresas`, `sorteos`, `movimientos-fondos`).
- Implement profile picture upload flow (client preview + server-side storage, e.g., Firebase Storage) — placeholder UI added in this release.
- Optionally run `npm audit fix` and review any security findings before production.

---

If anything here looks off or you want a different level of detail for the changelog (e.g., link to PRs/commits), tell me and I will update it.
# Changelog

All notable changes to this project are documented in this file.

## [1.2.12] - 2025-11-26

### Added
- Server-side API: new Node-runtime API route for CCSS config (`/api/ccss-config`) that reads via the Admin SDK and returns cached responses for browser clients.
- Firebase Admin initializer: `src/config/firebase-admin.ts` (uses `FIREBASE_ADMIN_SDK` env or ADC).
- Dynamic cache rules generation and helper: `next.config.ts` updated to generate `Cache-Control` headers for files under `public/` and `scripts/print-public-headers.js` to preview them locally.

### Changed
- Static asset caching: heuristics added to `next.config.ts` to apply long `s-maxage` and `immutable` policies for icons/favicons, and medium TTLs + `stale-while-revalidate` for other public assets.
- Client → Server: `src/services/ccss-config.ts` now fetches CCSS config via the new API route when running in the browser to reduce client Firestore reads.
- UI: Home/dashboard grid updated to be responsive with 4 columns on large screens (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`).
- Edit Profile modal (`src/components/edicionPerfil/EditProfileModal.tsx`) restyled to use site theme variables, fixed a Hooks ordering bug, added a circular avatar placeholder (initials / placeholder img) and disabled upload buttons (placeholder state).
- Header (`src/components/layout/Header.tsx`) updated: the user area is now a transparent, compact card-style control that shows avatar/initials, name and role. Role icons are shown to the left of the role label (user/admin/superadmin). The dropdown and profile actions remain functional.

### Fixed
- Build-time fix: added `firebase-admin` to `package.json` and updated code so production build succeeds.
- API route runtime: added a graceful 503 response and short cache TTL when Admin credentials are not found locally (avoids noisy 500s during local dev).
- Hooks bug: moved an early `if (!isOpen) return null` so Hooks call order remains stable in `EditProfileModal`.

### Notes / Deployment
- Before deploying, install new dependency and set Admin credentials in the environment:

  - Run locally:

    ```powershell
    npm install
    npm run build
    npm run dev
    ```

  - On Vercel (or your host), set the secret `FIREBASE_ADMIN_SDK` to the service account JSON string (or configure ADC via `GOOGLE_APPLICATION_CREDENTIALS`). Deploy the app so the API route can use the Admin SDK and CDN `s-maxage` caching becomes effective.

- Note: CDN caching (`s-maxage`) only takes effect once deployed behind a CDN (Vercel, Cloudflare, etc.). Local dev simulates behavior but will not populate edge caches.

### Potential next steps
- Convert other high-traffic read endpoints to Node-runtime API routes with server-side caching (e.g., `empresas`, `sorteos`, `movimientos-fondos`).
- Implement profile picture upload flow (client preview + server-side storage, e.g., Firebase Storage) — placeholder UI added in this release.
- Optionally run `npm audit fix` and review any security findings before production.

---

If anything here looks off or you want a different level of detail for the changelog (e.g., link to PRs/commits), tell me and I will update it.
