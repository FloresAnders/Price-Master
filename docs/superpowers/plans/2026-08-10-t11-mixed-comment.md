# T11 Mixed Comment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional comment to T11 tickets created in Mixed mode and show it only on that ticket's card.

**Architecture:** Keep comment normalization and ticket creation in a small pure helper so the mode/code scope can be tested without rendering the large `TimingControl` component. `TimingControl` owns the draft comment and passes persisted tickets to `TicketCarousel`, which conditionally renders the normalized comment while leaving summaries, export, and editing unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Node.js test runner.

## Global Constraints

- Show the field only for T11 in Mixed mode.
- Place **Comentario (opcional)** between the amount field and **Agregar**.
- Trim leading and trailing whitespace before persistence.
- Omit `comment` when the value is empty or whitespace-only.
- Show the comment only on the corresponding ticket card.
- Do not show the comment in summaries, totals, exports, or edit fields.
- Preserve compatibility with existing tickets that have no `comment` property.
- Add no dependencies.

---

### Task 1: Tested ticket comment domain helper

**Files:**
- Create: `src/components/business/timing-control/ticketEntry.test.ts`
- Create: `src/components/business/timing-control/ticketEntry.ts`

**Interfaces:**
- Consumes: Ticket draft fields already produced by `TimingControl`.
- Produces: `TimingMode`, `TicketEntry`, `createTimingTicket(input): TicketEntry`, and `getVisibleTicketComment(comment): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createTimingTicket,
  getVisibleTicketComment,
} from "./ticketEntry.ts";

const baseTicket = {
  id: "ticket-1",
  code: "T11",
  sorteo: "TIEMPOS (COMODIN)",
  amount: 1500,
  time: "10:30:00",
};

test("T11 Mixed tickets persist a trimmed optional comment", () => {
  assert.deepEqual(
    createTimingTicket({
      ...baseTicket,
      timingMode: "mixto",
      comment: "  Pago pendiente  ",
    }),
    { ...baseTicket, comment: "Pago pendiente" },
  );
});

test("T11 Mixed tickets omit empty comments", () => {
  const ticket = createTimingTicket({
    ...baseTicket,
    timingMode: "mixto",
    comment: "   ",
  });

  assert.equal("comment" in ticket, false);
});

test("comments are ignored outside T11 Mixed entry", () => {
  assert.equal(
    "comment" in
      createTimingTicket({
        ...baseTicket,
        timingMode: "individual",
        comment: "No guardar",
      }),
    false,
  );
  assert.equal(
    "comment" in
      createTimingTicket({
        ...baseTicket,
        code: "T10",
        timingMode: "mixto",
        comment: "No guardar",
      }),
    false,
  );
});

test("ticket card comments support old and blank ticket values", () => {
  assert.equal(getVisibleTicketComment(undefined), null);
  assert.equal(getVisibleTicketComment("   "), null);
  assert.equal(getVisibleTicketComment("  Entregado  "), "Entregado");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/components/business/timing-control/ticketEntry.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `ticketEntry.ts`.

- [ ] **Step 3: Write the minimal helper implementation**

```ts
export type TimingMode = "mixto" | "individual";

export interface TicketEntry {
  id: string;
  code: string;
  sorteo: string;
  amount: number;
  time: string;
  comment?: string;
}

interface CreateTimingTicketInput extends TicketEntry {
  timingMode: TimingMode;
}

const normalizeOptionalComment = (comment?: string): string | undefined => {
  const normalized = comment?.trim();
  return normalized || undefined;
};

export function createTimingTicket({
  timingMode,
  comment,
  ...ticket
}: CreateTimingTicketInput): TicketEntry {
  if (timingMode !== "mixto" || ticket.code !== "T11") return ticket;

  const normalizedComment = normalizeOptionalComment(comment);
  return normalizedComment ? { ...ticket, comment: normalizedComment } : ticket;
}

export function getVisibleTicketComment(comment?: string): string | null {
  return normalizeOptionalComment(comment) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/components/business/timing-control/ticketEntry.test.ts`

Expected: 4 tests pass and 0 fail.

- [ ] **Step 5: Commit the helper and test**

```powershell
git add src/components/business/timing-control/ticketEntry.ts src/components/business/timing-control/ticketEntry.test.ts
git commit -m "test: define mixed T11 comment behavior"
```

### Task 2: Mixed T11 comment capture and persistence

**Files:**
- Modify: `src/components/business/TimingControl.tsx:1-460`
- Modify: `src/components/business/TimingControl.tsx:1280-1330`
- Test: `src/components/business/timing-control/ticketEntry.test.ts`

**Interfaces:**
- Consumes: `TimingMode`, `TicketEntry`, and `createTimingTicket` from Task 1.
- Produces: Mixed T11 tickets with an optional persisted `comment`; no other ticket path can persist it.

- [ ] **Step 1: Import the helper types and function, replacing the local duplicate types**

```ts
import {
  createTimingTicket,
  type TicketEntry,
  type TimingMode,
} from "./timing-control/ticketEntry";
```

Remove the local `TimingMode` type and `TicketEntry` interface, then keep `isTimingMode` using the imported type.

- [ ] **Step 2: Add and reset the comment draft state**

Add beside `modalAmount`:

```ts
const [modalComment, setModalComment] = useState("");
```

Call `setModalComment("")` from `resetModalStates`, `startCodeEntry`, and after a successful ticket addition.

- [ ] **Step 3: Create tickets through the tested helper**

Replace the object literal in `handleAddTicket` with:

```ts
const newTicket = createTimingTicket({
  id: Date.now().toString(),
  code: currentCode,
  sorteo: selectedSorteo,
  amount: Number(modalAmount),
  time: getNowTime(),
  timingMode,
  comment: modalComment,
});
```

- [ ] **Step 4: Place the optional field before the Mixed T11 Add button**

Keep the entire field inside `isMixedComodinEntry` and use the existing theme styles:

```tsx
<div>
  <label
    htmlFor="mixed-t11-comment"
    className="mb-2 block text-sm font-medium text-[var(--foreground)]"
  >
    Comentario (opcional):
  </label>
  <input
    id="mixed-t11-comment"
    type="text"
    className="h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--accent)]/60 focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
    value={modalComment}
    onChange={(event) => setModalComment(event.target.value)}
    onKeyDown={(event) => {
      if (event.key === "Enter") handleAddTicket();
    }}
    placeholder="Escribe un comentario"
  />
</div>
```

Restructure the current amount/button row as `className="flex flex-col gap-3"` so the order is amount, comment, button.

- [ ] **Step 5: Run focused tests and lint**

Run: `node --test src/components/business/timing-control/ticketEntry.test.ts`

Expected: 4 tests pass and 0 fail.

Run: `npx eslint src/components/business/TimingControl.tsx src/components/business/timing-control/ticketEntry.ts src/components/business/timing-control/ticketEntry.test.ts`

Expected: exit code 0 with no errors.

- [ ] **Step 6: Commit capture and persistence**

```powershell
git add src/components/business/TimingControl.tsx
git commit -m "feat: capture comments for mixed T11 tickets"
```

### Task 3: Ticket-card-only comment presentation

**Files:**
- Modify: `src/components/ui/TicketCarousel.tsx:1-360`
- Test: `src/components/business/timing-control/ticketEntry.test.ts`

**Interfaces:**
- Consumes: Optional `comment` persisted by Task 2 and `getVisibleTicketComment` from Task 1.
- Produces: Conditional card text; no summary, export, or edit-field changes.

- [ ] **Step 1: Extend the carousel ticket type and add a focused renderer**

```tsx
import { getVisibleTicketComment } from "../business/timing-control/ticketEntry";

interface Ticket {
  id: string;
  sorteo: string;
  amount: number;
  time: string;
  code?: string;
  comment?: string;
}

function TicketComment({ comment }: { comment?: string }) {
  const visibleComment = getVisibleTicketComment(comment);
  if (!visibleComment) return null;

  return (
    <p
      className="mt-1 max-w-full truncate text-center text-xs opacity-80"
      title={visibleComment}
    >
      {visibleComment}
    </p>
  );
}
```

- [ ] **Step 2: Render the comment on both card layouts**

Immediately after the amount block in the stacked-card layout and the all-cards layout, add:

```tsx
<TicketComment comment={ticket.comment} />
```

Do not add `comment` to `editFields`, summaries, or export markup. The existing `{ ...editTicket, ...editFields }` merge preserves the stored comment without making it editable.

- [ ] **Step 3: Run focused verification**

Run: `node --test src/components/business/timing-control/ticketEntry.test.ts`

Expected: 4 tests pass and 0 fail.

Run: `npx eslint src/components/business/TimingControl.tsx src/components/ui/TicketCarousel.tsx src/components/business/timing-control/ticketEntry.ts src/components/business/timing-control/ticketEntry.test.ts`

Expected: exit code 0 with no errors.

Run: `npx tsc --noEmit`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 4: Commit card presentation**

```powershell
git add src/components/ui/TicketCarousel.tsx
git commit -m "feat: show mixed T11 comments on ticket cards"
```

### Task 4: Final regression verification

**Files:**
- Verify: `src/components/business/TimingControl.tsx`
- Verify: `src/components/ui/TicketCarousel.tsx`
- Verify: `src/components/business/timing-control/ticketEntry.ts`
- Verify: `src/components/business/timing-control/ticketEntry.test.ts`

**Interfaces:**
- Consumes: Completed behavior from Tasks 1-3.
- Produces: Evidence that the focused tests, static analysis, and production build pass.

- [ ] **Step 1: Run all repository Node tests**

Run: `node --test "src/**/*.test.ts" "src/**/*.test.cjs"`

Expected: all discovered tests pass and 0 fail.

- [ ] **Step 2: Run lint on changed production and test files**

Run: `npx eslint src/components/business/TimingControl.tsx src/components/ui/TicketCarousel.tsx src/components/business/timing-control/ticketEntry.ts src/components/business/timing-control/ticketEntry.test.ts`

Expected: exit code 0 with no errors.

- [ ] **Step 3: Run the TypeScript compiler**

Run: `npx tsc --noEmit`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 5: Inspect the final diff for scope**

Run: `git diff HEAD~3 -- src/components/business/TimingControl.tsx src/components/ui/TicketCarousel.tsx src/components/business/timing-control/ticketEntry.ts src/components/business/timing-control/ticketEntry.test.ts`

Expected: only Mixed T11 comment capture, normalization, persistence, card presentation, and tests are present.
