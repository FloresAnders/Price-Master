import { db } from "@/config/firebase";
import { doc, writeBatch, type WriteBatch } from "firebase/firestore";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  FacturasService,
  isFacturaPendingForClosing,
  withFacturaPendingForClosing,
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
  roundMoney2,
  stripUndefinedDeep,
  type PendingCreditNoteOption,
} from "../helpers";
import { resolveFcrPaymentAmounts } from "../fondo/fcrPaymentAmounts";
import type { ManualCreditNoteDraft } from "../fondo/manualCreditNoteDrafts";
import { validateFondoGeneralOpeningRequirement } from "../fondo/openingRequirement";
import {
  buildManualCreditNoteMovement,
  isInvoicePaymentApplicationValid,
  resolveInvoicePaymentCreditNotes,
} from "./creditNotes";
import { invalidateFondoCache } from "@/services/fondo-cache";
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
  revision?: number;
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
  closingPaymentManualCreditNotes: ManualCreditNoteDraft[];
  selectedProviderPendingCreditNotes: PendingCreditNoteOption[];
  solicitarApertura?: boolean;
  showToast: (message: string, type: "success" | "error" | "warning", timeoutMs?: number) => void;
  setPendingCierreModalOpen: Dispatch<SetStateAction<boolean>>;
  setClosingPaymentSubmitting: Dispatch<SetStateAction<boolean>>;
  setPendingClosingCreditInvoices: Dispatch<SetStateAction<FacturaMovement[]>>;
  setSelectedProviderPendingCreditNotes: Dispatch<SetStateAction<PendingCreditNoteOption[]>>;
  setPendingCreditNotes: Dispatch<SetStateAction<FacturaMovement[]>>;
  setClosingPaymentCreditNoteIds: Dispatch<SetStateAction<string[]>>;
  setClosingPaymentManualCreditNotes: Dispatch<
    SetStateAction<ManualCreditNoteDraft[]>
  >;
  closeClosingInvoicePaymentModal: () => void;
  applyLedgerStateFromStorage: (state: any) => void;
  rebuildEntriesFromV2Cache: (docKey: string, targetAccountKey: MovementAccountKey) => void;
  storageSnapshotRef: MutableRefObject<MovementStorage<FondoEntry> | null>;
  v2MovementsCacheRef: MutableRefObject<Record<string, V2MovementsCacheEntry>>;
  persistMovementToFirestore?: (...args: any[]) => Promise<any>;
  clearMovementDraft?: () => void;
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
    closingPaymentManualCreditNotes,
    selectedProviderPendingCreditNotes,
    solicitarApertura = true,
    showToast,
    setPendingCierreModalOpen,
    setClosingPaymentSubmitting,
    setPendingClosingCreditInvoices,
    setSelectedProviderPendingCreditNotes,
    setPendingCreditNotes,
    setClosingPaymentCreditNoteIds,
    setClosingPaymentManualCreditNotes,
    closeClosingInvoicePaymentModal,
    applyLedgerStateFromStorage,
    rebuildEntriesFromV2Cache,
    storageSnapshotRef,
    v2MovementsCacheRef,
    clearMovementDraft,
  } = deps;

  if (!company || !closingPaymentTarget) return;

  if (isCajaNegra) {
    showToast(
      "Desde esta cuenta no se debe gestionar facturas a crédito.",
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
  if (enteredAmount > balance) {
    showToast(
      "El monto no puede superar el saldo pendiente de la factura.",
      "error",
      4000,
    );
    return;
  }
  const creditNoteResolution = resolveInvoicePaymentCreditNotes({
    balance,
    currency: closingPaymentTarget.currency === "USD" ? "USD" : "CRC",
    selectedIds: closingPaymentCreditNoteIds,
    pendingCreditNotes: selectedProviderPendingCreditNotes,
    manualCreditNotes: closingPaymentManualCreditNotes,
  });
  if (creditNoteResolution.overLimit) {
    showToast(
      "Las notas de credito seleccionadas superan el saldo pendiente.",
      "error",
      5000,
    );
    return;
  }
  const persistedAppliedCreditNotes = creditNoteResolution.persistedNotes;
  const creditNotesAmountToApply = creditNoteResolution.total;
  const resolvedAmounts = resolveFcrPaymentAmounts({
    balance,
    creditNotesTotal: creditNotesAmountToApply,
    enteredAmount,
    mode,
    currency: closingPaymentTarget.currency,
    accountKey,
  });
  const paymentAmountToApply = resolvedAmounts.cashDebit;
  const totalAppliedToInvoice = resolvedAmounts.totalAppliedToInvoice;

  if (!isInvoicePaymentApplicationValid(resolvedAmounts)) {
    showToast("No hay monto por aplicar a la factura.", "error", 4000);
    return;
  }

  if (totalAppliedToInvoice > balance) {
    showToast("El total aplicado supera el saldo pendiente de la factura.", "error", 4000);
    return;
  }

  const openingValidation = await validateFondoGeneralOpeningRequirement({
    company,
    accountKey,
    solicitarApertura,
  });
  if (!openingValidation.allowed) {
    showToast(
      openingValidation.message,
      openingValidation.reason === "validation_failed" ? "error" : "warning",
      7000,
    );
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
  const manualAppliedCreditNotes = creditNoteResolution.manualNotes.map(
    (note, index) => ({
      ...note,
      id: `manual-nc-${closingPaymentTarget.id}-${nowISO.replace(/\D/g, "")}-${index + 1}`,
    }),
  );
  const appliedCreditNotes = [
    ...persistedAppliedCreditNotes,
    ...manualAppliedCreditNotes,
  ];
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

  const paymentMovement =
    paymentAmountToApply > 0
      ? MovimientosFondosService.buildInvoicePaymentMovement({
          company,
          invoice: updatedMovement,
          paymentAmount: paymentAmountToApply,
          updateAt: nowISO,
          manager2: paymentManager2Value || undefined,
          roundingAbsorbed: resolvedAmounts.roundingAbsorbed,
        })
      : null;
  const paymentMovementId = paymentMovement
    ? String((paymentMovement as any).id || "")
    : "";
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
    const currency = closingPaymentTarget.currency as MovementCurrencyKey;
    const amountToApply = roundMoney2(paymentAmountToApply || 0);
    let found = false;
    if (amountToApply > 0) {
      state.balancesByAccount = state.balancesByAccount.map((b) => {
        if (b.accountId === acctKey && b.currency === currency) {
          const current = typeof b.currentBalance === "number" ? b.currentBalance : b.initialBalance || 0;
          const next = current - amountToApply;
          found = true;
          return { ...b, currentBalance: next };
        }
        return b;
      });
    }
    if (amountToApply > 0 && !found) {
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
      stripUndefinedDeep(withFacturaPendingForClosing(updatedMovement)),
      { merge: true },
    );

    if (persistedAppliedCreditNotes.length > 0) {
      persistedAppliedCreditNotes.forEach((note) => {
        const pendingNote = selectedProviderPendingCreditNotes.find((item) => item.id === note.id);
        const noteAmount = Math.max(0, roundMoney2(pendingNote?.amount ?? note.amount));
        const previousPaid = Math.max(0, roundMoney2(pendingNote?.paidAmount));
        const nextPaidAmount = Math.min(
          noteAmount,
          roundMoney2(previousPaid + roundMoney2(note.appliedAmount)),
        );
        const nextBalanceDue = Math.max(0, roundMoney2(noteAmount - nextPaidAmount));

        const nextStatus = nextBalanceDue === 0 ? "REBAJADA" : "PARCIAL";
        batch.set(
          FacturasService.buildMovementRef(company, note.id),
          {
            paidAmount: nextPaidAmount,
            balanceDue: nextBalanceDue,
            paymentStatus: nextStatus,
            isPendingForClosing: isFacturaPendingForClosing({
              invoiceDocType: "NC",
              amount: noteAmount,
              originalAmount: noteAmount,
              paidAmount: nextPaidAmount,
              balanceDue: nextBalanceDue,
              paymentStatus: nextStatus,
            }),
            updateAt: nowISO,
          },
          { merge: true },
        );
      });
    }

    manualAppliedCreditNotes.forEach((note) => {
      const manualMovement = buildManualCreditNoteMovement({
        id: note.id,
        company,
        invoice: closingPaymentTarget,
        note,
        createdAt: nowISO,
        manager2: paymentManager2Value || undefined,
      });
      batch.set(
        FacturasService.buildMovementRef(company, note.id),
        stripUndefinedDeep(withFacturaPendingForClosing(manualMovement)),
      );
    });

    const mainRef = doc(db, MovimientosFondosService.COLLECTION_NAME, docId);
    batch.set(mainRef, stripUndefinedDeep(ledger) as any);
    if (paymentMovement && paymentMovementId) {
      const movRef = MovimientosFondosService.buildMovementRef(docId, paymentMovementId, targetAccountKey);
      batch.set(movRef, stripUndefinedDeep(paymentMovement));
    }

    await batch.commit();
    setPendingClosingCreditInvoices((current) =>
      nextBalanceDue > 0
        ? current.map((movement) =>
            movement.id === closingPaymentTarget.id ? updatedMovement : movement,
          )
        : current.filter((movement) => movement.id !== closingPaymentTarget.id),
    );
    if (persistedAppliedCreditNotes.length > 0) {
      setSelectedProviderPendingCreditNotes((prev) =>
        prev
          .map((note) => {
            const applied = persistedAppliedCreditNotes.find((item) => item.id === note.id);
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
      setPendingCreditNotes((prev) =>
        prev
          .map((note) => {
            const applied = persistedAppliedCreditNotes.find(
              (item) => item.id === note.id,
            );
            if (!applied) return note;
            const amount = Math.max(
              0,
              roundMoney2(note.originalAmount ?? note.amount),
            );
            const paidAmount = Math.min(
              amount,
              roundMoney2((note.paidAmount ?? 0) + applied.appliedAmount),
            );
            return {
              ...note,
              paidAmount,
              balanceDue: Math.max(0, roundMoney2(amount - paidAmount)),
            };
          })
          .filter((note) => Math.max(0, roundMoney2(note.balanceDue)) > 0),
      );
    }
    setClosingPaymentCreditNoteIds([]);
    setClosingPaymentManualCreditNotes([]);
    storageSnapshotRef.current = stripUndefinedDeep(ledger) as any;
    // Misma actualización de caché (IndexedDB) que un movimiento normal al guardar.
    await invalidateFondoCache({
      companyId: String(company || "").trim(),
      accountId: targetAccountKey,
      resource: "movements",
    });
    try {
      localStorage.setItem(docId, JSON.stringify(ledger));
    } catch (storageError) {
      console.warn("[FONDO] localStorage snapshot write failed:", storageError);
    }
    try {
      const cacheKey = buildV2MovementsCacheKey(docId, targetAccountKey);
      const cached = v2MovementsCacheRef.current[cacheKey];
      if (cached?.loaded && paymentMovement && paymentMovementId) {
        const revision = (cached.revision ?? 0) + 1;
        v2MovementsCacheRef.current[cacheKey] = {
          ...cached,
          loaded: true,
          loading: false,
          revision,
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
    clearMovementDraft?.();
    closeClosingInvoicePaymentModal();
  } catch (error) {
    console.error("[FONDO] Error saving credit invoice payment:", error);
  } finally {
    setClosingPaymentSubmitting(false);
  }
}
