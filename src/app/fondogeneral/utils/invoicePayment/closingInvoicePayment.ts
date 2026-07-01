import { db } from "@/config/firebase";
import { doc, writeBatch, type WriteBatch } from "firebase/firestore";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  FacturasService,
  type AppliedCreditNote,
  type FacturaMovement,
} from "../../../../services/facturas";
import {
  MovimientosFondosService,
  type MovementAccountKey,
  type MovementCurrencyKey,
  type MovementStorage,
} from "../../../../services/movimientos-fondos";
import { type FondoEntry } from "../../types";
import {
  roundCreditNotePaymentAmount,
  roundMoney2,
  stripUndefinedDeep,
  type PendingCreditNoteOption,
} from "../helpers";
import { buildV2MovementsCacheKey } from "../v2movements";
import { getAuthoritativeNowISO } from "@/utils/serverTime";

type V2MovementsCacheEntry = {
  loaded: boolean;
  movements: FondoEntry[];
  cursor: unknown;
  exhausted: boolean;
  loading: boolean;
  queryKey?: string;
  startIso?: string;
  endIsoExclusive?: string;
};

export interface ClosingInvoicePaymentDeps {
  company: string | null | undefined;
  accountKey: MovementAccountKey;
  isCajaNegra: boolean;
  pendingCierreDeCaja: boolean;
  closingPaymentTarget: FacturaMovement | null;
  closingPaymentAmount: string;
  closingPaymentNotes: string;
  closingPaymentManager2: string;
  closingPaymentCreditNoteIds: string[];
  selectedProviderPendingCreditNotes: PendingCreditNoteOption[];
  showToast: (message: string, type: "success" | "error" | "warning", timeoutMs?: number) => void;
  setPendingCierreModalOpen: Dispatch<SetStateAction<boolean>>;
  setClosingPaymentSubmitting: Dispatch<SetStateAction<boolean>>;
  setPendingClosingCreditInvoices: Dispatch<SetStateAction<FacturaMovement[]>>;
  setSelectedProviderPendingCreditNotes: Dispatch<SetStateAction<PendingCreditNoteOption[]>>;
  setClosingPaymentCreditNoteIds: Dispatch<SetStateAction<string[]>>;
  closeClosingInvoicePaymentModal: () => void;
  applyLedgerStateFromStorage: (state: any) => void;
  rebuildEntriesFromV2Cache: (docKey: string, targetAccountKey: MovementAccountKey) => void;
  storageSnapshotRef: MutableRefObject<MovementStorage<FondoEntry> | null>;
  v2MovementsCacheRef: MutableRefObject<Record<string, V2MovementsCacheEntry>>;
  persistMovementToFirestore?: (...args: any[]) => Promise<any>;
}

export async function submitClosingInvoicePayment(
  mode: "partial" | "full",
  deps: ClosingInvoicePaymentDeps,
): Promise<void> {
  const {
    company,
    accountKey,
    isCajaNegra,
    pendingCierreDeCaja,
    closingPaymentTarget,
    closingPaymentAmount,
    closingPaymentNotes,
    closingPaymentManager2,
    closingPaymentCreditNoteIds,
    selectedProviderPendingCreditNotes,
    showToast,
    setPendingCierreModalOpen,
    setClosingPaymentSubmitting,
    setPendingClosingCreditInvoices,
    setSelectedProviderPendingCreditNotes,
    setClosingPaymentCreditNoteIds,
    closeClosingInvoicePaymentModal,
    applyLedgerStateFromStorage,
    rebuildEntriesFromV2Cache,
    storageSnapshotRef,
    v2MovementsCacheRef,
  } = deps;

  if (!company || !closingPaymentTarget) return;

  if (isCajaNegra) {
    showToast(
      "Desde Caja Negra no se debe gestionar facturas a crédito.",
      "error",
      4500,
    );
    return;
  }

  if (pendingCierreDeCaja) {
    setPendingCierreModalOpen(true);
    return;
  }

  const totalAmount = Math.max(
    0,
    roundMoney2(closingPaymentTarget.originalAmount ?? closingPaymentTarget.amount),
  );
  const paidAmount = Math.max(0, roundMoney2(closingPaymentTarget.paidAmount));
  const balance = Math.max(
    0,
    Math.min(
      totalAmount,
      roundMoney2(closingPaymentTarget.balanceDue ?? totalAmount - paidAmount),
    ),
  );
  const enteredAmount = Math.max(0, roundMoney2(closingPaymentAmount));
  const selectedNoteIds = new Set(closingPaymentCreditNoteIds);
  let remainingForNotes = balance;
  const appliedCreditNotes = selectedProviderPendingCreditNotes.reduce<AppliedCreditNote[]>(
    (acc, note) => {
      if (remainingForNotes <= 0 || !selectedNoteIds.has(note.id)) return acc;
      if (note.currency !== closingPaymentTarget.currency) return acc;
      const appliedAmount = Math.min(
        remainingForNotes,
        Math.max(0, roundMoney2(note.balanceDue)),
      );
      if (appliedAmount <= 0) return acc;
      remainingForNotes -= appliedAmount;
      acc.push({
        id: note.id,
        invoiceNumber: note.invoiceNumber,
        amount: note.amount,
        appliedAmount,
        currency: note.currency,
      });
      return acc;
    },
    [],
  );
  const creditNotesAmountToApply = appliedCreditNotes.reduce(
    (sum, note) => sum + Math.max(0, roundMoney2(note.appliedAmount)),
    0,
  );
  const maxCashPaymentBeforeAdjustment = Math.max(0, balance - creditNotesAmountToApply);
  const maxCashPayment = roundCreditNotePaymentAmount(
    maxCashPaymentBeforeAdjustment,
    closingPaymentTarget.currency,
    accountKey,
  );
  const paymentAmountToApply = mode === "full" ? maxCashPayment : enteredAmount;
  const creditNoteAdjustmentAmount =
    mode === "full"
      ? Math.max(0, maxCashPaymentBeforeAdjustment - paymentAmountToApply)
      : 0;
  const totalAppliedToInvoice = roundMoney2(
    paymentAmountToApply + creditNotesAmountToApply + creditNoteAdjustmentAmount,
  );

  if (paymentAmountToApply <= 0) {
    showToast("Ingrese un monto valido para el pago.", "error", 4000);
    return;
  }

  if (paymentAmountToApply > maxCashPayment) {
    showToast(
      "El monto no puede superar el saldo disponible despues de aplicar las notas de credito.",
      "error",
      4000,
    );
    return;
  }

  if (totalAppliedToInvoice <= 0) {
    showToast("No hay monto por aplicar a la factura.", "error", 4000);
    return;
  }

  if (totalAppliedToInvoice > balance) {
    showToast("El total aplicado supera el saldo pendiente de la factura.", "error", 4000);
    return;
  }

  const nowISO = await getAuthoritativeNowISO();
  const nextPaidAmount = Math.min(
    totalAmount,
    roundMoney2(paidAmount + totalAppliedToInvoice),
  );
  const nextBalanceDue = Math.max(0, roundMoney2(totalAmount - nextPaidAmount));
  const nextStatus =
    nextBalanceDue === 0 ? "PAGADA" : nextPaidAmount > 0 ? "PARCIAL" : "PENDIENTE";
  const cleanedNotes = closingPaymentNotes.trim();
  const cleanedManager2 = closingPaymentManager2.trim();
  const paymentManager2Value = cleanedManager2 || null;
  const nextAppliedCreditNotes = [
    ...(Array.isArray(closingPaymentTarget.appliedCreditNotes)
      ? closingPaymentTarget.appliedCreditNotes
      : []),
    ...appliedCreditNotes,
  ];

  const updatedMovement: FacturaMovement = {
    ...closingPaymentTarget,
    accountId: accountKey,
    amount: totalAmount,
    originalAmount: totalAmount,
    amountPayment: paymentAmountToApply,
    amountDue: nextBalanceDue,
    paidAmount: nextPaidAmount,
    balanceDue: nextBalanceDue,
    paymentStatus: nextStatus,
    notes: cleanedNotes,
    appliedCreditNotes: nextAppliedCreditNotes.length > 0 ? nextAppliedCreditNotes : undefined,
    updateAt: nowISO,
    ...(paymentManager2Value ? { manager2: paymentManager2Value } : {}),
  };

  const paymentMovement = MovimientosFondosService.buildInvoicePaymentMovement({
    company,
    invoice: updatedMovement,
    paymentAmount: paymentAmountToApply,
    updateAt: nowISO,
    manager2: paymentManager2Value || undefined,
  });
  const paymentMovementId = String((paymentMovement as any).id || "");
  const targetAccountKey: MovementAccountKey = accountKey;

  setClosingPaymentSubmitting(true);
  try {
    const docId = MovimientosFondosService.buildCompanyMovementsKey(company);

    let baseStorage = null;
    try {
      baseStorage = await MovimientosFondosService.getDocument(docId);
    } catch {
      baseStorage = null;
    }
    const ledger = baseStorage ?? MovimientosFondosService.createEmptyMovementStorage(company);
    ledger.company = company;
    ledger.operations = { movements: [] };

    const state =
      ledger.state ?? MovimientosFondosService.createEmptyMovementStorage(company).state;
    const acctKey = targetAccountKey;
    const currency = (paymentMovement as any).currency as MovementCurrencyKey;
    const amountToApply = roundMoney2(paymentAmountToApply || 0);
    let found = false;
    state.balancesByAccount = state.balancesByAccount.map((b) => {
      if (b.accountId === acctKey && b.currency === currency) {
        const current = typeof b.currentBalance === "number" ? b.currentBalance : b.initialBalance || 0;
        const next = current - amountToApply;
        found = true;
        return { ...b, currentBalance: next };
      }
      return b;
    });
    if (!found) {
      state.balancesByAccount.push({
        accountId: acctKey,
        currency,
        enabled: true,
        initialBalance: 0,
        currentBalance: -amountToApply,
      });
    }
    state.updatedAt = nowISO;
    ledger.state = state;

    const batch: WriteBatch = writeBatch(db);
    batch.set(
      FacturasService.buildMovementRef(company, closingPaymentTarget.id),
      stripUndefinedDeep(updatedMovement),
      { merge: true },
    );

    if (appliedCreditNotes.length > 0) {
      appliedCreditNotes.forEach((note) => {
        const pendingNote = selectedProviderPendingCreditNotes.find((item) => item.id === note.id);
        const noteAmount = Math.max(0, roundMoney2(pendingNote?.amount ?? note.amount));
        const previousPaid = Math.max(0, roundMoney2(pendingNote?.paidAmount));
        const nextPaidAmount = Math.min(
          noteAmount,
          roundMoney2(previousPaid + roundMoney2(note.appliedAmount)),
        );
        const nextBalanceDue = Math.max(0, roundMoney2(noteAmount - nextPaidAmount));

        batch.set(
          FacturasService.buildMovementRef(company, note.id),
          {
            paidAmount: nextPaidAmount,
            balanceDue: nextBalanceDue,
            paymentStatus: nextBalanceDue === 0 ? "REBAJADA" : "PARCIAL",
            updateAt: nowISO,
          },
          { merge: true },
        );
      });
    }

    const mainRef = doc(db, MovimientosFondosService.COLLECTION_NAME, docId);
    batch.set(mainRef, stripUndefinedDeep(ledger) as any);
    const movRef = MovimientosFondosService.buildMovementRef(docId, paymentMovementId, targetAccountKey);
    batch.set(movRef, stripUndefinedDeep(paymentMovement));

    await batch.commit();
    setPendingClosingCreditInvoices((current) =>
      current.filter((movement) => movement.id !== closingPaymentTarget.id),
    );
    if (appliedCreditNotes.length > 0) {
      setSelectedProviderPendingCreditNotes((prev) =>
        prev
          .map((note) => {
            const applied = appliedCreditNotes.find((item) => item.id === note.id);
            if (!applied) return note;
            const paidAmount = Math.min(note.amount, note.paidAmount + applied.appliedAmount);
            return {
              ...note,
              paidAmount,
              balanceDue: Math.max(0, note.amount - paidAmount),
            };
          })
          .filter((note) => note.balanceDue > 0),
      );
      setClosingPaymentCreditNoteIds([]);
    }
    storageSnapshotRef.current = stripUndefinedDeep(ledger) as any;
    try {
      const cacheKey = buildV2MovementsCacheKey(docId, targetAccountKey);
      const cached = v2MovementsCacheRef.current[cacheKey];
      if (cached?.loaded) {
        v2MovementsCacheRef.current[cacheKey] = {
          ...cached,
          movements: [
            {
              ...(paymentMovement as unknown as FondoEntry),
              id: paymentMovementId,
            },
            ...cached.movements,
          ],
        };
        rebuildEntriesFromV2Cache(docId, targetAccountKey);
      } else {
        applyLedgerStateFromStorage(ledger.state);
      }
    } catch (refreshErr) {
      console.error("[FONDO] Error refreshing UI after payment:", refreshErr);
    }
    closeClosingInvoicePaymentModal();
  } catch (error) {
    console.error("[FONDO] Error saving credit invoice payment:", error);
  } finally {
    setClosingPaymentSubmitting(false);
  }
}
