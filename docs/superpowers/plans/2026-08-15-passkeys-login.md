# Passkeys Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular el login de TimeMaster para admitir passkeys WebAuthn descubribles, conservar la contraseña y usar sesiones revocables emitidas por el servidor.

**Architecture:** Next.js Route Handlers ejecutan `@simplewebauthn/server` y persisten passkeys, ceremonias y sesiones opacas en Firestore mediante Firebase Admin. React usa `@simplewebauthn/browser`; IndexedDB solo elige la presentación inicial del login y el estado autenticado se hidrata desde una cookie `HttpOnly` validada por el servidor.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Firebase Admin/Firestore, `@simplewebauthn/server` 13.3.2, `@simplewebauthn/browser` 13.3.0, Vitest, Testing Library, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-08-15-passkeys-login-design.md`

## Global Constraints

- La clave privada, huella, rostro y PIN nunca salen del autenticador.
- Usar credenciales descubribles con `residentKey: "required"`, `userVerification: "required"` y `attestationType: "none"`.
- Passkeys sincronizadas están permitidas y no caducan automáticamente.
- La contraseña y el QR permanecen disponibles e independientes.
- IndexedDB no almacena usuario, credential ID, token, permiso ni secreto.
- Todas las operaciones sensibles usan Firebase Admin y `Cache-Control: no-store`.
- `PRICE_MASTER_SESSION_SECRET` es obligatorio en producción y nunca tiene un fallback público.
- El botón «Regístrese» queda visible, deshabilitado y rotulado «Próximamente».
- No se amplía el alcance al contenedor nativo de Capacitor.

---

### Task 1: Test harness and WebAuthn primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `src/lib/passkeys/types.ts`
- Create: `src/lib/passkeys/config.server.ts`
- Create: `src/lib/passkeys/crypto.server.ts`
- Test: `tests/passkeys/config.test.ts`
- Test: `tests/passkeys/crypto.test.ts`

**Interfaces:**
- Produces: `getWebAuthnConfig(env?)`, `base64UrlRandom(bytes)`, `sha256Base64Url(value)`, `safeEqual(a, b)`, and shared passkey/session types.
- Consumes: no feature code.

- [ ] **Step 1: Install exact runtime and test dependencies**

Run:

```powershell
npm install @simplewebauthn/browser@13.3.0 @simplewebauthn/server@13.3.2
npm install -D vitest@latest @testing-library/react@latest @testing-library/jest-dom@latest fake-indexeddb@latest
```

- [ ] **Step 2: Add scripts and Vitest configuration**

Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json`. Configure the default environment as `node`, aliases `@` to `src`, and setup `fake-indexeddb/auto` only from client test files.

- [ ] **Step 3: Write failing configuration and crypto tests**

```ts
expect(getWebAuthnConfig({ NODE_ENV: "production" })).toThrow(/RP_ID/);
expect(getWebAuthnConfig({
  NODE_ENV: "production",
  TIMEMASTER_WEBAUTHN_RP_ID: "timemaster.example",
  TIMEMASTER_WEBAUTHN_ORIGINS: "https://timemaster.example",
  PRICE_MASTER_SESSION_SECRET: "a".repeat(32),
}).origins).toEqual(["https://timemaster.example"]);
expect(sha256Base64Url("credential")).toHaveLength(43);
expect(safeEqual("same", "same")).toBe(true);
expect(safeEqual("same", "other")).toBe(false);
```

- [ ] **Step 4: Run the focused tests and observe missing-module failures**

Run: `npx vitest run tests/passkeys/config.test.ts tests/passkeys/crypto.test.ts`

- [ ] **Step 5: Implement strict config, crypto helpers and shared types**

`getWebAuthnConfig()` accepts localhost defaults only outside production, parses a comma-separated origin allowlist, and rejects secrets shorter than 32 characters. `PasskeyRecord`, `AuthSessionRecord`, `WebAuthnCeremonyRecord`, and `EnrollmentGrantRecord` use millisecond timestamps at repository boundaries.

- [ ] **Step 6: Run focused tests and TypeScript**

Run: `npx vitest run tests/passkeys/config.test.ts tests/passkeys/crypto.test.ts && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json vitest.config.ts src/lib/passkeys tests/passkeys
git commit -m "test: add passkey foundations"
```

### Task 2: Revocable server sessions

**Files:**
- Create: `src/lib/auth/session-store.server.ts`
- Rewrite: `src/lib/auth/session-cookie.server.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/session/route.ts`
- Modify: `src/app/api/anotaciones/delete/route.ts`
- Modify: `src/app/api/integrations/gente-crystal/sales/read-route.ts`
- Modify: `src/app/api/integrations/gente-crystal/sales/route.ts`
- Test: `tests/auth/session-store.test.ts`
- Test: `tests/auth/session-routes.test.ts`

**Interfaces:**
- Consumes: `sha256Base64Url()` and `AuthSessionRecord` from Task 1.
- Produces: `createAuthSession({ userId, role, authMethod, credentialIdHash? })`, `readAuthSession(cookieHeader)`, `revokeAuthSession(cookieHeader, reason)`, `setAuthCookie(response, token, maxAge)`, `clearAuthCookie(response)`, and `serializeSafeUser(user)`.

- [ ] **Step 1: Write failing session tests with an injected in-memory repository**

Cover token hashing, expired/revoked sessions, inactive users, role-based durations, passkey revocation, logout and sanitized `/api/auth/session` responses.

```ts
const issued = await service.create({ userId: "u1", role: "user", authMethod: "password" });
expect(repository.saved.tokenHash).not.toBe(issued.token);
expect((await service.read(`pricemaster_auth=${issued.token}`))?.userId).toBe("u1");
repository.saved.revokedAt = Date.now();
expect(await service.read(`pricemaster_auth=${issued.token}`)).toBeNull();
```

- [ ] **Step 2: Run session tests and verify failure**

Run: `npx vitest run tests/auth/session-store.test.ts tests/auth/session-routes.test.ts`

- [ ] **Step 3: Implement opaque sessions and cookies**

Use 32 random bytes for the cookie token and SHA-256 for lookup. The cookie remains `pricemaster_auth`, with `HttpOnly`, `SameSite=Lax`, `Secure` in production and role duration. `readAuthSession()` is asynchronous and checks the current user plus the passkey record when `authMethod === "passkey"`.

- [ ] **Step 4: Migrate password login, logout and current callers**

`POST /api/auth/login` accepts `{ username, password, enrollPasskey?: boolean }`, issues the server session, and never creates a client-signed token. `GET /api/auth/session` returns `{ ok: true, user, session: { authMethod, expiresAt } }`. Update existing cookie readers to await the new API.

- [ ] **Step 5: Run focused tests, old tests and TypeScript**

Run: `npx vitest run tests/auth/session-store.test.ts tests/auth/session-routes.test.ts && node --test tests/daily-closing-email.test.mjs && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```powershell
git add src/lib/auth src/app/api/auth src/app/api/anotaciones/delete src/app/api/integrations/gente-crystal tests/auth
git commit -m "feat: issue revocable server sessions"
```

### Task 3: Ceremony and enrollment repositories

**Files:**
- Create: `src/lib/passkeys/repository.server.ts`
- Create: `src/lib/passkeys/ceremonies.server.ts`
- Create: `src/lib/passkeys/http.server.ts`
- Test: `tests/passkeys/ceremonies.test.ts`
- Test: `tests/passkeys/repository.test.ts`

**Interfaces:**
- Consumes: Task 1 types/config/crypto and Task 2 authenticated session.
- Produces: `createCeremony()`, `consumeCeremony()`, `createEnrollmentGrant()`, `claimEnrollmentGrant()`, `getOrCreatePasskeyUser()`, `savePasskey()`, `getPasskeyByCredentialId()`, `listUserPasskeys()`, `renamePasskey()`, and `revokePasskey()`.

- [ ] **Step 1: Write failing transaction and ownership tests**

```ts
const ceremony = await service.createCeremony({ type: "authentication", browserBinding: "b" });
expect(await service.consumeCeremony(ceremony.id, "b")).toMatchObject({ type: "authentication" });
await expect(service.consumeCeremony(ceremony.id, "b")).rejects.toThrow("ceremony_consumed");
await expect(service.consumeCeremony(ceremony.id, "other")).rejects.toThrow("ceremony_mismatch");
```

Also test five-minute expiry, one grant per recent password verification, stable random `webAuthnUserId`, credential hash lookup, owner-only rename/revoke, and superadmin override.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/passkeys/ceremonies.test.ts tests/passkeys/repository.test.ts`

- [ ] **Step 3: Implement repository interfaces and Firestore adapters**

Use Firestore transactions for consume-once ceremonies and grants. Return plain values rather than Firestore snapshots so route logic remains testable. Create a persistent anonymous browser-binding cookie named `timemaster_webauthn_browser` with 32 random bytes and store only its hash.

- [ ] **Step 4: Run focused tests and TypeScript**

Run: `npx vitest run tests/passkeys/ceremonies.test.ts tests/passkeys/repository.test.ts && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```powershell
git add src/lib/passkeys tests/passkeys
git commit -m "feat: persist passkey ceremonies"
```

### Task 4: Passkey registration API

**Files:**
- Create: `src/app/api/auth/passkeys/register/options/route.ts`
- Create: `src/app/api/auth/passkeys/register/verify/route.ts`
- Create: `src/app/api/auth/passkeys/reauth/route.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Create: `src/lib/passkeys/registration.server.ts`
- Test: `tests/passkeys/registration.test.ts`

**Interfaces:**
- Consumes: authenticated server session, enrollment grant, passkey repository, and `generateRegistrationOptions()`/`verifyRegistrationResponse()`.
- Produces: options response `{ ok, ceremonyId, options }` and verification response `{ ok, passkey }`.

- [ ] **Step 1: Write failing handler tests with injected WebAuthn verifier**

Cover missing session, password-auth requirement, expired grant, wrong browser binding, duplicate credential, inactive user, exact origin/RP ID, `userVerified === true`, and successful storage of `credential.publicKey`, `credential.counter`, transports, device type and backup state.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/passkeys/registration.test.ts`

- [ ] **Step 3: Implement registration options**

Call `generateRegistrationOptions({ rpName, rpID, userID, userName, userDisplayName, attestationType: "none", excludeCredentials, authenticatorSelection: { residentKey: "required", userVerification: "required" } })`. Create the ceremony before returning options.

- [ ] **Step 4: Implement verification and reauthentication**

Consume the ceremony once, call `verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origins, expectedRPID, requireUserVerification: true })`, save only verified credential material, then consume the enrollment grant. Extend `/api/auth/login` so `{ enrollPasskey: true }` creates the initial grant after password verification; `/reauth` verifies the current user's password and creates a fresh grant.

- [ ] **Step 5: Run focused tests and TypeScript**

Run: `npx vitest run tests/passkeys/registration.test.ts && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/auth/passkeys/register src/app/api/auth/passkeys/reauth src/lib/passkeys/registration.server.ts tests/passkeys/registration.test.ts
git commit -m "feat: register passkeys after password login"
```

### Task 5: Discoverable passkey authentication API

**Files:**
- Create: `src/app/api/auth/passkeys/authenticate/options/route.ts`
- Create: `src/app/api/auth/passkeys/authenticate/verify/route.ts`
- Create: `src/lib/passkeys/authentication.server.ts`
- Test: `tests/passkeys/authentication.test.ts`

**Interfaces:**
- Consumes: passkey repository, ceremonies and Task 2 session creation.
- Produces: options response `{ ok, ceremonyId, options }`; verification response `{ ok, user }` plus the server cookie.

- [ ] **Step 1: Write failing discoverable-auth tests**

Assert options omit `allowCredentials`, require user verification, accept multiple accounts, reject revoked/unknown credentials and inactive users, verify the exact challenge/origin/RP ID, update last use/counter/backup state, and emit a passkey-bound session.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/passkeys/authentication.test.ts`

- [ ] **Step 3: Implement options and verification handlers**

Use `generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: [] })`. Verify with the stored public key and counter. A non-zero counter regression returns a generic `passkey_authentication_failed`, records a structured server warning and does not create a session; zero-only multi-device counters remain valid.

- [ ] **Step 4: Run focused tests and TypeScript**

Run: `npx vitest run tests/passkeys/authentication.test.ts && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/auth/passkeys/authenticate src/lib/passkeys/authentication.server.ts tests/passkeys/authentication.test.ts
git commit -m "feat: authenticate with discoverable passkeys"
```

### Task 6: Passkey management API and Firestore protection

**Files:**
- Create: `src/app/api/auth/passkeys/route.ts`
- Create: `src/app/api/auth/passkeys/[credentialIdHash]/route.ts`
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Test: `tests/passkeys/management.test.ts`
- Test: `tests/passkeys/firestore-config.test.ts`

**Interfaces:**
- Consumes: session service and passkey repository.
- Produces: `GET /api/auth/passkeys`, `PATCH` with `{ label }`, and `DELETE`, each owner-scoped unless a superadmin supplies `?userId=`.

- [ ] **Step 1: Write failing management and configuration tests**

Test owner list/rename/revoke, cross-user denial, superadmin override, label normalization to 1–80 characters, idempotent revocation and generic not-found responses. Parse rules/index JSON to assert all five server-only collections are denied and required indexes exist.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/passkeys/management.test.ts tests/passkeys/firestore-config.test.ts`

- [ ] **Step 3: Implement management routes**

Return only credential hash, label, type, backup state, created/last-used timestamps and status. Revocation marks the passkey; session reads already invalidate every linked session immediately.

- [ ] **Step 4: Protect Firestore and add indexes**

Add explicit `allow read, write: if false` matches before the generic rule and exclude each collection from the generic fallback. Add collection indexes for passkeys by `userId, revokedAt, createdAt` and sessions by `credentialIdHash, revokedAt`.

- [ ] **Step 5: Run tests and TypeScript**

Run: `npx vitest run tests/passkeys/management.test.ts tests/passkeys/firestore-config.test.ts && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/auth/passkeys firestore.rules firestore.indexes.json tests/passkeys
git commit -m "feat: manage and revoke passkeys"
```

### Task 7: Client WebAuthn and IndexedDB state

**Files:**
- Create: `src/lib/passkeys/client.ts`
- Create: `src/lib/passkeys/preference.client.ts`
- Test: `tests/passkeys/client.test.ts`
- Test: `tests/passkeys/preference.test.ts`

**Interfaces:**
- Produces: `isPasskeySupported()`, `registerPasskey()`, `authenticateWithPasskey()`, `getPasskeyPreference()`, `markPasskeySuccessful()`, and `clearPasskeyPreference()`.
- Consumes: Task 4/5 JSON contracts and `@simplewebauthn/browser`.

- [ ] **Step 1: Write failing browser-client and IndexedDB tests**

Use `fake-indexeddb` to assert the database stores only `{ passkeyAvailable, lastSuccessfulUse }`. Mock `startRegistration`/`startAuthentication` and fetch to assert ceremony IDs are returned to the matching verification route and local preference changes only after server success.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/passkeys/client.test.ts tests/passkeys/preference.test.ts`

- [ ] **Step 3: Implement the client modules**

Map cancellation/timeouts to `{ code: "cancelled" }`, network failures to `{ code: "network" }`, unsupported clients to `{ code: "unsupported" }`, and all server rejections to `{ code: "failed" }`. Do not auto-trigger an authentication ceremony.

- [ ] **Step 4: Run tests and TypeScript**

Run: `npx vitest run tests/passkeys/client.test.ts tests/passkeys/preference.test.ts && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```powershell
git add src/lib/passkeys tests/passkeys
git commit -m "feat: add browser passkey client"
```

### Task 8: Reformulated login and server session hydration

**Files:**
- Rewrite: `src/components/auth/LoginModal.tsx`
- Modify: `src/components/auth/AuthWrapper.tsx`
- Refactor: `src/hooks/useAuth.ts`
- Create: `src/components/auth/PasskeyLoginButton.tsx`
- Create: `src/components/auth/PasswordLoginForm.tsx`
- Test: `tests/components/login-modal.test.tsx`
- Test: `tests/auth/use-auth-session.test.tsx`

**Interfaces:**
- Consumes: Task 2 `/api/auth/session`, Task 4 registration and Task 5 browser authentication.
- Produces: `onLoginSuccess(user)` with server-owned session already established; `useAuth.refreshSession()` hydrates authoritative user state.

- [ ] **Step 1: Write failing UI state tests**

Cover the dark Time Master composition, remembered username only, first activation, passkey-primary state, explicit click requirement, password fallback, cancelled WebAuthn, unsupported-browser fallback, recovery action, and visible disabled «Regístrese / Próximamente».

- [ ] **Step 2: Write failing session hydration tests**

Assert initial auth calls `/api/auth/session`, a 401 opens login without trusting localStorage, login success refreshes server state, and logout clears server cookie plus non-authoritative caches.

- [ ] **Step 3: Run tests and verify failure**

Run: `npx vitest run tests/components/login-modal.test.tsx tests/auth/use-auth-session.test.tsx`

- [ ] **Step 4: Implement the new login components**

Match the approved visual reference using the existing `/Logos/LogoBlanco.png`, lucide icons and responsive Tailwind classes. On password success with enrollment requested, show an intermediate «Configura tu acceso seguro» state, run registration, and enter the app even when registration is cancelled.

- [ ] **Step 5: Refactor auth hydration**

Make `/api/auth/session` the source of truth. Keep localStorage only where existing non-security UI requires cached information; remove `TokenService.createTokenSession()` from login and do not use client data to authorize roles.

- [ ] **Step 6: Run UI tests, TypeScript and lint on changed files**

Run: `npx vitest run tests/components/login-modal.test.tsx tests/auth/use-auth-session.test.tsx && npx tsc --noEmit && npx eslint src/components/auth src/hooks/useAuth.ts`

- [ ] **Step 7: Commit**

```powershell
git add src/components/auth src/hooks/useAuth.ts tests/components tests/auth
git commit -m "feat: redesign login for passkeys"
```

### Task 9: User and superadmin passkey management UI

**Files:**
- Create: `src/components/auth/PasskeyManagerModal.tsx`
- Modify: `src/components/auth/index.ts`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/edit/components/UsersEditorSection.tsx`
- Test: `tests/components/passkey-manager.test.tsx`

**Interfaces:**
- Consumes: Task 6 management API and current `useAuth()` user/role.
- Produces: self-service «Mis passkeys» modal and superadmin user-scoped management action.

- [ ] **Step 1: Write failing management UI tests**

Test list loading, synchronized/single-device labels, dates, rename, confirmation before revoke, empty state, API error, current-user endpoint and superadmin `userId` query.

- [ ] **Step 2: Run test and verify failure**

Run: `npx vitest run tests/components/passkey-manager.test.tsx`

- [ ] **Step 3: Implement the reusable manager and entry points**

The header adds «Mis passkeys». `UsersEditorSection` shows «Passkeys» only to superadmin and opens the same component with `targetUserId`. Registration from this modal asks for the current account password through `/reauth` before starting Task 4.

- [ ] **Step 4: Run focused tests, TypeScript and lint**

Run: `npx vitest run tests/components/passkey-manager.test.tsx && npx tsc --noEmit && npx eslint src/components/auth/PasskeyManagerModal.tsx src/components/layout/Header.tsx src/edit/components/UsersEditorSection.tsx`

- [ ] **Step 5: Commit**

```powershell
git add src/components/auth src/components/layout/Header.tsx src/edit/components/UsersEditorSection.tsx tests/components/passkey-manager.test.tsx
git commit -m "feat: add passkey management UI"
```

### Task 10: Preserve QR authorization and complete verification

**Files:**
- Modify: `src/app/api/device-link/create/route.ts`
- Modify: `src/app/api/device-link/approve/route.ts`
- Modify: `src/app/api/device-link/reject/route.ts`
- Modify: `src/app/api/device-link/sessions/route.ts`
- Modify: `src/components/modals/DeviceLinkModal.tsx`
- Create: `tests/device-link/server-session-auth.test.ts`
- Modify: `.env` documentation only if a tracked example exists; otherwise document required variables in the final handoff without exposing secrets.

**Interfaces:**
- Consumes: Task 2 `readAuthSession()`.
- Produces: QR management routes authorized by the secure cookie; QR claim/exchange/whoami behavior remains unchanged.

- [ ] **Step 1: Write failing QR regression tests**

Assert create/approve/reject/sessions accept a valid cookie session, reject missing/revoked sessions, and never accept the legacy client-generated bearer token fallback.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/device-link/server-session-auth.test.ts`

- [ ] **Step 3: Migrate QR management requests to cookie sessions**

Remove `Authorization` construction from `DeviceLinkModal`. Route handlers resolve the current user from the cookie. Leave QR exchange tokens and `tm_device_session` unchanged because they represent the independently authorized mobile session.

- [ ] **Step 4: Run the complete automated verification**

Run:

```powershell
npm test
node --test tests/daily-closing-email.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

- [ ] **Step 5: Inspect the built login manually**

Start `npm run dev`, open the login in a Chromium browser, verify both responsive states and use a virtual authenticator to register, authenticate and revoke. Record any physical-device checks that remain for Windows Hello, Android and iPhone/iPad rather than claiming they ran locally.

- [ ] **Step 6: Run final diff and secret checks**

Run:

```powershell
git diff --check
git status --short
rg -n "pricemaster_secret_2024|PRICE_MASTER_SESSION_SECRET.*\|\||privateKey|credentialPublicKey" src/lib/auth src/lib/passkeys src/app/api/auth
```

Expected: no whitespace errors, only intended files changed, no hard-coded session fallback, and public-key storage only inside the server repository.

- [ ] **Step 7: Commit**

```powershell
git add src/app/api/device-link src/components/modals/DeviceLinkModal.tsx tests/device-link
git commit -m "fix: secure device links with server sessions"
```

### Task 11: Final acceptance audit

**Files:**
- Modify only files required by failures discovered during this audit.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified implementation matching every criterion in the approved spec.

- [ ] **Step 1: Check each acceptance criterion against a test or manual observation**

Confirm password-only login, optional enrollment, no biometric persistence, discoverable multi-account login, synced-passkey metadata, IndexedDB recovery, immediate revocation, inactive-user rejection, independent QR operation and disabled registration button.

- [ ] **Step 2: Re-run the full verification after any correction**

Run: `npm test && node --test tests/daily-closing-email.test.mjs && npx tsc --noEmit && npm run lint && npm run build`

- [ ] **Step 3: Confirm repository state**

Run: `git status --short && git log --oneline -12`

- [ ] **Step 4: Commit audit corrections if any**

```powershell
git add --patch
git commit -m "fix: close passkey acceptance gaps"
```
