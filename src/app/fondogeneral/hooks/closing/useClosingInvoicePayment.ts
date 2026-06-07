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
import type { PendingCreditNoteOption } from "../../utils/helpers";

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
  selectedProviderPendingCreditNotes: PendingCreditNoteOption[];
  showToast: ClosingInvoicePaymentDeps["showToast"];
  setPendingCierreModalOpen: Dispatch<SetStateAction<boolean>>;
  setPendingClosingCreditInvoices: ClosingInvoicePaymentDeps["setPendingClosingCreditInvoices"];
  setSelectedProviderPendingCreditNotes: ClosingInvoicePaymentDeps["setSelectedProviderPendingCreditNotes"];
  applyLedgerStateFromStorage: ClosingInvoicePaymentDeps["applyLedgerStateFromStorage"];
  rebuildEntriesFromV2Cache: ClosingInvoicePaymentDeps["rebuildEntriesFromV2Cache"];
  storageSnapshotRef: MutableRefObject<MovementStorage<FondoEntry> | null>;
  v2MovementsCacheRef: MutableRefObject<Record<string, V2MovementsCacheEntry>>;
  persistMovementToFirestore?: ClosingInvoicePaymentDeps["persistMovementToFirestore"];
  setSelectedProvider: Dispatch<SetStateAction<string>>;
  setMovementModalOpen: Dispatch<SetStateAction<boolean>>;
}

export function useClosingInvoicePayment({
  company,
  accountKey,
  isCajaNegra,
  pendingCierreDeCaja,
  pendingClosingCreditInvoices,
  selectedProviderPendingCreditNotes,
  showToast,
  setPendingCierreModalOpen,
  setPendingClosingCreditInvoices,
  setSelectedProviderPendingCreditNotes,
  applyLedgerStateFromStorage,
  rebuildEntriesFromV2Cache,
  storageSnapshotRef,
  v2MovementsCacheRef,
  persistMovementToFirestore,
  setSelectedProvider,
  setMovementModalOpen,
}: UseClosingInvoicePaymentProps) {
  const [closingPaymentModalOpen, setClosingPaymentModalOpen] = useState(false);
  const [closingPaymentTarget, setClosingPaymentTarget] =
    useState<FacturaMovement | null>(null);
  const [closingPaymentAmount, setClosingPaymentAmount] = useState("");
  const [closingPaymentNotes, setClosingPaymentNotes] = useState("");
  const [closingPaymentManager2, setClosingPaymentManager2] = useState("");
  const [closingPaymentCreditNoteIds, setClosingPaymentCreditNoteIds] =
    useState<string[]>([]);
  const [closingPaymentSubmitting, setClosingPaymentSubmitting] =
    useState(false);

  const openClosingInvoicePaymentModal = useCallback(
    (invoice: FacturaMovement) => {
      if (isCajaNegra) {
        showToast(
          "Desde Caja Negra no se debe gestionar facturas a credito.",
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
        Math.trunc(Number(invoice.originalAmount ?? invoice.amount) || 0),
      );
      const paidAmount = Math.max(
        0,
        Math.trunc(Number(invoice.paidAmount) || 0),
      );
      const balanceDue = Math.max(
        0,
        Math.trunc(Number(invoice.balanceDue ?? totalAmount - paidAmount) || 0),
      );

      setSelectedProvider(invoice.providerCode);
      setClosingPaymentTarget(invoice);
      setClosingPaymentAmount(String(balanceDue || totalAmount));
      setClosingPaymentNotes(String(invoice.notes || ""));
      setClosingPaymentManager2(String(invoice.manager2 || ""));
      setClosingPaymentCreditNoteIds([]);
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
    if (!closingPaymentTarget) return [];
    return selectedProviderPendingCreditNotes.filter(
      (note) => note.currency === closingPaymentTarget.currency,
    );
  }, [closingPaymentTarget, selectedProviderPendingCreditNotes]);

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
      Math.trunc(
        Number(closingPaymentTarget.originalAmount ?? closingPaymentTarget.amount) || 0,
      ),
    );
    const paidAmount = Math.max(
      0,
      Math.trunc(Number(closingPaymentTarget.paidAmount) || 0),
    );
    let remaining = Math.max(
      0,
      Math.trunc(Number(closingPaymentTarget.balanceDue ?? totalAmount - paidAmount) || 0),
    );
    let total = 0;
    closingPaymentSelectedCreditNotes.forEach((note) => {
      if (remaining <= 0) return;
      const applied = Math.min(
        remaining,
        Math.max(0, Math.trunc(Number(note.balanceDue) || 0)),
      );
      total += applied;
      remaining -= applied;
    });
    return total;
  }, [closingPaymentSelectedCreditNotes, closingPaymentTarget]);

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
        persistMovementToFirestore,
      }),
    [
      accountKey,
      applyLedgerStateFromStorage,
      closingPaymentAmount,
      closingPaymentCreditNoteIds,
      closingPaymentManager2,
      closingPaymentNotes,
      closingPaymentTarget,
      closeClosingInvoicePaymentModal,
      company,
      isCajaNegra,
      pendingCierreDeCaja,
      persistMovementToFirestore,
      rebuildEntriesFromV2Cache,
      selectedProviderPendingCreditNotes,
      setPendingCierreModalOpen,
      setPendingClosingCreditInvoices,
      setSelectedProviderPendingCreditNotes,
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
