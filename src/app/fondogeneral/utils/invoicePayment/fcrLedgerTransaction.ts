import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  FacturasService,
  withFacturaPendingForClosing,
  type AppliedCreditNote,
  type FacturaMovement,
} from "@/services/facturas";
import {
  MovimientosFondosService,
  type MovementAccountKey,
  type MovementStorage,
} from "@/services/movimientos-fondos";
import type { FondoEntry } from "../../types";
import { roundMoney2, stripUndefinedDeep } from "../helpers";
import { applyLedgerMovementMutation } from "../fondo/ledgerState";
import { resolveFacturaPaymentType } from "../../facturas/facturaPaymentType";

export type FcrPaymentApplication = {
  invoice: FacturaMovement;
  cashDebit: number;
  totalAppliedToInvoice: number;
  roundingAbsorbed: number;
  appliedCreditNotes?: AppliedCreditNote[];
  manualCreditNoteMovements?: FacturaMovement[];
  notes?: string;
  manager2?: string;
};

export type FcrPaymentCommit = {
  ledger: MovementStorage<FondoEntry>;
  invoices: FacturaMovement[];
  paymentMovements: FondoEntry[];
};

/** Reads every financial document again for each Firestore transaction attempt. */
export async function commitFcrPayments(input: {
  company: string;
  accountId: MovementAccountKey;
  nowISO: string;
  bypassPendingNightDailyClosing: boolean;
  applications: FcrPaymentApplication[];
}): Promise<FcrPaymentCommit> {
  const company = input.company.trim();
  if (!company || input.applications.length === 0) throw new Error("FCR_PAYMENT_REQUIRED");
  const docId = MovimientosFondosService.buildCompanyMovementsKey(company);
  const ledgerRef = doc(db, MovimientosFondosService.COLLECTION_NAME, docId);
  const invoiceIds = input.applications.map((item) => item.invoice.id);
  if (new Set(invoiceIds).size !== invoiceIds.length) throw new Error("FCR_DUPLICATE_INVOICE");
  // Generated once per call: Firestore may invoke the transaction callback repeatedly.
  const paymentIds = input.applications.map((item) =>
    `fcr-pago-${item.invoice.id}-${input.nowISO.replace(/[:.]/g, "-")}-${crypto.randomUUID()}`,
  );

  return runTransaction(db, async (transaction) => {
    const ledgerSnapshot = await transaction.get(ledgerRef);
    const invoiceRefs = invoiceIds.map((id) => FacturasService.buildMovementRef(company, id));
    const invoiceSnapshots = await Promise.all(invoiceRefs.map((ref) => transaction.get(ref)));
    const noteIds = [...new Set(input.applications.flatMap((item) =>
      (item.appliedCreditNotes ?? [])
        .filter((note) => !(item.manualCreditNoteMovements ?? []).some((manual) => manual.id === note.id))
        .map((note) => note.id),
    ))];
    const noteRefs = new Map(noteIds.map((id) => [id, FacturasService.buildMovementRef(company, id)]));
    const noteSnapshots = new Map(await Promise.all(noteIds.map(async (id) =>
      [id, await transaction.get(noteRefs.get(id)!)] as const,
    )));
    const manualIds = input.applications.flatMap((item) =>
      (item.manualCreditNoteMovements ?? []).map((manual) => manual.id));
    if (new Set(manualIds).size !== manualIds.length ||
      manualIds.some((id) => invoiceIds.includes(id) || noteIds.includes(id))) {
      throw new Error("FCR_CREDIT_NOTE_ID_COLLISION");
    }
    const manualRefs = manualIds.map((id) => FacturasService.buildMovementRef(company, id));
    const manualSnapshots = await Promise.all(manualRefs.map((ref) => transaction.get(ref)));
    const paymentRefs = input.applications.map((item, index) => item.cashDebit > 0
      ? MovimientosFondosService.buildMovementRef(docId, paymentIds[index], input.accountId)
      : null);
    const paymentSnapshots = await Promise.all(paymentRefs.map((ref) => ref ? transaction.get(ref) : null));
    if (invoiceSnapshots.some((snapshot) => !snapshot.exists())) throw new Error("FCR_INVOICE_NOT_FOUND");
    if ([...noteSnapshots.values()].some((snapshot) => !snapshot.exists())) throw new Error("FCR_CREDIT_NOTE_NOT_FOUND");
    if (paymentSnapshots.some((snapshot) => snapshot?.exists())) throw new Error("FCR_PAYMENT_ID_COLLISION");
    if (manualSnapshots.some((snapshot) => snapshot.exists())) throw new Error("FCR_CREDIT_NOTE_ID_COLLISION");

    let ledger = ledgerSnapshot.exists()
      ? MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(ledgerSnapshot.data(), company)
      : MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(company);
    const invoices: FacturaMovement[] = [];
    const paymentMovements: FondoEntry[] = [];
    const noteUse = new Map<string, number>();
    const invoiceWrites: Array<{ ref: ReturnType<typeof FacturasService.buildMovementRef>; data: FacturaMovement }> = [];
    const manualWrites: FacturaMovement[] = [];

    for (const [index, application] of input.applications.entries()) {
      const original = { ...invoiceSnapshots[index].data(), id: invoiceIds[index] } as FacturaMovement;
      if (original.invoiceDocType !== "FCR" ||
        original.currency !== application.invoice.currency ||
        original.providerCode !== application.invoice.providerCode) throw new Error("FCR_INVOICE_CHANGED");
      const total = Math.max(0, roundMoney2(original.originalAmount ?? original.amount));
      const paid = Math.max(0, roundMoney2(original.paidAmount));
      const balance = Math.max(0, roundMoney2(total - paid));
      const cashDebit = roundMoney2(application.cashDebit);
      const applied = roundMoney2(application.totalAppliedToInvoice);
      const roundingAbsorbed = roundMoney2(application.roundingAbsorbed);
      const appliedNotes = application.appliedCreditNotes ?? [];
      const noteTotal = roundMoney2(appliedNotes.reduce((sum, note) => sum + roundMoney2(note.appliedAmount), 0));
      if (cashDebit < 0 || applied <= 0 || applied > balance || roundingAbsorbed < 0 ||
        roundMoney2(cashDebit + noteTotal + roundingAbsorbed) !== applied) throw new Error("FCR_PAYMENT_CHANGED");
      for (const note of appliedNotes) {
        if (note.currency !== original.currency || roundMoney2(note.appliedAmount) <= 0) throw new Error("FCR_CREDIT_NOTE_CHANGED");
        noteUse.set(note.id, roundMoney2((noteUse.get(note.id) ?? 0) + note.appliedAmount));
      }
      const nextPaid = roundMoney2(paid + applied);
      const nextBalance = roundMoney2(total - nextPaid);
      const status = nextBalance === 0 ? "PAGADA" : "PARCIAL";
      const updated: FacturaMovement = {
        ...original,
        accountId: input.accountId,
        amount: total, originalAmount: total, amountDue: nextBalance,
        amountPayment: cashDebit, paidAmount: nextPaid, balanceDue: nextBalance,
        paymentStatus: status, updateAt: input.nowISO,
        paymentType: resolveFacturaPaymentType(status),
        appliedCreditNotes: [...(original.appliedCreditNotes ?? []), ...appliedNotes],
        ...(application.notes !== undefined ? { notes: application.notes } : {}),
        ...(application.manager2 ? { manager2: application.manager2 } : {}),
      };
      invoices.push(updated);
      invoiceWrites.push({ ref: invoiceRefs[index], data: updated });
      for (const manual of application.manualCreditNoteMovements ?? []) {
        if (manual.currency !== original.currency || manual.providerCode !== original.providerCode ||
          manual.invoiceDocType !== "NC") throw new Error("FCR_CREDIT_NOTE_CHANGED");
        manualWrites.push(manual);
      }
      if (cashDebit > 0) {
        const movement = {
          ...MovimientosFondosService.buildInvoicePaymentMovement({
            company, invoice: { ...updated, paymentType: resolveFacturaPaymentType("PAGADA") }, paymentAmount: cashDebit,
            updateAt: input.nowISO, manager2: application.manager2,
            roundingAbsorbed,
          }),
          cashDebit,
          totalAppliedToInvoice: applied,
          roundingAbsorbed,
          appliedCreditNotes: appliedNotes,
          id: paymentIds[index],
        } as unknown as FondoEntry;
        paymentMovements.push(movement);
        ledger = applyLedgerMovementMutation({
          storage: ledger, operation: "create", after: movement,
          nowISO: input.nowISO,
          bypassPendingNightDailyClosing: input.bypassPendingNightDailyClosing,
        }).storage;
      } else {
        const revision = (ledger.state.revision ?? 0) + 1;
        ledger = {
          ...ledger,
          state: {
            ...ledger.state,
            revision,
            updatedAt: input.nowISO,
            lastChange: {
              kind: "invoice-payment", revision, invoiceId: original.id,
              accountId: input.accountId, currency: original.currency,
              updatedAt: input.nowISO,
            },
          },
        };
      }
    }

    for (const [id, appliedAmount] of noteUse) {
      if (!noteSnapshots.has(id)) continue;
      const note = noteSnapshots.get(id)!.data() as FacturaMovement;
      const matchingInvoices = input.applications.filter((item) =>
        (item.appliedCreditNotes ?? []).some((used) => used.id === id));
      if (note.invoiceDocType !== "NC" || matchingInvoices.some((item) =>
        note.currency !== item.invoice.currency || note.providerCode !== item.invoice.providerCode)) {
        throw new Error("FCR_CREDIT_NOTE_CHANGED");
      }
      const total = Math.max(0, roundMoney2(note.originalAmount ?? note.amount));
      const paid = Math.max(0, roundMoney2(note.paidAmount));
      if (appliedAmount > roundMoney2(total - paid)) throw new Error("FCR_CREDIT_NOTE_CHANGED");
    }

    ledger.operations = { movements: [] };
    transaction.set(ledgerRef, stripUndefinedDeep(ledger));
    for (const item of invoiceWrites) {
      transaction.set(item.ref, stripUndefinedDeep(withFacturaPendingForClosing(item.data)), { merge: true });
    }
    for (const [id, appliedAmount] of noteUse) {
      if (!noteSnapshots.has(id)) continue;
      const note = noteSnapshots.get(id)!.data() as FacturaMovement;
      const total = Math.max(0, roundMoney2(note.originalAmount ?? note.amount));
      const nextPaid = roundMoney2(roundMoney2(note.paidAmount) + appliedAmount);
      const balanceDue = roundMoney2(total - nextPaid);
      const paymentStatus = balanceDue === 0 ? "REBAJADA" : "PARCIAL";
      transaction.set(noteRefs.get(id)!, {
        paidAmount: nextPaid, balanceDue, paymentStatus,
        isPendingForClosing: balanceDue > 0, updateAt: input.nowISO,
      }, { merge: true });
    }
    for (const manual of manualWrites) {
      transaction.set(FacturasService.buildMovementRef(company, manual.id),
        stripUndefinedDeep(withFacturaPendingForClosing(manual)));
    }
    for (const movement of paymentMovements) {
      const { id, ...record } = movement;
      transaction.set(MovimientosFondosService.buildMovementRef(docId, id, input.accountId),
        stripUndefinedDeep({ ...record, serverCreatedAt: serverTimestamp() }));
    }
    return { ledger, invoices, paymentMovements };
  });
}
