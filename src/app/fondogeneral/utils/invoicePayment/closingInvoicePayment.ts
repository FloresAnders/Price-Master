import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { FacturaMovement } from "../../../../services/facturas";
import {
  MovimientosFondosService,
  type MovementAccountKey,
  type MovementStorage,
} from "../../../../services/movimientos-fondos";
import { type FondoEntry } from "../../types";
import { roundMoney2, type PendingCreditNoteOption } from "../helpers";
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
import { commitFcrPayments } from "./fcrLedgerTransaction";

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
  applyConfirmedLedger: (docKey: string, ledger: MovementStorage<FondoEntry>) => boolean;
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
    applyConfirmedLedger,
    rebuildEntriesFromV2Cache,
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
  const cleanedNotes = closingPaymentNotes.trim();
  const cleanedManager2 = closingPaymentManager2.trim();
  const paymentManager2Value = cleanedManager2 || null;
  const manualAppliedCreditNotes = creditNoteResolution.manualNotes.map(
    (note, index) => ({
      ...note,
      id: `manual-nc-${closingPaymentTarget.id}-${nowISO.replace(/\D/g, "")}-${index + 1}-${crypto.randomUUID()}`,
    }),
  );
  const appliedCreditNotes = [
    ...persistedAppliedCreditNotes,
    ...manualAppliedCreditNotes,
  ];
  const targetAccountKey: MovementAccountKey = accountKey;

  setClosingPaymentSubmitting(true);
  try {
    const docId = MovimientosFondosService.buildCompanyMovementsKey(company);

    const committed = await commitFcrPayments({
      company, accountId: targetAccountKey, nowISO,
      applications: [{
        invoice: closingPaymentTarget,
        cashDebit: paymentAmountToApply,
        totalAppliedToInvoice,
        roundingAbsorbed: resolvedAmounts.roundingAbsorbed,
        appliedCreditNotes,
        manualCreditNoteMovements: manualAppliedCreditNotes.map((note) => buildManualCreditNoteMovement({
        id: note.id,
        company,
        invoice: closingPaymentTarget,
        note,
        createdAt: nowISO,
        manager2: paymentManager2Value || undefined,
        })),
        notes: cleanedNotes,
        manager2: paymentManager2Value || undefined,
      }],
    });
    const ledger = committed.ledger;
    const confirmedInvoice = committed.invoices[0];
    const confirmedPayment = committed.paymentMovements[0];
    setPendingClosingCreditInvoices((current) =>
      (confirmedInvoice.balanceDue ?? 0) > 0
        ? current.map((movement) =>
            movement.id === closingPaymentTarget.id ? confirmedInvoice : movement,
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
    const appliedLedger = applyConfirmedLedger(docId, ledger);
    // Misma actualización de caché (IndexedDB) que un movimiento normal al guardar.
    await invalidateFondoCache({
      companyId: String(company || "").trim(),
      accountId: targetAccountKey,
      resource: "movements",
    });
    try {
      if (appliedLedger) localStorage.setItem(docId, JSON.stringify(ledger));
    } catch (storageError) {
      console.warn("[FONDO] localStorage snapshot write failed:", storageError);
    }
    try {
      const cacheKey = buildV2MovementsCacheKey(docId, targetAccountKey);
      const cached = v2MovementsCacheRef.current[cacheKey];
      if (appliedLedger && cached?.loaded && confirmedPayment) {
        const revision = (cached.revision ?? 0) + 1;
        v2MovementsCacheRef.current[cacheKey] = {
          ...cached,
          loaded: true,
          loading: false,
          revision,
          movements: [
            {
              ...confirmedPayment,
            },
            ...cached.movements,
          ],
        };
        rebuildEntriesFromV2Cache(docId, targetAccountKey);
      } else if (appliedLedger) {
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
