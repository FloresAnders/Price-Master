import { describe, expect, it } from "vitest";
import { resolveFcrRollbackAmounts } from "@/app/fondogeneral/utils/invoicePayment/fcrRollbackAmounts";

describe("resolveFcrRollbackAmounts", () => {
  it("reverses the full invoice application while refunding only cash", () => {
    expect(resolveFcrRollbackAmounts({
      amountEgreso: 23_000, cashDebit: 23_000,
      totalAppliedToInvoice: 27_250, roundingAbsorbed: 690,
      appliedCreditNotes: [{ id: "NC-1", appliedAmount: 3_560 }],
    })).toEqual({ cashRefund: 23_000, invoiceReduction: 27_250,
      creditNotesToRelease: [{ id: "NC-1", appliedAmount: 3_560 }] });
  });

  it("reverses only this partial application and its own NC", () => {
    expect(resolveFcrRollbackAmounts({
      amountEgreso: 5_000, cashDebit: 5_000,
      totalAppliedToInvoice: 6_250, roundingAbsorbed: 250,
      appliedCreditNotes: [{ id: "NC-2", appliedAmount: 1_000 }],
    })).toEqual({ cashRefund: 5_000, invoiceReduction: 6_250,
      creditNotesToRelease: [{ id: "NC-2", appliedAmount: 1_000 }] });
  });

  it("uses conservative cash-only rollback for legacy movements with cumulative NC", () => {
    expect(resolveFcrRollbackAmounts({
      amountEgreso: 23_000,
      appliedCreditNotes: [{ id: "OLD-NC", appliedAmount: 3_560 }],
    })).toEqual({ cashRefund: 23_000, invoiceReduction: 23_000, creditNotesToRelease: [] });
  });
});
