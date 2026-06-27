import assert from "node:assert/strict";
import test from "node:test";

import { appendManualCreditNoteDraft } from "./manualCreditNoteDrafts.ts";

test("appendManualCreditNoteDraft keeps prior drafts and selects unique ids", () => {
  const first = appendManualCreditNoteDraft(
    [],
    { invoiceNumber: "10", amount: 5000 },
    [],
  );
  const second = appendManualCreditNoteDraft(
    first.drafts,
    { invoiceNumber: "11", amount: 7000, observation: "rebajo" },
    first.selectedIds,
  );

  assert.deepEqual(
    second.drafts.map((draft) => ({
      id: draft.id,
      invoiceNumber: draft.invoiceNumber,
      amount: draft.amount,
      observation: draft.observation,
    })),
    [
      {
        id: "manual-nc-draft-1",
        invoiceNumber: "10",
        amount: 5000,
        observation: undefined,
      },
      {
        id: "manual-nc-draft-2",
        invoiceNumber: "11",
        amount: 7000,
        observation: "rebajo",
      },
    ],
  );
  assert.deepEqual(second.selectedIds, [
    "manual-nc-draft-1",
    "manual-nc-draft-2",
  ]);
});
