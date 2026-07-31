# Deudas Internas QR Descarga Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add QR-based mobile download for paid internal-debt receipt images, matching the daily-closing export flow.

**Architecture:** Keep Firestore debt logic unchanged. Add a small pure helper module for paid-debt receipt data, filenames, and Storage paths, then wire `deudasinternas/page.tsx` to capture a receipt DOM node with `html2canvas`, download the PNG, upload it to Firebase Storage, and show a QR modal.

**Tech Stack:** Next.js 16, React 19, TypeScript, `html2canvas`, `qrcode`, Firebase Storage, `lucide-react`, npm scripts.

## Global Constraints

- Apply only when `selectedDebtIsPaid` is true.
- Do not change the `internalDebts` Firestore schema.
- Do not add dependencies.
- Use Firebase Storage path `exports/internal-debts/...`.
- QR encodes the Firebase Storage download URL.
- The QR URL is public to anyone with the code, same as daily closing.
- Ignore unrelated dirty worktree changes.

---

## File Structure

- Create `src/app/fondogeneral/deudasinternas/paidDebtReceipt.ts`
  - Pure data shaping and filename/path helpers.
- Create `scripts/test-paid-internal-debt-receipt.mjs`
  - Node assertion test for helper behavior.
- Modify `src/app/fondogeneral/deudasinternas/page.tsx`
  - Import QR, Storage, icons, helpers.
  - Add paid receipt capture state and handlers.
  - Add hidden receipt capture DOM.
  - Add paid-detail buttons and QR modal.

### Task 1: Paid-Debt Receipt Helper

**Files:**
- Create: `scripts/test-paid-internal-debt-receipt.mjs`
- Create: `src/app/fondogeneral/deudasinternas/paidDebtReceipt.ts`

**Interfaces:**
- Produces:
  - `PaidInternalDebtReceiptData`
  - `buildPaidInternalDebtReceiptData(debt: InternalDebt, exportedAt?: Date): PaidInternalDebtReceiptData`
  - `buildPaidInternalDebtReceiptFileName(data: Pick<PaidInternalDebtReceiptData, "debtorName" | "creditorName" | "debtDate" | "exportedAtISO">): string`
  - `buildPaidInternalDebtReceiptStoragePath(fileName: string, timestamp?: number): string`
- Consumes: `InternalDebt` type from `@/services/internal-debts`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-paid-internal-debt-receipt.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs
  .readFileSync("src/app/fondogeneral/deudasinternas/paidDebtReceipt.ts", "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/\bexport\s+/g, "");

const compiled = ts.transpileModule(
`${source}
globalThis.__paidDebtReceiptTest = {
  buildPaidInternalDebtReceiptData,
  buildPaidInternalDebtReceiptFileName,
  buildPaidInternalDebtReceiptStoragePath,
};`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

const context = {};
vm.createContext(context);
vm.runInContext(compiled, context);

const {
  buildPaidInternalDebtReceiptData,
  buildPaidInternalDebtReceiptFileName,
  buildPaidInternalDebtReceiptStoragePath,
} = context.__paidDebtReceiptTest;

const paidDebt = {
  id: "debt-1",
  ownerId: "owner-1",
  debtor: { type: "user", id: "debtor-1", name: "Ana Maria", roleLabel: "Usuario" },
  creditor: { type: "user", id: "creditor-1", name: "Luis Nunez", roleLabel: "Admin" },
  participantIds: ["user:debtor-1", "user:creditor-1"],
  amountOriginal: 12500,
  balance: 0,
  reason: "Compra interna",
  reference: "FAC 001",
  date: "2026-07-31",
  status: "paid",
  movements: [
    {
      id: "m1",
      type: "charge",
      amount: 12500,
      reason: "Deuda inicial",
      date: "2026-07-31",
      createdAt: new Date("2026-07-31T08:00:00Z"),
      createdById: "debtor-1",
      createdByName: "Ana Maria",
    },
    {
      id: "m2",
      type: "payment",
      amount: 12500,
      reason: "Pago total",
      reference: "SINPE 123",
      date: "2026-07-31",
      createdAt: new Date("2026-07-31T09:00:00Z"),
      createdById: "creditor-1",
      createdByName: "Luis Nunez",
    },
  ],
  createdAt: new Date("2026-07-31T08:00:00Z"),
  updatedAt: new Date("2026-07-31T09:00:00Z"),
  createdById: "debtor-1",
  createdByName: "Ana Maria",
};

const data = buildPaidInternalDebtReceiptData(
  paidDebt,
  new Date("2026-07-31T18:30:00.000Z"),
);

assert.equal(data.title, "Comprobante de deuda pagada");
assert.equal(data.routeLabel, "Ana Maria debe a Luis Nunez");
assert.equal(data.statusLabel, "Pagada");
assert.equal(data.amountOriginal, 12500);
assert.equal(data.balance, 0);
assert.equal(data.reference, "FAC 001");
assert.equal(data.exportedAtISO, "2026-07-31T18:30:00.000Z");
assert.equal(data.movements.length, 2);
assert.equal(data.movements[0].typeLabel, "Cargo");
assert.equal(data.movements[0].signedAmountPrefix, "+");
assert.equal(data.movements[1].typeLabel, "Abono");
assert.equal(data.movements[1].signedAmountPrefix, "-");
assert.equal(data.movements[1].reference, "SINPE 123");

assert.equal(
  buildPaidInternalDebtReceiptFileName(data),
  "DeudaInternaPagada-Ana_Maria-Luis_Nunez-2026-07-31.png",
);
assert.equal(
  buildPaidInternalDebtReceiptStoragePath("recibo.png", 1775000000000),
  "exports/internal-debts/1775000000000_recibo.png",
);

console.log("paid internal debt receipt tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-paid-internal-debt-receipt.mjs`

Expected: FAIL with `ENOENT` for `paidDebtReceipt.ts`, because helper does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/fondogeneral/deudasinternas/paidDebtReceipt.ts`:

```typescript
import type { InternalDebt } from "@/services/internal-debts";

export interface PaidInternalDebtReceiptMovement {
  id: string;
  typeLabel: "Cargo" | "Abono";
  signedAmountPrefix: "+" | "-";
  amount: number;
  reason: string;
  reference: string;
  date: string;
  createdByName: string;
}

export interface PaidInternalDebtReceiptData {
  id: string;
  title: string;
  routeLabel: string;
  debtorName: string;
  creditorName: string;
  amountOriginal: number;
  balance: number;
  reason: string;
  reference: string;
  debtDate: string;
  statusLabel: "Pagada" | "Abierta";
  movements: PaidInternalDebtReceiptMovement[];
  exportedAtISO: string;
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeFileNamePart(value: string): string {
  const cleaned = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return cleaned || "sin_nombre";
}

export function buildPaidInternalDebtReceiptData(
  debt: InternalDebt,
  exportedAt = new Date(),
): PaidInternalDebtReceiptData {
  const balance = Number(debt.balance || 0);
  return {
    id: cleanText(debt.id),
    title: "Comprobante de deuda pagada",
    routeLabel: `${cleanText(debt.debtor.name)} debe a ${cleanText(debt.creditor.name)}`,
    debtorName: cleanText(debt.debtor.name),
    creditorName: cleanText(debt.creditor.name),
    amountOriginal: Number(debt.amountOriginal || 0),
    balance,
    reason: cleanText(debt.reason),
    reference: cleanText(debt.reference),
    debtDate: cleanText(debt.date),
    statusLabel: debt.status === "paid" || balance <= 0 ? "Pagada" : "Abierta",
    movements: (debt.movements || []).map((movement) => ({
      id: cleanText(movement.id),
      typeLabel: movement.type === "payment" ? "Abono" : "Cargo",
      signedAmountPrefix: movement.type === "payment" ? "-" : "+",
      amount: Number(movement.amount || 0),
      reason: cleanText(movement.reason),
      reference: cleanText(movement.reference),
      date: cleanText(movement.date),
      createdByName: cleanText(movement.createdByName),
    })),
    exportedAtISO: exportedAt.toISOString(),
  };
}

export function buildPaidInternalDebtReceiptFileName(
  data: Pick<
    PaidInternalDebtReceiptData,
    "debtorName" | "creditorName" | "debtDate" | "exportedAtISO"
  >,
): string {
  const datePart = sanitizeFileNamePart(data.debtDate || data.exportedAtISO.slice(0, 10));
  return [
    "DeudaInternaPagada",
    sanitizeFileNamePart(data.debtorName),
    sanitizeFileNamePart(data.creditorName),
    datePart,
  ].join("-") + ".png";
}

export function buildPaidInternalDebtReceiptStoragePath(
  fileName: string,
  timestamp = Date.now(),
): string {
  return `exports/internal-debts/${timestamp}_${fileName}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-paid-internal-debt-receipt.mjs`

Expected: PASS and output `paid internal debt receipt tests passed`.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-paid-internal-debt-receipt.mjs src/app/fondogeneral/deudasinternas/paidDebtReceipt.ts
git commit -m "Add paid internal debt receipt helpers"
```

### Task 2: Paid-Debt QR Download UI

**Files:**
- Modify: `src/app/fondogeneral/deudasinternas/page.tsx`

**Interfaces:**
- Consumes:
  - `buildPaidInternalDebtReceiptData`
  - `buildPaidInternalDebtReceiptFileName`
  - `buildPaidInternalDebtReceiptStoragePath`
- Produces:
  - Paid detail image download button.
  - Paid detail mobile QR download button.
  - QR modal with direct download fallback.

- [ ] **Step 1: Write failing check**

Run: `npm run lint`

Expected: PASS before edits. This establishes baseline because no React component test harness exists.

- [ ] **Step 2: Add imports and state**

In `src/app/fondogeneral/deudasinternas/page.tsx`:

```typescript
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Download,
  Eye,
  Loader2,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  Smartphone,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/config/firebase";
import {
  buildPaidInternalDebtReceiptData,
  buildPaidInternalDebtReceiptFileName,
  buildPaidInternalDebtReceiptStoragePath,
} from "./paidDebtReceipt";
```

Inside `DeudasInternasPage` state block:

```typescript
const paidDebtReceiptRef = useRef<HTMLDivElement | null>(null);
const paidDebtDownloadRequestRef = useRef(0);
const [receiptDownloading, setReceiptDownloading] = useState(false);
const [receiptMobileDownloading, setReceiptMobileDownloading] = useState(false);
const [showReceiptQrModal, setShowReceiptQrModal] = useState(false);
const [receiptQrCodeDataUrl, setReceiptQrCodeDataUrl] = useState("");
const [receiptDownloadUrl, setReceiptDownloadUrl] = useState("");
const [receiptDownloadFileName, setReceiptDownloadFileName] = useState("");
const [receiptDownloadError, setReceiptDownloadError] = useState("");
```

- [ ] **Step 3: Add capture/download handlers**

Add below `handleAddMovement`:

```typescript
const selectedPaidDebtReceipt = useMemo(
  () =>
    selectedDebt && selectedDebtIsPaid
      ? buildPaidInternalDebtReceiptData(selectedDebt)
      : null,
  [selectedDebt, selectedDebtIsPaid],
);

const resetPaidDebtReceiptDownload = useCallback(() => {
  setReceiptDownloading(false);
  setReceiptMobileDownloading(false);
  setShowReceiptQrModal(false);
  setReceiptQrCodeDataUrl("");
  setReceiptDownloadUrl("");
  setReceiptDownloadFileName("");
  setReceiptDownloadError("");
}, []);

const closeSelectedDebt = useCallback(() => {
  paidDebtDownloadRequestRef.current += 1;
  resetPaidDebtReceiptDownload();
  setSelectedDebt(null);
}, [resetPaidDebtReceiptDownload]);
```

Then add `downloadBlob`, `capturePaidDebtReceiptImage`, `handlePaidDebtImageDownload`, `handlePaidDebtMobileDownload`, `handlePaidDebtDirectDownload`, and `handleClosePaidDebtQrModal` using the daily-closing pattern.

- [ ] **Step 4: Add hidden receipt DOM**

Inside `{selectedDebt && (...)}`, render an offscreen white receipt when `selectedPaidDebtReceipt` exists:

```tsx
{selectedPaidDebtReceipt && (
  <div className="fixed left-[-10000px] top-0 w-[760px]" aria-hidden="true">
    <div ref={paidDebtReceiptRef} className="w-[760px] bg-white p-8 font-sans text-slate-950">
      {/* receipt fields and movements */}
    </div>
  </div>
)}
```

- [ ] **Step 5: Add paid-detail buttons and QR modal**

Replace the paid read-only footer with:

```tsx
{selectedDebtIsPaid ? (
  <div className="space-y-3">
    {receiptDownloadError ? <div className="text-sm text-red-300">{receiptDownloadError}</div> : null}
    <div className="flex flex-col justify-end gap-2 sm:flex-row">
      <button type="button" onClick={handlePaidDebtImageDownload}>Descargar imagen</button>
      <button type="button" onClick={handlePaidDebtMobileDownload}>Descarga movil</button>
      <button type="button" onClick={closeSelectedDebt}>Cerrar</button>
    </div>
  </div>
) : (
  <div className="flex justify-end">
    <button type="button" onClick={closeSelectedDebt}>Cerrar</button>
  </div>
)}
```

Render QR modal when `showReceiptQrModal` is true.

- [ ] **Step 6: Run validation**

Run:

```bash
node scripts/test-paid-internal-debt-receipt.mjs
npm run lint
npm run build
```

Expected:
- helper test passes.
- lint passes.
- build passes or reports environment-specific Firebase config issue.

- [ ] **Step 7: Commit**

```bash
git add src/app/fondogeneral/deudasinternas/page.tsx
git commit -m "Add QR download for paid internal debts"
```
