**Vercel / Firestore Deployment Notes**

- **Goal:** Reduce Edge function invocations and client-side Firestore reads by using Node runtime API routes and CDN caching. Provide guidance to migrate heavy endpoints to Cloud Run if necessary.

- 1) Install Admin SDK
  - Add `firebase-admin` to project dependencies and run `npm install`.
  - We added `firebase-admin` to `package.json` — run:
    `npm install`

- 2) Provide Admin credentials
  - Recommended: set `FIREBASE_ADMIN_SDK` env var to the JSON string of a Firebase service account.
  - Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` on your deployment platform.
  - The code in `src/config/firebase-admin.ts` will:
    - Parse `process.env.FIREBASE_ADMIN_SDK` (JSON string) if present and initialize Admin with it.
    - Otherwise fall back to platform default credentials.

- 3) API routes must run in Node runtime
  - For any API route that calls Firebase Admin or performs heavy DB work, add at top of `route.ts`:
    `export const runtime = 'nodejs';`
  - This ensures requests are executed on Node runtimes (not Vercel Edge) and the Admin SDK can be used.

- 4) Use Cache-Control + CDN caching
  - For read-heavy endpoints, return `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
  - This allows the CDN to serve cached results for 60s and serve stale content while revalidating for up to 5 minutes.
  - Example: `src/app/api/ccss-config/route.ts` (added) returns CCSS config via Admin SDK and sets cache headers.

- 5) Move heavy or long-running tasks to Cloud Run / Cloud Functions
  - If an endpoint performs many Firestore reads/writes or long CPU tasks, consider moving it to Cloud Run and calling it from your Next.js app.
  - Use the Admin SDK on Cloud Run with a service account.

- 6) Add a small server-side cache (optional)
  - For high-traffic routes, add Redis/Upstash or other managed cache to avoid repeated DB reads.
  - In server routes, try to set `s-maxage` headers and optionally cache responses in Redis with a TTL.

- 7) Example env setup (Vercel)
  - `FIREBASE_ADMIN_SDK` -> JSON string of the service account
  - `NEXT_PUBLIC_FIREBASE_API_KEY`, etc. -> keep client-side SDK envs as needed
  - Ensure permissions for service account include Firestore access.

- 8) Verify
  - After deploying, monitor your Firestore billing and Vercel insights to ensure Edge invocations and Firestore reads are reduced.

- 9) Notes about migration
  - We added one example Node API endpoint: `/api/ccss-config` and updated `CcssConfigService.getCcssConfig` to call it from the client.
  - To continue: identify other read-heavy services (e.g., `empresas`, `sorteos`, `movimientos-fondos`) and add similar Node API wrappers.

If you want, I can:
- Add API wrappers for additional high-traffic services (`empresas`, `sorteos`, `movimientos-fondos`).
- Add a Redis/Upstash caching integration example for a chosen endpoint.
- Run `npm install` and a test build here (I will need permission to run the tasks).
