import { roundMoney2 } from "../helpers";

type CreditNoteUse = { id: string; appliedAmount: number };

export function resolveFcrRollbackAmounts(movement: {
  amountEgreso?: number;
  amountPayment?: number;
  cashDebit?: number;
  totalAppliedToInvoice?: number;
  roundingAbsorbed?: number;
  appliedCreditNotes?: CreditNoteUse[];
}): {
  cashRefund: number;
  invoiceReduction: number;
  creditNotesToRelease: CreditNoteUse[];
} {
  const legacyCash = Math.max(0, roundMoney2(movement.amountPayment ?? movement.amountEgreso));
  const cash = roundMoney2(movement.cashDebit);
  const total = roundMoney2(movement.totalAppliedToInvoice);
  const rounding = roundMoney2(movement.roundingAbsorbed);
  const notes = Array.isArray(movement.appliedCreditNotes) ? movement.appliedCreditNotes : [];
  const noteTotal = roundMoney2(notes.reduce((sum, note) => sum + roundMoney2(note.appliedAmount), 0));
  const hasCompleteApplication = Number.isFinite(movement.cashDebit) &&
    Number.isFinite(movement.totalAppliedToInvoice) &&
    Number.isFinite(movement.roundingAbsorbed) &&
    cash >= 0 && rounding >= 0 && total >= cash &&
    notes.every((note) => note.id && roundMoney2(note.appliedAmount) > 0) &&
    roundMoney2(cash + rounding + noteTotal) === total;
  if (!hasCompleteApplication) {
    // Historical payment movements may carry the invoice's cumulative NC list.
    return { cashRefund: legacyCash, invoiceReduction: legacyCash, creditNotesToRelease: [] };
  }
  return { cashRefund: cash, invoiceReduction: total, creditNotesToRelease: notes };
}
