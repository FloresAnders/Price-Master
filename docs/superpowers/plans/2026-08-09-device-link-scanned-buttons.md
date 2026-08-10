# Device Link Scanned Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable `Autorizar` and `Cancelar` in the device-link QR modal until the request status is `scanned`.

**Architecture:** Add a small pure status helper beside the modal for easy Node tests, then consume it inside `DeviceLinkModal`. Keep API behavior and `Rechazar` unchanged.

**Tech Stack:** React, TypeScript, Next.js, Node built-in test runner.

## Global Constraints

- Use status value `scanned`; `scaned` is not a codebase status.
- Disable `Autorizar` when QR is visible and `status !== "scanned"`.
- Disable `Cancelar` when QR is visible and `status !== "scanned"`.
- Enable both actions when `status === "scanned"`.
- Keep `Rechazar` unchanged.
- Add handler guards so disabled UI cannot be bypassed by accidental calls.
- Do not change API routes, Firestore data, request statuses, or deployment config.

---

### Task 1: Gate QR Actions By Scanned Status

**Files:**
- Create: `src/components/modals/deviceLinkModalState.ts`
- Create: `src/components/modals/deviceLinkModalState.test.ts`
- Modify: `src/components/modals/DeviceLinkModal.tsx`

**Interfaces:**
- Produces: `canApproveOrCancelDeviceLink(status: string | null): boolean`
- Consumes: `DeviceLinkModal` uses `canApproveOrCancelDeviceLink(status)` for button `disabled` state and handler guards.

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { canApproveOrCancelDeviceLink } from "./deviceLinkModalState.ts";

test("canApproveOrCancelDeviceLink disables actions before QR is scanned", () => {
  assert.equal(canApproveOrCancelDeviceLink(null), false);
  assert.equal(canApproveOrCancelDeviceLink("pending"), false);
});

test("canApproveOrCancelDeviceLink enables actions when QR is scanned", () => {
  assert.equal(canApproveOrCancelDeviceLink("scanned"), true);
});

test("canApproveOrCancelDeviceLink disables actions after terminal statuses", () => {
  assert.equal(canApproveOrCancelDeviceLink("approved"), false);
  assert.equal(canApproveOrCancelDeviceLink("rejected"), false);
  assert.equal(canApproveOrCancelDeviceLink("expired"), false);
  assert.equal(canApproveOrCancelDeviceLink("used"), false);
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --test src/components/modals/deviceLinkModalState.test.ts`
Expected: FAIL because `deviceLinkModalState.ts` does not exist.

- [ ] **Step 3: Implement helper**

```ts
export function canApproveOrCancelDeviceLink(status: string | null): boolean {
  return status === "scanned";
}
```

- [ ] **Step 4: Wire modal buttons and guards**

In `DeviceLinkModal.tsx`, import helper:

```ts
import { canApproveOrCancelDeviceLink } from "./deviceLinkModalState";
```

Compute:

```ts
const canActOnScannedRequest = canApproveOrCancelDeviceLink(status);
```

At start of `approveRequest`, use:

```ts
if (!requestId || !canActOnScannedRequest) return;
```

Create `cancelRequestDisplay` that returns early when `!canActOnScannedRequest`, clears polling, and resets QR request state.

Set `disabled={!canActOnScannedRequest}` on `Autorizar` and `Cancelar`. Add disabled classes `disabled:cursor-not-allowed disabled:opacity-50`.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `node --test src/components/modals/deviceLinkModalState.test.ts`
Expected: PASS for 3 tests.

- [ ] **Step 6: Run focused checks**

Run: `npx eslint src/components/modals/DeviceLinkModal.tsx src/components/modals/deviceLinkModalState.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/modals/DeviceLinkModal.tsx src/components/modals/deviceLinkModalState.ts src/components/modals/deviceLinkModalState.test.ts
git commit -m "fix: gate device link actions until scanned"
```
