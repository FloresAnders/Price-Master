import type { AppliedCreditNote, FacturaMovement } from "@/services/facturas";
import type { ManualCreditNoteDraft } from "../fondo/manualCreditNoteDrafts";
import type { PendingCreditNoteOption } from "../helpers";

const roundMoney2 = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

type ResolveInvoicePaymentCreditNotesParams = {
  balance: number;
  currency: "CRC" | "USD";
  selectedIds: string[];
  pendingCreditNotes: PendingCreditNoteOption[];
  manualCreditNotes: ManualCreditNoteDraft[];
};

export type InvoicePaymentCreditNoteResolution = {
  persistedNotes: AppliedCreditNote[];
  manualNotes: AppliedCreditNote[];
  total: number;
  requestedTotal: number;
  overLimit: boolean;
};

export function shouldKeepPendingCreditNotesLoaded(params: {
  movementModalOpen: boolean;
  pendingSectionOpen: boolean;
  paymentProviderCode: string;
}): boolean {
  return (
    params.movementModalOpen ||
    params.pendingSectionOpen ||
    Boolean(params.paymentProviderCode.trim())
  );
}

export function isInvoicePaymentApplicationValid(amounts: {
  cashDebit: number;
  totalAppliedToInvoice: number;
}): boolean {
  return (
    roundMoney2(amounts.cashDebit) >= 0 &&
    roundMoney2(amounts.totalAppliedToInvoice) > 0
  );
}

export function buildManualCreditNoteMovement(params: {
  id: string;
  company: string;
  invoice: FacturaMovement;
  note: AppliedCreditNote;
  createdAt: string;
  manager2?: string;
}): FacturaMovement {
  const amount = Math.max(0, roundMoney2(params.note.amount));
  const paidAmount = Math.min(
    amount,
    Math.max(0, roundMoney2(params.note.appliedAmount)),
  );
  const balanceDue = Math.max(0, roundMoney2(amount - paidAmount));

  return {
    id: params.id,
    empresa: params.company,
    accountId: params.invoice.accountId,
    amount,
    originalAmount: amount,
    amountEgreso: 0,
    amountIngreso: amount,
    amountPayment: paidAmount,
    paidAmount,
    balanceDue,
    amountDue: balanceDue,
    createdAt: params.createdAt,
    currency: params.note.currency === "USD" ? "USD" : "CRC",
    invoiceNumber: params.note.invoiceNumber,
    manager: params.invoice.manager,
    ...(params.manager2 ? { manager2: params.manager2 } : {}),
    notes: params.note.observation ?? "",
    invoiceDocType: "NC",
    paymentType: params.invoice.paymentType,
    providerCode: params.invoice.providerCode,
    paymentStatus: balanceDue === 0 ? "REBAJADA" : "PARCIAL",
    isPendingForClosing: balanceDue > 0,
  };
}

export function resolvePendingCreditNoteOptionsForInvoice(
  pendingCreditNotes: FacturaMovement[],
  target: FacturaMovement | null,
): PendingCreditNoteOption[] {
  if (!target) return [];

  return pendingCreditNotes
    .filter(
      (note) =>
        note.invoiceDocType === "NC" &&
        note.providerCode === target.providerCode &&
        note.currency === target.currency,
    )
    .map((note) => {
      const amount = Math.max(
        0,
        Math.abs(roundMoney2(note.originalAmount ?? note.amount)),
      );
      const paidAmount = Math.max(0, roundMoney2(note.paidAmount));
      const balanceDue = Math.max(
        0,
        Math.abs(roundMoney2(note.balanceDue ?? amount - paidAmount)),
      );

      return {
        id: note.id,
        invoiceNumber: note.invoiceNumber,
        amount,
        paidAmount,
        balanceDue,
        currency: note.currency === "USD" ? "USD" : "CRC",
      };
    });
}

export function resolveInvoicePaymentCreditNotes(
  params: ResolveInvoicePaymentCreditNotesParams,
): InvoicePaymentCreditNoteResolution {
  const selectedIds = new Set(params.selectedIds);
  const persistedNotes: AppliedCreditNote[] = params.pendingCreditNotes
    .filter(
      (note) =>
        selectedIds.has(note.id) && note.currency === params.currency,
    )
    .map((note) => {
      const amount = Math.max(0, roundMoney2(note.amount));
      return {
        id: note.id,
        invoiceNumber: note.invoiceNumber,
        amount,
        appliedAmount: Math.max(0, roundMoney2(note.balanceDue)),
        currency: params.currency,
      };
    })
    .filter((note) => note.appliedAmount > 0);

  const manualNotes: AppliedCreditNote[] = params.manualCreditNotes
    .filter((note) => selectedIds.has(note.id))
    .map((note) => {
      const amount = Math.max(0, roundMoney2(note.amount));
      return {
        id: note.id,
        invoiceNumber: note.invoiceNumber,
        amount,
        appliedAmount: amount,
        currency: params.currency,
        ...(note.observation ? { observation: note.observation } : {}),
      };
    })
    .filter((note) => note.appliedAmount > 0);

  const requestedTotal = roundMoney2(
    [...persistedNotes, ...manualNotes].reduce(
      (sum, note) => sum + note.appliedAmount,
      0,
    ),
  );
  const balance = Math.max(0, roundMoney2(params.balance));

  return {
    persistedNotes,
    manualNotes,
    total: requestedTotal,
    requestedTotal,
    overLimit: requestedTotal > balance,
  };
}
