# Gente Crystal Sales in Tiempos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display company-scoped Gente Crystal daily sales in the Tiempos column with a date selector, summary totals, ticket detail, and server-enforced role authorization.

**Architecture:** Add pure read-domain helpers and a Firebase Admin reader, expose them through a session-authenticated GET on the existing integration route, then add a focused client API plus company-selection helpers and a Tiempos sales panel. Keep both integration collections server-only and preserve the Tucan placeholder.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase Admin/Firestore, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-12-gente-crystal-tiempos-display-design.md`

## Global Constraints

- The existing device-authenticated `POST /api/integrations/gente-crystal/sales` contract must remain unchanged.
- `genteCrystalSales` and `genteCrystalIntegrationDevices` remain denied to the Firebase web client.
- Daily ranges use `America/Costa_Rica` (`UTC-06:00`) and half-open `[start, end)` bounds.
- Regular users require `permissions.tiempos === true`; admins and superadmins retain privileged access.
- The server must validate the fresh user and company documents and never trust client role or owner data.
- Deleted tombstones never appear and never contribute to totals.
- No new runtime dependencies, pagination, cross-company aggregation, editing, or deletion UI.
- The Tucan panel remains unchanged.

---

### Task 1: Daily Read Domain and Firestore Reader

**Files:**
- Create: `src/lib/gente-crystal/read-sales.ts`
- Create: `src/lib/gente-crystal/read-sales.test.ts`
- Create: `src/lib/gente-crystal/firestore-sales-reader.ts`
- Create: `src/lib/gente-crystal/firestore-sales-reader.test.ts`

**Interfaces:**
- Consumes: Firestore records written under `genteCrystalSales/{companyId}/sales/{ticketId}` by the existing POST path.
- Produces: `buildCostaRicaDayRange(date)`, `canReadGenteCrystalCompany(user, company)`, `buildGenteCrystalDailyResult(records)`, `GenteCrystalSalesReader.listDaily(companyId, range)`, and `FirestoreGenteCrystalSalesReader`.

- [ ] **Step 1: Write failing tests for date validation, authorization, filtering, sorting, and totals**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCostaRicaDayRange,
  buildGenteCrystalDailyResult,
  canReadGenteCrystalCompany,
} from "./read-sales.ts";

test("Costa Rica dates become exact UTC half-open ranges", () => {
  assert.deepEqual(buildCostaRicaDayRange("2026-08-12"), {
    date: "2026-08-12",
    start: new Date("2026-08-12T06:00:00.000Z"),
    end: new Date("2026-08-13T06:00:00.000Z"),
  });
  assert.throws(() => buildCostaRicaDayRange("2026-02-30"), /invalid_date/);
});

test("company access follows regular, admin, and superadmin scopes", () => {
  const company = { id: "DELIKOR PALMARES", name: "DELIKOR PALMARES", ubicacion: "PALMARES", ownerId: "owner-1" };
  assert.equal(canReadGenteCrystalCompany({ role: "user", ownercompanie: "PALMARES", permissions: { tiempos: true } }, company), true);
  assert.equal(canReadGenteCrystalCompany({ id: "admin-1", role: "admin", ownerId: "owner-1", eliminate: true }, company), true);
  assert.equal(canReadGenteCrystalCompany({ role: "superadmin" }, company), true);
  assert.equal(canReadGenteCrystalCompany({ role: "user", ownercompanie: "OTRA", permissions: { tiempos: true } }, company), false);
});

test("daily results exclude tombstones, sort newest first, and sum active sales", () => {
  const result = buildGenteCrystalDailyResult([
    { ticketId: "41807-2204-59177102", sorteo: "TICA TARDE", monto: 100, saleAt: new Date("2026-08-13T03:31:00Z"), status: "active" },
    { ticketId: "41807-2204-59177103", sorteo: "TICA TARDE", monto: 50, saleAt: new Date("2026-08-13T02:31:00Z"), status: "deleted" },
    { ticketId: "41807-2204-59177104", sorteo: "TICA NOCHE", monto: 200, saleAt: new Date("2026-08-13T04:31:00Z"), status: "active" },
  ]);
  assert.deepEqual(result.summary, { count: 2, total: 300 });
  assert.deepEqual(result.sales.map((sale) => sale.ticketId), ["41807-2204-59177104", "41807-2204-59177102"]);
});
```

- [ ] **Step 2: Run the domain tests and verify RED**

Run: `node --test src/lib/gente-crystal/read-sales.test.ts`

Expected: FAIL because `read-sales.ts` and its exports do not exist.

- [ ] **Step 3: Implement the pure domain contract**

```ts
export const GENTE_CRYSTAL_TIMEZONE = "America/Costa_Rica" as const;

export type GenteCrystalReadUser = {
  id?: string;
  role?: "admin" | "user" | "superadmin";
  ownerId?: string;
  ownercompanie?: string;
  eliminate?: boolean;
  isActive?: boolean;
  permissions?: { tiempos?: boolean };
};

export type GenteCrystalReadCompany = {
  id: string;
  name?: string;
  ubicacion?: string;
  ownerId?: string;
};

export type GenteCrystalDayRange = {
  date: string;
  start: Date;
  end: Date;
};

export type GenteCrystalDailyResult = {
  summary: { count: number; total: number };
  sales: Array<{
    ticketId: string;
    sorteo: string;
    monto: number;
    saleAt: string;
  }>;
};

export function buildCostaRicaDayRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid_date");
  const midday = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(midday.getTime()) || midday.toISOString().slice(0, 10) !== date) throw new Error("invalid_date");
  const start = new Date(`${date}T00:00:00-06:00`);
  return { date, start, end: new Date(start.getTime() + 86_400_000) };
}
```

Implement `canReadGenteCrystalCompany` with normalized exact candidates for ID/name/location, admin owner IDs `{ownerId, id when eliminate === false}`, and unrestricted superadmin access. Implement `buildGenteCrystalDailyResult` to validate public fields, exclude non-active records, serialize `saleAt` to ISO, sort descending, and calculate count/total.

- [ ] **Step 4: Run the domain tests and verify GREEN**

Run: `node --test src/lib/gente-crystal/read-sales.test.ts`

Expected: PASS for date, authorization, filtering, ordering, and totals.

- [ ] **Step 5: Write a failing Firestore reader test that records the exact query**

```ts
test("reader queries one company and one half-open saleAt range", async () => {
  const fake = new FakeFirestore([{ ticketId: "41807-2204-59177102", status: "active", sorteo: "TICA TARDE", monto: 100, saleAt: new Date("2026-08-13T03:31:00Z") }]);
  const reader = new FirestoreGenteCrystalSalesReader(fake as never);
  const range = buildCostaRicaDayRange("2026-08-12");
  const result = await reader.listDaily("DELIKOR PALMARES", range);
  assert.deepEqual(fake.operations, [
    ["collection", "genteCrystalSales"],
    ["doc", "DELIKOR PALMARES"],
    ["collection", "sales"],
    ["where", "saleAt", ">=", range.start],
    ["where", "saleAt", "<", range.end],
    ["orderBy", "saleAt", "desc"],
    ["get"],
  ]);
  assert.deepEqual(result.summary, { count: 1, total: 100 });
});
```

- [ ] **Step 6: Run the reader test and verify RED**

Run: `node --test src/lib/gente-crystal/firestore-sales-reader.test.ts`

Expected: FAIL because `FirestoreGenteCrystalSalesReader` does not exist.

- [ ] **Step 7: Implement the reader**

```ts
export interface GenteCrystalSalesReader {
  listDaily(companyId: string, range: GenteCrystalDayRange): Promise<GenteCrystalDailyResult>;
}

export class FirestoreGenteCrystalSalesReader implements GenteCrystalSalesReader {
  constructor(private readonly firestore: Firestore) {}

  async listDaily(companyId: string, range: GenteCrystalDayRange) {
    const snapshot = await this.firestore.collection("genteCrystalSales").doc(companyId).collection("sales")
      .where("saleAt", ">=", range.start).where("saleAt", "<", range.end).orderBy("saleAt", "desc").get();
    return buildGenteCrystalDailyResult(snapshot.docs.map((doc) => doc.data()));
  }
}
```

- [ ] **Step 8: Run both focused tests and commit**

Run: `node --test src/lib/gente-crystal/read-sales.test.ts src/lib/gente-crystal/firestore-sales-reader.test.ts`

Expected: PASS.

```bash
git add src/lib/gente-crystal/read-sales.ts src/lib/gente-crystal/read-sales.test.ts src/lib/gente-crystal/firestore-sales-reader.ts src/lib/gente-crystal/firestore-sales-reader.test.ts
git commit -m "feat: read daily Gente Crystal sales"
```

### Task 2: Session-Authenticated GET Route

**Files:**
- Create: `src/app/api/integrations/gente-crystal/sales/read-route.ts`
- Create: `src/app/api/integrations/gente-crystal/sales/read-route.test.ts`
- Modify: `src/app/api/integrations/gente-crystal/sales/route.ts`

**Interfaces:**
- Consumes: Task 1's range builder, access predicate, reader, `readUserIdFromSessionCookie`, and `getAdminDb()`.
- Produces: `createGenteCrystalSalesGet(dependencies)` and exported `GET(request)` without changing exported `POST`.

- [ ] **Step 1: Write failing route tests for populated, empty, and denied requests**

```ts
test("authorized GET returns the public daily contract", async () => {
  const GET = createGenteCrystalSalesGet({
    readUserId: () => "user-1",
    getUser: async () => ({ role: "user", isActive: true, ownercompanie: "PALMARES", permissions: { tiempos: true } }),
    getCompany: async () => ({ id: "DELIKOR PALMARES", name: "DELIKOR PALMARES", ubicacion: "PALMARES", ownerId: "owner-1" }),
    createReader: () => ({ listDaily: async () => ({ summary: { count: 1, total: 100 }, sales: [{ ticketId: "41807-2204-59177102", sorteo: "TICA TARDE", monto: 100, saleAt: "2026-08-13T03:31:00.000Z" }] }) }),
  });
  const response = await GET(new Request("http://localhost/api/integrations/gente-crystal/sales?companyId=DELIKOR%20PALMARES&date=2026-08-12", { headers: { cookie: "pricemaster_auth=signed" } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).summary.total, 100);
});
```

Add separate concrete requests for invalid date/company (`400`), missing session and inactive/unknown users (`401`), forged company or missing permission (`403`), an empty authorized result (`200`), and an unexpected reader error (`500` with `internal_server_error`). Each denial asserts `listDaily` was not called.

- [ ] **Step 2: Run the route tests and verify RED**

Run: `node --test src/app/api/integrations/gente-crystal/sales/read-route.test.ts`

Expected: FAIL because `read-route.ts` does not exist.

- [ ] **Step 3: Implement the injected GET handler**

```ts
export function createGenteCrystalSalesGet(deps: GenteCrystalSalesGetDependencies) {
  return async function GET(request: Request) {
    try {
      const url = new URL(request.url);
      const companyId = readCompanyDocumentId(url.searchParams.get("companyId"));
      const range = buildCostaRicaDayRange(url.searchParams.get("date") || "");
      const userId = deps.readUserId(request.headers.get("cookie"));
      if (!userId) return jsonError("unauthorized", 401);
      const user = await deps.getUser(userId);
      if (!user?.isActive) return jsonError("unauthorized", 401);
      const company = await deps.getCompany(companyId);
      if (!company || !canReadGenteCrystalCompany({ ...user, id: userId }, company)) return jsonError("forbidden", 403);
      const result = await deps.createReader().listDaily(companyId, range);
      return NextResponse.json({ ok: true, companyId, date: range.date, timezone: GENTE_CRYSTAL_TIMEZONE, ...result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (isReadValidationError(error)) return jsonError(error.code, 400);
      deps.logError?.("gente-crystal/sales read error:", error);
      return jsonError("internal_server_error", 500);
    }
  };
}
```

Keep validation errors typed so only invalid query input maps to `400`; Firestore failures remain `500`.

- [ ] **Step 4: Wire GET into the Next route**

```ts
export const GET = createGenteCrystalSalesGet({
  readUserId: readUserIdFromSessionCookie,
  getUser: async (userId) => {
    const snapshot = await getAdminDb().collection("users").doc(userId).get();
    return snapshot.exists ? snapshot.data() ?? null : null;
  },
  getCompany: async (companyId) => {
    const snapshot = await getAdminDb().collection("empresas").doc(companyId).get();
    return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
  },
  createReader: () => new FirestoreGenteCrystalSalesReader(getAdminDb()),
});
```

- [ ] **Step 5: Run read and existing write route tests, then commit**

Run: `node --test src/app/api/integrations/gente-crystal/sales/read-route.test.ts src/app/api/integrations/gente-crystal/sales/route.test.ts`

Expected: all GET and existing POST tests PASS.

```bash
git add src/app/api/integrations/gente-crystal/sales/read-route.ts src/app/api/integrations/gente-crystal/sales/read-route.test.ts src/app/api/integrations/gente-crystal/sales/route.ts
git commit -m "feat: expose authorized Gente Crystal sales reads"
```

### Task 3: Client Contract and Allowed Company Selection

**Files:**
- Create: `src/services/gente-crystal-sales.ts`
- Create: `src/app/fondogeneral/components/genteCrystalTiempos.ts`
- Create: `src/app/fondogeneral/components/genteCrystalTiempos.test.ts`

**Interfaces:**
- Consumes: existing `Empresas`, `User`, `fg_selected_company_shared`, and Task 2's JSON response.
- Produces: `GenteCrystalDailySalesResponse`, `GenteCrystalSalesClient.getDaily`, `buildGenteCrystalCompanyOptions`, `resolveGenteCrystalCompanySelection`, and `currentCostaRicaDate`.

- [ ] **Step 1: Write failing tests for role-scoped options and stored selection**

```ts
test("regular users receive only the assigned company", () => {
  const options = buildGenteCrystalCompanyOptions({ role: "user", ownercompanie: "PALMARES" }, [palmares, sanVito], []);
  assert.deepEqual(options.map((option) => option.value), ["DELIKOR PALMARES"]);
});

test("admins are owner scoped and superadmins receive all companies", () => {
  assert.deepEqual(buildGenteCrystalCompanyOptions({ id: "admin-1", role: "admin", ownerId: "owner-1", eliminate: true }, [palmares, sanVito], ["owner-1"]).map((option) => option.value), ["DELIKOR PALMARES"]);
  assert.equal(buildGenteCrystalCompanyOptions({ role: "superadmin" }, [palmares, sanVito], []).length, 2);
});

test("an unauthorized stored preference falls back to an allowed company", () => {
  assert.equal(resolveGenteCrystalCompanySelection("DELIKOR SAN VITO", "", [{ value: "DELIKOR PALMARES", label: "DELIKOR PALMARES" }]), "DELIKOR PALMARES");
});
```

- [ ] **Step 2: Run the selection tests and verify RED**

Run: `node --test src/app/fondogeneral/components/genteCrystalTiempos.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement company option and selection helpers**

```ts
export type GenteCrystalCompanyOption = { value: string; label: string };

export function buildGenteCrystalCompanyOptions(user: Partial<User>, companies: Empresas[], ownerIds: string[]): GenteCrystalCompanyOption[] {
  const key = (value: unknown) => String(value || "").trim().toLowerCase();
  const allowedOwners = new Set(ownerIds.map(key).filter(Boolean));
  const assigned = key(user.ownercompanie);
  return companies
    .filter((company) => {
      if (user.role === "superadmin") return true;
      if (user.role === "admin") return allowedOwners.has(key(company.ownerId));
      return [company.id, company.name, company.ubicacion].map(key).includes(assigned);
    })
    .filter((company) => Boolean(String(company.id || "").trim()))
    .map((company) => ({
      value: String(company.id).trim(),
      label: company.name && company.ubicacion && key(company.name) !== key(company.ubicacion)
        ? `${company.name} - ${company.ubicacion}`
        : String(company.name || company.ubicacion || company.id).trim(),
    }));
}

export function resolveGenteCrystalCompanySelection(stored: string, assigned: string, options: GenteCrystalCompanyOption[]): string {
  const key = (value: unknown) => String(value || "").trim().toLowerCase();
  const storedMatch = options.find((option) => key(option.value) === key(stored));
  if (storedMatch) return storedMatch.value;
  const assignedMatch = options.find((option) => key(option.value) === key(assigned));
  return assignedMatch?.value || options[0]?.value || "";
}

export function currentCostaRicaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
```

- [ ] **Step 4: Implement the typed client request**

```ts
export class GenteCrystalSalesClient {
  static async getDaily(companyId: string, date: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ companyId, date });
    const response = await fetch(`/api/integrations/gente-crystal/sales?${params}`, { method: "GET", credentials: "same-origin", cache: "no-store", signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new GenteCrystalSalesClientError(response.status, body?.error);
    return body as GenteCrystalDailySalesResponse;
  }
}
```

- [ ] **Step 5: Run tests, type-check focused modules, and commit**

Run: `node --test src/app/fondogeneral/components/genteCrystalTiempos.test.ts`

Run: `npx tsc --noEmit`

Expected: PASS.

```bash
git add src/services/gente-crystal-sales.ts src/app/fondogeneral/components/genteCrystalTiempos.ts src/app/fondogeneral/components/genteCrystalTiempos.test.ts
git commit -m "feat: resolve Gente Crystal company views"
```

### Task 4: Tiempos Daily Sales Panel

**Files:**
- Create: `src/app/fondogeneral/components/GenteCrystalTiemposPanel.tsx`
- Modify: `src/app/fondogeneral/components/TiemposTucanSection.tsx`

**Interfaces:**
- Consumes: Task 3's client, response types, selection helpers, `useAuth`, `useActorOwnership`, and `EmpresasService`.
- Produces: the approved Tiempos summary/detail UI while preserving the Tucan panel.

- [ ] **Step 1: Add the parent client state and company resolution**

```tsx
"use client";

const STORAGE_KEY = "fg_selected_company_shared";

export function TiemposTucanSection() {
  const { user, loading } = useAuth();
  const { ownerIds } = useActorOwnership(user || {});
  const [options, setOptions] = useState<GenteCrystalCompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    EmpresasService.getAllEmpresas().then((companies) => {
      if (cancelled) return;
      const nextOptions = buildGenteCrystalCompanyOptions(user, companies, ownerIds);
      const stored = window.localStorage.getItem(STORAGE_KEY) || "";
      setOptions(nextOptions);
      setCompanyId(resolveGenteCrystalCompanySelection(stored, user.ownercompanie || "", nextOptions));
    });
    return () => { cancelled = true; };
  }, [ownerIds, user]);
}
```

Render a selector only for admin/superadmin. Render the selected label for a regular user. If the user lacks access or has no assigned company, render a clear scoped empty state instead of calling the API.

- [ ] **Step 2: Implement the focused panel with stale-request protection**

```tsx
export function GenteCrystalTiemposPanel({ companyId }: { companyId: string }) {
  const [date, setDate] = useState(() => currentCostaRicaDate());
  const [result, setResult] = useState<GenteCrystalDailySalesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    GenteCrystalSalesClient.getDaily(companyId, date, controller.signal)
      .then(setResult)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(messageForSalesError(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [companyId, date, refreshVersion]);

  useEffect(() => {
    if (date !== currentCostaRicaDate()) return;
    const timer = window.setInterval(() => setRefreshVersion((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [date]);
}
```

Use an effect-owned `AbortController` so company/date changes abort the previous request. Manual refresh uses the same request path without allowing a stale result to overwrite the current selection.

- [ ] **Step 3: Render the approved summary, table, and states**

```tsx
<div className="grid grid-cols-2 gap-3">
  <SummaryCard label="Total vendido" value={formatCRC(result?.summary.total ?? 0)} />
  <SummaryCard label="Tiquetes" value={String(result?.summary.count ?? 0)} />
</div>
```

Render controls for date and `Actualizar`; table columns `Hora`, `Sorteo`, `Tiquete`, and `Monto`; loading and empty rows; and exact messages:

- `No hay movimientos para esta fecha.`
- `Tu sesión expiró. Inicia sesión nuevamente.`
- `No tienes acceso a esta empresa.`
- `No se pudieron cargar los movimientos.`

Format sale time in `America/Costa_Rica` and CRC through `Intl.DateTimeFormat` and `Intl.NumberFormat`.

- [ ] **Step 4: Verify focused lint and type checking, then commit**

Run: `npx eslint src/app/fondogeneral/components/TiemposTucanSection.tsx src/app/fondogeneral/components/GenteCrystalTiemposPanel.tsx src/app/fondogeneral/components/genteCrystalTiempos.ts src/services/gente-crystal-sales.ts`

Run: `npx tsc --noEmit`

Expected: zero errors; existing project warnings may be reported separately.

```bash
git add src/app/fondogeneral/components/TiemposTucanSection.tsx src/app/fondogeneral/components/GenteCrystalTiemposPanel.tsx
git commit -m "feat: show Gente Crystal sales in Tiempos"
```

### Task 5: Full Verification and Documentation Alignment

**Files:**
- Modify only if verification exposes a defect: files from Tasks 1-4.

**Interfaces:**
- Consumes: all prior task deliverables.
- Produces: a production-buildable, regression-tested feature matching the approved spec.

- [ ] **Step 1: Run all Gente Crystal tests**

Run:

```bash
node --test src/lib/gente-crystal/*.test.ts src/app/api/integrations/gente-crystal/sales/*.test.ts src/app/fondogeneral/components/genteCrystalTiempos.test.ts
```

Expected: all tests PASS, including the pre-existing POST behavior.

- [ ] **Step 2: Run static validation**

Run:

```bash
npx tsc --noEmit
npx eslint src/lib/gente-crystal src/app/api/integrations/gente-crystal/sales src/app/fondogeneral/components/TiemposTucanSection.tsx src/app/fondogeneral/components/GenteCrystalTiemposPanel.tsx src/app/fondogeneral/components/genteCrystalTiempos.ts src/services/gente-crystal-sales.ts
git diff --check
```

Expected: zero errors and no whitespace failures.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully and lists the integration API route.

- [ ] **Step 4: Review the final diff against the spec**

Confirm in the diff that POST remains unchanged, GET uses cookie authentication and fresh Firestore authorization, only company ID/date come from the client, deleted records are excluded, role selection matches the spec, today's view polls at 30 seconds, past dates do not poll, and Tucan remains unchanged.

- [ ] **Step 5: Commit any verification-only correction**

If verification required a correction, rerun the failing command and commit only the corrected files:

```bash
git add src/lib/gente-crystal/read-sales.ts src/lib/gente-crystal/read-sales.test.ts src/lib/gente-crystal/firestore-sales-reader.ts src/lib/gente-crystal/firestore-sales-reader.test.ts src/app/api/integrations/gente-crystal/sales/read-route.ts src/app/api/integrations/gente-crystal/sales/read-route.test.ts src/app/api/integrations/gente-crystal/sales/route.ts src/services/gente-crystal-sales.ts src/app/fondogeneral/components/genteCrystalTiempos.ts src/app/fondogeneral/components/genteCrystalTiempos.test.ts src/app/fondogeneral/components/GenteCrystalTiemposPanel.tsx src/app/fondogeneral/components/TiemposTucanSection.tsx
git commit -m "fix: finalize Gente Crystal Tiempos view"
```
