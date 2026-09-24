import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { FacturaMovement } from "../../../../services/facturas";
import type {
  MovementAccountKey,
  MovementStorage,
} from "../../../../services/movimientos-fondos";
import type { FondoEntry } from "../../types";
import {
  submitClosingInvoicePayment as submitClosingInvoicePaymentFn,
  type ClosingInvoicePaymentDeps,
} from "../../utils/invoicePayment/closingInvoicePayment";
import { roundMoney2 } from "../../utils/helpers";
import type { ManualCreditNoteDraft } from "../../utils/fondo/manualCreditNoteDrafts";
import {
  resolveInvoicePaymentCreditNotes,
  resolvePendingCreditNoteOptionsForInvoice,
} from "../../utils/invoicePayment/creditNotes";

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

interface UseClosingInvoicePaymentProps {
  company: ClosingInvoicePaymentDeps["company"];
  accountKey: MovementAccountKey;
  isCajaNegra: boolean;
  pendingCierreDeCaja: boolean;
  pendingClosingCreditInvoices: FacturaMovement[];
  pendingCreditNotes: FacturaMovement[];
  solicitarApertura?: boolean;
  showToast: ClosingInvoicePaymentDeps["showToast"];
  setPendingCierreModalOpen: Dispatch<SetStateAction<boolean>>;
  setPendingClosingCreditInvoices: ClosingInvoicePaymentDeps["setPendingClosingCreditInvoices"];
  setSelectedProviderPendingCreditNotes: ClosingInvoicePaymentDeps["setSelectedProviderPendingCreditNotes"];
  setPendingCreditNotes: ClosingInvoicePaymentDeps["setPendingCreditNotes"];
  applyLedgerStateFromStorage: ClosingInvoicePaymentDeps["applyLedgerStateFromStorage"];
  applyConfirmedLedger: ClosingInvoicePaymentDeps["applyConfirmedLedger"];
  rebuildEntriesFromV2Cache: ClosingInvoicePaymentDeps["rebuildEntriesFromV2Cache"];
  storageSnapshotRef: MutableRefObject<MovementStorage<FondoEntry> | null>;
  v2MovementsCacheRef: MutableRefObject<Record<string, V2MovementsCacheEntry>>;
  persistMovementToFirestore?: ClosingInvoicePaymentDeps["persistMovementToFirestore"];
  setSelectedProvider: Dispatch<SetStateAction<string>>;
  setMovementModalOpen: Dispatch<SetStateAction<boolean>>;
  clearMovementDraft?: () => void;
}

export function useClosingInvoicePayment({
  company,
  accountKey,
  isCajaNegra,
  pendingCierreDeCaja,
  pendingClosingCreditInvoices,
  pendingCreditNotes,
  solicitarApertura = true,
  showToast,
  setPendingCierreModalOpen,
  setPendingClosingCreditInvoices,
  setSelectedProviderPendingCreditNotes,
  setPendingCreditNotes,
  applyLedgerStateFromStorage,
  applyConfirmedLedger,
  rebuildEntriesFromV2Cache,
  storageSnapshotRef,
  v2MovementsCacheRef,
  persistMovementToFirestore,
  setSelectedProvider,
  setMovementModalOpen,
  clearMovementDraft,
}: UseClosingInvoicePaymentProps) {
  const [closingPaymentModalOpen, setClosingPaymentModalOpen] = useState(false);
  const [closingPaymentTarget, setClosingPaymentTarget] =
    useState<FacturaMovement | null>(null);
  const [closingPaymentAmount, setClosingPaymentAmount] = useState("");
  const [closingPaymentNotes, setClosingPaymentNotes] = useState("");
  const [closingPaymentManager2, setClosingPaymentManager2] = useState("");
  const [closingPaymentCreditNoteIds, setClosingPaymentCreditNoteIds] =
    useState<string[]>([]);
  const [closingPaymentManualCreditNotes, setClosingPaymentManualCreditNotes] =
    useState<ManualCreditNoteDraft[]>([]);
  const [closingPaymentSubmitting, setClosingPaymentSubmitting] =
    useState(false);

  const openClosingInvoicePaymentModal = useCallback(
    (invoice: FacturaMovement) => {
      if (isCajaNegra) {
        showToast(
          "Desde esta cuenta no se debe gestionar facturas a credito.",
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
        roundMoney2(invoice.originalAmount ?? invoice.amount),
      );
      const paidAmount = Math.max(
        0,
        roundMoney2(invoice.paidAmount),
      );
      const balanceDue = Math.max(
        0,
        roundMoney2(invoice.balanceDue ?? totalAmount - paidAmount),
      );

      setSelectedProvider(invoice.providerCode);
      setClosingPaymentTarget(invoice);
      setClosingPaymentAmount(String(balanceDue || totalAmount));
      setClosingPaymentNotes(String(invoice.notes || ""));
      setClosingPaymentManager2(String(invoice.manager2 || ""));
      setClosingPaymentCreditNoteIds([]);
      setClosingPaymentManualCreditNotes([]);
      setClosingPaymentModalOpen(true);
    },
    [
      isCajaNegra,
      pendingCierreDeCaja,
      setPendingCierreModalOpen,
      setSelectedProvider,
      showToast,
    ],
  );

  const closeClosingInvoicePaymentModal = useCallback(() => {
    setClosingPaymentModalOpen(false);
    setClosingPaymentTarget(null);
    setClosingPaymentAmount("");
    setClosingPaymentNotes("");
    setClosingPaymentManager2("");
    setClosingPaymentCreditNoteIds([]);
    setClosingPaymentManualCreditNotes([]);
  }, []);

  const openSelectedPendingCreditInvoicePayment = useCallback(
    (invoiceId: string) => {
      const invoice = pendingClosingCreditInvoices.find((item) => item.id === invoiceId);
      if (invoice) {
        openClosingInvoicePaymentModal(invoice);
        setMovementModalOpen(false);
      }
    },
    [
      openClosingInvoicePaymentModal,
      pendingClosingCreditInvoices,
      setMovementModalOpen,
    ],
  );

  const handleMovementCreditInvoiceSelect = openSelectedPendingCreditInvoicePayment;

  const closingPaymentAvailableCreditNotes = useMemo(() => {
    return resolvePendingCreditNoteOptionsForInvoice(
      pendingCreditNotes,
      closingPaymentTarget,
    );
  }, [closingPaymentTarget, pendingCreditNotes]);

  const closingPaymentSelectedCreditNotes = useMemo(() => {
    const selectedIds = new Set(closingPaymentCreditNoteIds);
    return closingPaymentAvailableCreditNotes.filter((note) =>
      selectedIds.has(note.id),
    );
  }, [closingPaymentAvailableCreditNotes, closingPaymentCreditNoteIds]);

  const closingPaymentCreditNotesTotal = useMemo(() => {
    if (!closingPaymentTarget) return 0;
    const totalAmount = Math.max(
      0,
      roundMoney2(closingPaymentTarget.originalAmount ?? closingPaymentTarget.amount),
    );
    const paidAmount = Math.max(
      0,
      roundMoney2(closingPaymentTarget.paidAmount),
    );
    const balance = Math.max(
      0,
      roundMoney2(closingPaymentTarget.balanceDue ?? totalAmount - paidAmount),
    );
    return resolveInvoicePaymentCreditNotes({
      balance,
      currency: closingPaymentTarget.currency === "USD" ? "USD" : "CRC",
      selectedIds: closingPaymentCreditNoteIds,
      pendingCreditNotes: closingPaymentAvailableCreditNotes,
      manualCreditNotes: closingPaymentManualCreditNotes,
    }).total;
  }, [
    closingPaymentAvailableCreditNotes,
    closingPaymentCreditNoteIds,
    closingPaymentManualCreditNotes,
    closingPaymentTarget,
  ]);

  const submitClosingInvoicePayment = useCallback(
    (mode: "partial" | "full") =>
      submitClosingInvoicePaymentFn(mode, {
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
        selectedProviderPendingCreditNotes: closingPaymentAvailableCreditNotes,
        solicitarApertura,
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
        storageSnapshotRef,
        v2MovementsCacheRef,
        persistMovementToFirestore,
        clearMovementDraft,
      }),
    [
      accountKey,
      applyLedgerStateFromStorage,
      applyConfirmedLedger,
      closingPaymentAmount,
      closingPaymentCreditNoteIds,
      closingPaymentManualCreditNotes,
      closingPaymentManager2,
      closingPaymentNotes,
      closingPaymentTarget,
      closeClosingInvoicePaymentModal,
      clearMovementDraft,
      company,
      isCajaNegra,
      pendingCierreDeCaja,
      persistMovementToFirestore,
      rebuildEntriesFromV2Cache,
      closingPaymentAvailableCreditNotes,
      solicitarApertura,
      setPendingCierreModalOpen,
      setPendingClosingCreditInvoices,
      setSelectedProviderPendingCreditNotes,
      setPendingCreditNotes,
      showToast,
      storageSnapshotRef,
      v2MovementsCacheRef,
    ],
  );

  return {
    closingPaymentModalOpen,
    setClosingPaymentModalOpen,
    closingPaymentTarget,
    setClosingPaymentTarget,
    closingPaymentAmount,
    setClosingPaymentAmount,
    closingPaymentNotes,
    setClosingPaymentNotes,
    closingPaymentManager2,
    setClosingPaymentManager2,
    closingPaymentCreditNoteIds,
    setClosingPaymentCreditNoteIds,
    closingPaymentManualCreditNotes,
    setClosingPaymentManualCreditNotes,
    closingPaymentSubmitting,
    openClosingInvoicePaymentModal,
    closeClosingInvoicePaymentModal,
    openSelectedPendingCreditInvoicePayment,
    handleMovementCreditInvoiceSelect,
    closingPaymentAvailableCreditNotes,
    closingPaymentSelectedCreditNotes,
    closingPaymentCreditNotesTotal,
    submitClosingInvoicePayment,
  };
}
