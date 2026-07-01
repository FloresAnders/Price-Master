import { useState, useMemo, useRef, useCallback } from "react";
import type { FondoEntry } from "../../types";
import { FONDO_INGRESO_TYPES, FONDO_EGRESO_TYPES } from "../../constants";
import { isPaidFcrMovement } from "../../utils/helpers";

interface Props {
  mode: "all" | "ingreso" | "egreso";
  fondoEntries: FondoEntry[];
}

export function useMovementForm({ mode, fondoEntries }: Props) {
  const [selectedProvider, setSelectedProvider] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const defaultPaymentType: FondoEntry["paymentType"] =
    mode === "ingreso"
      ? FONDO_INGRESO_TYPES[0]
      : mode === "egreso"
        ? FONDO_EGRESO_TYPES[0]
        : "COMPRA INVENTARIO";
  const [paymentType, setPaymentType] =
    useState<FondoEntry["paymentType"]>(defaultPaymentType);
  const [egreso, setEgreso] = useState("");
  const [ingreso, setIngreso] = useState("");
  const [manager, setManager] = useState("");
  const [manager2, setManager2] = useState("");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [initialAmount, setInitialAmount] = useState("0");
  const [initialAmountUSD, setInitialAmountUSD] = useState("0");
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementAutoCloseLocked, setMovementAutoCloseLocked] = useState(false);
  const [movementCurrency, setMovementCurrency] = useState<"CRC" | "USD">("CRC");
  const [invoiceDocType, setInvoiceDocType] = useState<"FCO" | "FCR">("FCO");
  const [providerError, setProviderError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [managerError, setManagerError] = useState("");
  const [manager2Error, setManager2Error] = useState("");
  const [managerLockedByShift, setManagerLockedByShift] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmOpenCreateMovement, setConfirmOpenCreateMovement] = useState(false);
  const [confirmPhysicalCountOpen, setConfirmPhysicalCountOpen] = useState(false);
  const [physicalCountWasDone, setPhysicalCountWasDone] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<{
    open: boolean;
    entry: FondoEntry | null;
  }>({ open: false, entry: null });

  const lastEditSaveTimestampRef = useRef<number>(0);
  const editingInProgressRef = useRef<boolean>(false);
  const movementSubmitInProgressRef = useRef<boolean>(false);
  const lastMovementDedupeRef = useRef<{
    at: number;
    fingerprint: string;
  } | null>(null);
  const lastMovementCreatedAtRef = useRef<number>(0);

  const editingEntry = useMemo(() => {
    if (!editingEntryId) return null;
    return fondoEntries.find((e) => e.id === editingEntryId) ?? null;
  }, [editingEntryId, fondoEntries]);

  const editingProviderCode = editingEntry?.providerCode ?? "";

  const isEditingPaidFcrMovement = useMemo(
    () => editingEntry ? isPaidFcrMovement(editingEntry) : false,
    [editingEntry],
  );

  const normalizeMoneyInput = (value: string) => {
    const stripped = value.replace(/\s/g, "").replace(/[^\d.,]/g, "");
    const decimalIndex = Math.max(
      stripped.lastIndexOf(","),
      stripped.lastIndexOf("."),
    );
    if (decimalIndex === -1) return stripped.replace(/[.,]/g, "");
    const integerPart = stripped.slice(0, decimalIndex).replace(/[.,]/g, "");
    const fractionPart = stripped
      .slice(decimalIndex + 1)
      .replace(/[.,]/g, "")
      .slice(0, 2);
    return fractionPart.length > 0
      ? `${integerPart}.${fractionPart}`
      : `${integerPart}.`;
  };

  const handleInvoiceNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    setInvoiceNumber(cleaned);
    setInvoiceError("");
  };

  const handleEgresoChange = (value: string) => {
    setEgreso(normalizeMoneyInput(value));
    setAmountError("");
  };

  const handleIngresoChange = (value: string) => {
    setIngreso(normalizeMoneyInput(value));
    setAmountError("");
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
  };

  const handleManagerChange = (value: string) => {
    setManager(value);
    setManagerError("");
  };

  const handleManager2Change = (value: string) => {
    setManager2(value);
    setManager2Error("");
  };

  const closeMovementModal = useCallback(() => {
    setMovementModalOpen(false);
    setMovementAutoCloseLocked(false);
  }, []);

  const cancelOpenCreateMovement = useCallback(() => {
    setConfirmOpenCreateMovement(false);
  }, []);

  const resetFormFields = useCallback(() => {
    setSelectedProvider("");
    setInvoiceNumber("");
    setInvoiceDocType("FCO");
    setEgreso("");
    setIngreso("");
    setManager("");
    setManager2("");
    setNotes("");
    setPaymentType(defaultPaymentType);
    setEditingEntryId(null);
    setProviderError("");
    setInvoiceError("");
    setAmountError("");
    setManagerError("");
    setManager2Error("");
    editingInProgressRef.current = false;
    setMovementAutoCloseLocked(false);
  }, [defaultPaymentType]);

  return {
    // State
    selectedProvider,
    setSelectedProvider,
    invoiceNumber,
    setInvoiceNumber,
    paymentType,
    setPaymentType,
    egreso,
    setEgreso,
    ingreso,
    setIngreso,
    manager,
    setManager,
    manager2,
    setManager2,
    notes,
    setNotes,
    editingEntryId,
    setEditingEntryId,
    initialAmount,
    setInitialAmount,
    initialAmountUSD,
    setInitialAmountUSD,
    movementModalOpen,
    setMovementModalOpen,
    movementAutoCloseLocked,
    setMovementAutoCloseLocked,
    movementCurrency,
    setMovementCurrency,
    invoiceDocType,
    setInvoiceDocType,
    providerError,
    setProviderError,
    invoiceError,
    setInvoiceError,
    amountError,
    setAmountError,
    managerError,
    setManagerError,
    manager2Error,
    setManager2Error,
    managerLockedByShift,
    setManagerLockedByShift,
    isSaving,
    setIsSaving,
    confirmOpenCreateMovement,
    setConfirmOpenCreateMovement,
    confirmPhysicalCountOpen,
    setConfirmPhysicalCountOpen,
    physicalCountWasDone,
    setPhysicalCountWasDone,
    confirmDeleteEntry,
    setConfirmDeleteEntry,
    // Refs
    lastEditSaveTimestampRef,
    editingInProgressRef,
    movementSubmitInProgressRef,
    lastMovementDedupeRef,
    lastMovementCreatedAtRef,
    // Derived
    editingEntry,
    editingProviderCode,
    isEditingPaidFcrMovement,
    // Handlers
    handleInvoiceNumberChange,
    handleEgresoChange,
    handleIngresoChange,
    handleNotesChange,
    handleManagerChange,
    handleManager2Change,
    closeMovementModal,
    cancelOpenCreateMovement,
    normalizeMoneyInput,
    resetFormFields,
  };
}
