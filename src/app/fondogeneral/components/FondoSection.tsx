"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Pencil,
  Banknote,
  Clock,
  Layers,
  Tag,
  FileText,
  UserCircle,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  ChevronDown,
  CheckCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useProviders } from "../../../hooks/useProviders";
import useToast from "../../../hooks/useToast";
import type { Empresas } from "../../../types/firestore";
import { getDefaultPermissions } from "../../../utils/permissions";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import DailyClosingHistoryModal from "../../../components/modals/DailyClosingHistoryModal";
import { ManualCreditNoteDrawer } from "./ManualCreditNoteDrawer";
import { FondoConfirmModals } from "./FondoConfirmModals";
import {
  getCostaRicaDateKeyAndMinute,
  type ShiftCode,
} from "@/utils/controlHorarioManager";
import { getAuthoritativeNowISO } from "@/utils/serverTime";
import { AuditHistoryModal } from "./audit-history-modal";
import {
  MovimientosFondosService,
  MovementAccountKey,
  MovementCurrencyKey,
  MovementStorage,
  MovementStorageState,
} from "../../../services/movimientos-fondos";


import DailyClosingModal, { DailyClosingFormValues } from "./DailyClosingModal";
import CashOpeningModal, { CashOpeningFormValues } from "./CashOpeningModal";
import FacturaPaymentModal from "./FacturaPaymentModal";
import { FondoTotalsSummary } from "./FondoTotalsSummary";
import { FondoCurrentBalanceCard } from "./FondoCurrentBalanceCard";
import { PendingCreditInvoicesSection } from "./PendingCreditInvoicesSection";
import { FondoMovementsSkeleton } from "./FondoMovementsSkeleton";
import { MovementActionsCell } from "./MovementActionsCell";
import { AppliedCreditNotesDetails } from "./AppliedCreditNotesDetails";
import { PaidFcrInfoRow } from "./PaidFcrInfoRow";
import { CompanySelectorContent } from "./CompanySelectorContent";
import { FondoFiltersToolbar } from "./FondoFiltersToolbar";
import { MovementDrawer } from "./MovementDrawer";
import { MovementNotesBlock } from "./MovementNotesBlock";
import { handleSaveManualCreditNote as handleSaveManualCreditNoteFn } from "../utils/manualCreditNote";
import { handleSubmitFondo as handleSubmitFondoFn } from "../utils/submitFondo";
import { useActorOwnership } from "../../../hooks/useActorOwnership";
import type { FondoEntry, FondoMovementType } from "../types";
import { persistMovementToFirestore as persistMovementToFirestoreFn } from "../utils/persistence";
import { handleConfirmDailyClosing as handleConfirmDailyClosingFn } from "../utils/dailyClosing";
import { handleConfirmCashOpening as handleConfirmCashOpeningFn } from "../utils/cashOpening";
import { resetStateForCompanyChange } from "../utils/companyReset";
import { useMovementsLoadingState } from "../hooks/useMovementsLoadingState";
import { useShiftScheduleResolver } from "../hooks/useShiftScheduleResolver";
import {
  FONDO_INGRESO_TYPES,
  FONDO_GASTO_TYPES,
  FONDO_EGRESO_TYPES,
  AUTO_ADJUSTMENT_PROVIDER_CODE,
  AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY,
  CIERRE_FONDO_VENTAS_PROVIDER_NAME,
  CIERRE_FONDO_VENTAS_MINUTES_BEFORE_END,
  CIERRE_FONDO_VENTAS_MINUTES_AFTER_END,
  APERTURA_CAJA_PROVIDER_CODE,
  FONDO_KEY_SUFFIX,
  SHARED_COMPANY_STORAGE_KEY,
  NAMESPACE_PERMISSIONS,
  NAMESPACE_DESCRIPTIONS,
} from "../constants";

import { useV2MovementsHydration } from "../hooks/useV2MovementsHydration";
import {
  type WriteBatch,
} from "firebase/firestore";

import {
  isAutoAdjustmentProvider,
  isFondoMovementType,
  isIngresoType,
  isGastoType,
  isEgresoType,
  formatMovementType,
  hasGeneralClosingAdjustmentNotes,
  hasGeneralClosingNoDiffNotes,
  isInventoryPurchaseProviderType,
  normalizeInvoiceDocType,
  resolveEffectiveEgresoAmount,
  isPaidFcrMovement,
  getPrimaryMovementDateISO,
  getPrimaryMovementTime,
  getPrimaryMovementManager,

  roundCreditNotePaymentAmount,

  buildStorageKey,

  isMovementAccountKey,
  getAccountKeyFromNamespace,

  sanitizeFondoEntries,
  formatToastWaitTime,
  type PendingCreditNoteOption,
} from "../utils/helpers";
import {
  buildV2MovementsCacheKey,
  resolveV2DocKey,
} from "../utils/v2movements";
import { useFondoMovementTypes } from "../hooks/useFondoMovementTypes";
import { useSuperAdminUsers } from "../hooks/useSuperAdminUsers";
import { useFondoFilters } from "../hooks/useFondoFilters";
import { useDailyClosingState } from "../hooks/useDailyClosingState";
import { useMovementForm } from "../hooks/useMovementForm";
import { useClosingInvoicePayment } from "../hooks/useClosingInvoicePayment";
import { usePendingClosingCreditInvoices } from "../hooks/usePendingClosingCreditInvoices";
import { useFondoCompanyResolution } from "../hooks/useFondoCompanyResolution";
import { useFondoCompanyMetadata } from "../hooks/useFondoCompanyMetadata";
import { usePendingCierreDeCajaStatus } from "../hooks/usePendingCierreDeCajaStatus";
import {
  isMovementLocked as isMovementLockedFn,
  isCierreFondoVentasMovement as isCierreFondoVentasMovementFn,
  handleDeleteMovement as handleDeleteMovementFn,
  confirmDeleteMovement as confirmDeleteMovementFn,
  cancelDeleteMovement as cancelDeleteMovementFn,
} from "../utils/movementDeletion";

import {
  buildPhysicalCountStorageKey as buildPhysicalCountStorageKeyFn,
  cleanupPhysicalCountLegacyKeys as cleanupPhysicalCountLegacyKeysFn,
  handleCancelPhysicalCount as handleCancelPhysicalCountFn,
  handleConfirmPhysicalCount as handleConfirmPhysicalCountFn,
  shouldPromptPhysicalCount as shouldPromptPhysicalCountFn,
} from "../utils/physicalCount";
import { handleDeleteLatestDailyClosing as deleteLatestDailyClosingFn, persistCreatedMovement as persistCreatedMovementFn } from "../utils/mutations";

const AccessRestrictedMessage = ({ description }: { description: string }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
    <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
      Acceso restringido
    </h3>
    <p className="text-[var(--muted-foreground)]">{description}</p>
    <p className="text-sm text-[var(--muted-foreground)] mt-2">
      Contacta a un administrador para obtener acceso.
    </p>
  </div>
);

// SHARED_COMPANY_STORAGE_KEY moved to constants.ts

export function FondoSection({
  id,
  mode = "all",
  namespace = "fg",
  companySelectorPlacement = "content",
  onCompanySelectorChange,
}: {
  id?: string;
  mode?: "all" | "ingreso" | "egreso";
  namespace?: string;
  companySelectorPlacement?: "content" | "external";
  onCompanySelectorChange?: (node: React.ReactNode | null) => void;
}) {
  const [quickRange, setQuickRange] = React.useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const assignedCompany = user?.ownercompanie?.trim() ?? "";
  const { ownerIds: actorOwnerIds, primaryOwnerId } = useActorOwnership(user);
  const isAdminUser = user?.role === "admin";
  const isSuperAdminUser = user?.role === "superadmin";
  const isRegularUser = user?.role === "user";
  const [superAdminTotalsOpen, setSuperAdminTotalsOpen] = useState(false);
  const [cashOpeningModalOpen, setCashOpeningModalOpen] = useState(false);
  const [cashOpeningInitialValues, setCashOpeningInitialValues] =
    useState<CashOpeningFormValues | null>(null);
  const openingSubmitInProgressRef = useRef(false);
  const canSelectCompany = isAdminUser || isSuperAdminUser;
  const [resolvedCompany, setResolvedCompany] = useState(() => assignedCompany);
  const [adminCompany, setAdminCompany] = useState(() => {
    if (typeof window === "undefined") return assignedCompany;
    try {
      const stored = localStorage.getItem(SHARED_COMPANY_STORAGE_KEY);
      return stored || assignedCompany;
    } catch {
      return assignedCompany;
    }
  });
  const company = canSelectCompany
    ? adminCompany
    : resolvedCompany || assignedCompany;
  const {
    providers,
    loading: providersLoading,
    error: providersError,
  } = useProviders(company);
  const { showToast } = useToast();
  const {
    ownerAdminEmail,
    ownerCompaniesLoading,
    ownerCompaniesError,
    sortedOwnerCompanies,
    activeOwnerId,
    activeEmpresaForCompany,
    resolvedOwnerId,
  } = useFondoCompanyResolution({
    user,
    authLoading,
    actorOwnerIds,
    primaryOwnerId,
    assignedCompany,
    canSelectCompany,
    isAdminUser,
    company,
    adminCompany,
    setResolvedCompany,
    setAdminCompany,
  });
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const hasGeneralAccess = Boolean(permissions.fondogeneral);
  const requiredPermissionKey =
    NAMESPACE_PERMISSIONS[namespace] || "fondogeneral";
  const hasSpecificAccess = Boolean(permissions[requiredPermissionKey]);
  const canAccessSection =
    namespace === "fg"
      ? hasGeneralAccess
      : hasGeneralAccess && hasSpecificAccess;
  const namespaceDescription =
    NAMESPACE_DESCRIPTIONS[namespace] || "esta sección del Fondo General";
  const accountKey = useMemo(
    () => getAccountKeyFromNamespace(namespace),
    [namespace],
  );

  // Caja Negra: proveedores fijos y detección

  // Caja Negra: proveedores fijos y detección
  const isCajaNegra = accountKey === "CajaNegra";
  const cajaNegraProviders: Array<{
    code: string;
    name: string;
    type?: FondoMovementType;
    category?: "Ingreso" | "Gasto" | "Egreso";
    correonotifi?: string;
  }> = useMemo(
    () => [
      {
        code: "0000",
        name: "INGRESO DESDE FG",
        category: "Ingreso",
        type: "OTROS",
      },
      {
        code: "0001",
        name: "RETIRO",
        category: "Egreso",
        type: "OTROS",
      },
      {
        code: "0002",
        name: "SALIDA A FONDO GENERAL",
        category: "Egreso",
        type: "OTROS",
      },
    ],
    [],
  );

  const movementProviders: Array<{
    code: string;
    name: string;
    type?: FondoMovementType;
    category?: "Ingreso" | "Gasto" | "Egreso";
    correonotifi?: string;
  }> = isCajaNegra
    ? cajaNegraProviders
    : (providers as Array<{
        code: string;
        name: string;
        type?: FondoMovementType;
        category?: "Ingreso" | "Gasto" | "Egreso";
        correonotifi?: string;
      }>);
  const movementProvidersLoading = isCajaNegra ? false : providersLoading;

  const [missingShiftModalOpen, setMissingShiftModalOpen] = useState(false);
  const [missingShiftExpectedShift, setMissingShiftExpectedShift] =
    useState<ShiftCode>("D");
  const [missingShiftDateKey, setMissingShiftDateKey] = useState("");

  const isDelifoodCompany = useMemo(() => {
    const normalize = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    const normalizedCompany = normalize(company);
    const normalizedEmpresaName = normalize(activeEmpresaForCompany?.name);

    return normalizedCompany === "delifood" || normalizedEmpresaName === "delifood";
  }, [activeEmpresaForCompany?.name, company]);

  const { fondoTypesLoaded, ingresoTypes, gastoTypes, egresoTypes } =
    useFondoMovementTypes(activeOwnerId);

  const [fondoEntries, setFondoEntries] = useState<FondoEntry[]>([]);
  const { companyEmployees, employeesLoading, companyData } =
    useFondoCompanyMetadata({ company, namespace });
  const empresaForShiftResolution = useMemo<Empresas | null>(() => {
    if (!activeEmpresaForCompany && !companyData) return null;
    if (!activeEmpresaForCompany) return companyData;
    if (!companyData) return activeEmpresaForCompany;

    const activeEmployees = Array.isArray(activeEmpresaForCompany.empleados)
      ? activeEmpresaForCompany.empleados
      : [];
    const metadataEmployees = Array.isArray(companyData.empleados)
      ? companyData.empleados
      : [];

    return {
      ...activeEmpresaForCompany,
      ...companyData,
      empleados:
        metadataEmployees.length >= activeEmployees.length
          ? metadataEmployees
          : activeEmployees,
    };
  }, [activeEmpresaForCompany, companyData]);
  const {
    getFGMonthlySchedulesCached,
    resolveShiftManagerForNow,
    resolveShiftTimingForNow,
  } = useShiftScheduleResolver({
    company,
    empresa: empresaForShiftResolution,
    closingMovements: fondoEntries,
    providers,
  });
  const cierreFondoVentasMinutesBeforeEnd =
    empresaForShiftResolution?.cierreFondoVentasMinutesBeforeEnd ??
    CIERRE_FONDO_VENTAS_MINUTES_BEFORE_END;
  const cierreFondoVentasMinutesAfterEnd =
    empresaForShiftResolution?.cierreFondoVentasMinutesAfterEnd ??
    CIERRE_FONDO_VENTAS_MINUTES_AFTER_END;

  const [
    selectedProviderPendingCreditNotes,
    setSelectedProviderPendingCreditNotes,
  ] = useState<PendingCreditNoteOption[]>([]);
  const [selectedAppliedCreditNoteIds, setSelectedAppliedCreditNoteIds] =
    useState<string[]>([]);
  const [selectedPendingCreditInvoiceIds, setSelectedPendingCreditInvoiceIds] =
    useState<string[]>([]);

  // Snapshot de balances persistidos. NO depende de `fondoEntries` para evitar
  // que filtros (rango de fecha) alteren el currentBalance.
  const [ledgerSnapshot, setLedgerSnapshot] = useState<{
    initialCRC: number;
    currentCRC: number;
    initialUSD: number;
    currentUSD: number;
  }>(() => ({
    initialCRC: 0,
    currentCRC: 0,
    initialUSD: 0,
    currentUSD: 0,
  }));

  const {
    pendingClosingCreditInvoices,
    setPendingClosingCreditInvoices,
    pendingCreditNotes,
    pendingZeroAmountCreditNotes,
  } = usePendingClosingCreditInvoices({ company });
  const [
    showPendingClosingCreditInvoices,
    setShowPendingClosingCreditInvoices,
  ] = useState(false);
  const [expandedClosings, setExpandedClosings] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFcrInfoRows, setExpandedFcrInfoRows] = useState<Set<string>>(
    new Set(),
  );
  const [expandedAppliedCreditNotesRows, setExpandedAppliedCreditNotesRows] =
    useState<Set<string>>(new Set());
  const [manualCreditNoteOpen, setManualCreditNoteOpen] = useState(false);
  const [manualCreditNoteTarget, setManualCreditNoteTarget] =
    useState<FondoEntry | null>(null);
  const [manualCreditNoteInvoiceNumber, setManualCreditNoteInvoiceNumber] =
    useState("");
  const [manualCreditNoteAmount, setManualCreditNoteAmount] = useState("");
  const [manualCreditNoteObservation, setManualCreditNoteObservation] =
    useState("");
  const [manualCreditNoteSaving, setManualCreditNoteSaving] = useState(false);
  const [manualCreditNoteError, setManualCreditNoteError] = useState("");
  const [manualCreditNoteDraft, setManualCreditNoteDraft] = useState<{
    invoiceNumber: string;
    amount: number;
    observation?: string;
  } | null>(null);
  const [pendingCierreModalOpen, setPendingCierreModalOpen] = useState(false);
  const [
    pendingZeroAmountCreditNoteModalOpen,
    setPendingZeroAmountCreditNoteModalOpen,
  ] = useState(false);
  const [negativeBalanceModal, setNegativeBalanceModal] = useState<{
    open: boolean;
    amount: number;
    currency: "CRC" | "USD";
    resultingNegativeAmount: number;
  }>({ open: false, amount: 0, currency: "CRC", resultingNegativeAmount: 0 });

  const isComponentMountedRef = useRef(true);
  const dailyClosingSubmitInProgressRef = useRef<boolean>(false);
  const lastDailyClosingSavedAtRef = useRef<number>(0);
  const deleteLatestClosingInProgressRef = useRef<boolean>(false);

  // SAVE_COOLDOWN_MS → SAVE_COOLDOWN_MS
  // buildClosingGuardDocId, acquireClosingGuard, touchClosingGuard,
  // releaseClosingGuard, forceClearClosingGuards moved to utils/closingGuards.ts

  const fondoFilters = useFondoFilters({
    fondoEntries,
    movementProviders,
    mode,
  });
  const {
    pageSize,
    setPageSize,
    pageIndex,
    setPageIndex,
    currentDailyKey,
    todayKey,
    providersMap,
    sortAsc,
    setSortAsc,
    fromFilter,
    setFromFilter,
    toFilter,
    setToFilter,
    calendarFromOpen,
    setCalendarFromOpen,
    calendarToOpen,
    setCalendarToOpen,
    calendarFromMonth,
    setCalendarFromMonth,
    calendarToMonth,
    setCalendarToMonth,
    filterProviderCode,
    setFilterProviderCode,
    setProviderFilter,
    isProviderDropdownOpen,
    setIsProviderDropdownOpen,
    providerSearchInput,
    setProviderSearchInput,
    filteredProvidersForFilter,
    filterPaymentType,
    setFilterPaymentType,
    setTypeFilter,
    isTypeDropdownOpen,
    setIsTypeDropdownOpen,
    typeSearchInput,
    setTypeSearchInput,
    filterEditedOnly,
    setFilterEditedOnly,
    filtersDropdownOpen,
    setFiltersDropdownOpen,
    searchQuery,
    setSearchQuery,
    rememberFilters,
    setRememberFilters,
    keepFiltersAcrossCompanies,
    setKeepFiltersAcrossCompanies,
    columnWidths,
    setColumnWidths,
    resizingRef,
    startResizing,
    filtersDropdownRef,
    fromCalendarRef,
    toCalendarRef,
    fromButtonRef,
    toButtonRef,
    filteredEntries,
    totalPages,
    isDailyMode,
    disablePrevButton,
    disableNextButton,
    pageRange,
    handlePrevPage,
    handleNextPage,
    groupedByDay,
    formatGroupLabel,
    formatKeyToDisplay,
    isSingleDayFilter,
  } = fondoFilters;

  const {
    dailyClosingModalOpen,
    setDailyClosingModalOpen,
    editingDailyClosingId,
    setEditingDailyClosingId,
    dailyClosingInitialValues,
    setDailyClosingInitialValues,
    dailyClosings,
    setDailyClosings,
    dailyClosingsHydrated,
    setDailyClosingsHydrated,
    dailyClosingsRefreshing,
    setDailyClosingsRefreshing,
    dailyClosingHistoryOpen,
    setDailyClosingHistoryOpen,
    dailyClosingHistoryRange,
    setDailyClosingHistoryRange,
    beginDailyClosingsRequest,
    finishDailyClosingsRequest,
    latestDailyClosingLabel,
    dailyClosingDateFormatter,
    dailyClosingsRequestCountRef,
    loadedDailyClosingKeysRef,
    loadingDailyClosingKeysRef,
  } = useDailyClosingState({ company, accountKey });
  const {
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
    confirmDeleteEntry,
    setConfirmDeleteEntry,
    lastEditSaveTimestampRef,
    editingInProgressRef,
    movementSubmitInProgressRef,
    lastMovementDedupeRef,
    lastMovementCreatedAtRef,
    editingEntry,
    editingProviderCode,
    isEditingPaidFcrMovement,
    handleEgresoChange,
    handleIngresoChange,
    handleNotesChange,
    handleManagerChange,
    handleManager2Change,
    cancelOpenCreateMovement,
  } = useMovementForm({ mode, fondoEntries });
  const { superAdminUsers, superAdminUsersLoading } = useSuperAdminUsers(
    Boolean(isSuperAdminUser),
    editingEntryId,
  );

  const [entriesHydrated, setEntriesHydrated] = useState(false);
  const [hydratedCompany, setHydratedCompany] = useState("");
  const [hydratedAccountKey, setHydratedAccountKey] =
    useState<MovementAccountKey>(accountKey);
  const { pendingCierreDeCaja, setPendingCierreDeCaja } =
    usePendingCierreDeCajaStatus({
      entriesHydrated,
      providers,
      fondoEntries,
      dailyClosings,
      getPrimaryMovementTime,
      isAutoAdjustmentProvider,
      cierreFondoVentasProviderName: CIERRE_FONDO_VENTAS_PROVIDER_NAME,
    });
  const {
    movementsLoading,
    beginMovementsLoading,
    endMovementsLoading,
  } = useMovementsLoadingState({ isComponentMountedRef });
  const [currencyEnabled, setCurrencyEnabled] = useState<
    Record<MovementCurrencyKey, boolean>
  >({
    CRC: true,
    USD: true,
  });
  const enabledBalanceCurrencies = useMemo(
    () =>
      (["CRC", "USD"] as MovementCurrencyKey[]).filter(
        (currency) => currencyEnabled[currency],
      ),
    [currencyEnabled],
  );

  const buildPhysicalCountStorageKey = useCallback(
    () => buildPhysicalCountStorageKeyFn(accountKey, company),
    [company, accountKey],
  );

  const cleanupPhysicalCountLegacyKeys = useCallback(
    () => cleanupPhysicalCountLegacyKeysFn(accountKey, company),
    [accountKey, company],
  );

  const shouldPromptPhysicalCount = useCallback(
    (): boolean => shouldPromptPhysicalCountFn(accountKey, company),
    [accountKey, company],
  );
  // Audit modal state: show full before/after history when an edited entry is clicked
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditModalData, setAuditModalData] = useState<{
    history?: any[];
  } | null>(null);
  // Keep latest accountKey without re-triggering full remote reloads on tab switch.
  const accountKeyRef = useRef<MovementAccountKey>(accountKey);
  useEffect(() => {
    accountKeyRef.current = accountKey;
  }, [accountKey]);
  const {
    storageSnapshotRef,
    v2MovementsCacheRef,
    applyLedgerStateFromStorage,
    rebuildEntriesFromV2Cache,
    ensureV2MovementsLoaded,
  } = useV2MovementsHydration({
    company,
    resolvedOwnerId,
    accountKey,
    pageSize,
    pageIndex,
    entriesHydrated,
    movementCurrency,
    currencyEnabled,
    currentDailyKey,
    todayKey,
    fromFilter,
    toFilter,
    fondoEntriesLength: fondoEntries.length,
    beginMovementsLoading,
    endMovementsLoading,
    setFondoEntries,
    setCurrencyEnabled,
    setInitialAmount,
    setInitialAmountUSD,
    setLedgerSnapshot,
    setMovementCurrency,
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const delta = e.clientX - r.startX;
      const newW = Math.max(40, r.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [r.key]: `${newW}px` }));
    };
    const onUp = () => {
      resizingRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [columnWidths]);

  // Close calendars when clicking outside them (but don't close when clicking the toggle buttons)
  useEffect(() => {
    if (!calendarFromOpen && !calendarToOpen) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (calendarFromOpen) {
        if (
          fromCalendarRef.current &&
          target &&
          fromCalendarRef.current.contains(target)
        )
          return;
        if (
          fromButtonRef.current &&
          target &&
          fromButtonRef.current.contains(target)
        )
          return;
        setCalendarFromOpen(false);
      }
      if (calendarToOpen) {
        if (
          toCalendarRef.current &&
          target &&
          toCalendarRef.current.contains(target)
        )
          return;
        if (
          toButtonRef.current &&
          target &&
          toButtonRef.current.contains(target)
        )
          return;
        setCalendarToOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [calendarFromOpen, calendarToOpen]);

  useEffect(() => {
    if (!filtersDropdownOpen) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        filtersDropdownRef.current &&
        filtersDropdownRef.current.contains(target)
      )
        return;
      setFiltersDropdownOpen(false);
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filtersDropdownOpen]);

  const isIngreso = isIngresoType(paymentType);
  const isEgreso = isEgresoType(paymentType) || isGastoType(paymentType);

  // Superadmin: when creating a movement, auto-assign the manager to themselves.

  // Superadmin: when creating a movement, auto-assign the manager to themselves.
  useEffect(() => {
    if (!isSuperAdminUser) return;
    if (!movementModalOpen) return;
    if (editingEntryId) return;

    const fallback = (user?.email || "").trim();
    const name = (user?.name || "").trim() || fallback;
    if (!name) return;

    if (manager !== name) {
      setManager(name);
      setManagerError("");
    }
  }, [
    isSuperAdminUser,
    movementModalOpen,
    editingEntryId,
    user?.name,
    user?.email,
    manager,
  ]);

  const employeeOptions = useMemo(() => {
    // Superadmin + editing: allow selecting ANY user.
    if (isSuperAdminUser && editingEntryId) {
      const unique = new Set<string>();
      const push = (value: unknown) => {
        const name = String(value || "").trim();
        if (name) unique.add(name);
      };

      superAdminUsers.forEach((u) => push(u?.name));
      // Ensure self is always selectable even if name doesn't exist in DB
      push(user?.name);
      push(user?.email);
      // Keep current value visible/selectable even if it's not a known user
      push(manager);

      return Array.from(unique).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      );
    }

    const employees = companyEmployees
      .map((name) => (typeof name === "string" ? name.trim() : ""))
      .filter(Boolean);

    // Si el usuario actual es admin, agregarlo a la lista de empleados
    if (user?.role === "admin" && user?.name) {
      const adminName = user.name.trim();
      if (!employees.includes(adminName)) {
        return [adminName, ...employees];
      }
    }

    // Superadmin (create): include self so the manager can be auto-assigned.
    if (isSuperAdminUser) {
      const name = (user?.name || "").trim() || (user?.email || "").trim();
      if (name && !employees.includes(name)) {
        return [name, ...employees];
      }
    }

    return employees;
  }, [
    companyEmployees,
    user,
    isSuperAdminUser,
    editingEntryId,
    superAdminUsers,
    manager,
  ]);

  useEffect(() => {
    const normalizedCompany = (company || "").trim();
    const normalizedCompanyLower = normalizedCompany.toLowerCase();

    // NO cargar movimientos si los tipos aún no están listos
    if (normalizedCompany.length === 0 || !fondoTypesLoaded) {
      setEntriesHydrated(false);
      setHydratedCompany("");
      setFondoEntries([]);
      storageSnapshotRef.current = null;
      return;
    }

    setEntriesHydrated(false);
    setHydratedCompany("");
    setFondoEntries([]);
    storageSnapshotRef.current = null;
    let isMounted = true;

    const matchesSelectedCompany = (
      storage?: MovementStorage<FondoEntry> | null,
    ) => {
      if (!storage) return false;
      const storedCompany = (storage.company || "").trim();
      if (storedCompany.length === 0) return true;
      return storedCompany.toLowerCase() === normalizedCompanyLower;
    };

    const loadEntries = async () => {
      beginMovementsLoading();
      try {
        const legacyOwnerKey = resolvedOwnerId
          ? MovimientosFondosService.buildLegacyOwnerMovementsKey(
              resolvedOwnerId,
            )
          : null;
        type StorageEntriesResult = {
          entries: FondoEntry[];
          storage: MovementStorage<FondoEntry>;
        };

        const buildEntriesFromStorage = (
          rawStorage: unknown,
          movementsOverride?: unknown[] | null,
          targetAccountKey: MovementAccountKey = accountKeyRef.current,
        ): StorageEntriesResult | null => {
          if (!rawStorage) return null;
          try {
            const storage =
              MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
                rawStorage,
                normalizedCompany,
              );
            const movements = Array.isArray(movementsOverride)
              ? (movementsOverride as unknown[])
              : (storage.operations?.movements ?? []);
            const scopedEntries = movements.filter((rawEntry) => {
              const candidate = rawEntry as Partial<FondoEntry>;
              const movementAccount = isMovementAccountKey(candidate.accountId)
                ? candidate.accountId
                : targetAccountKey;
              return movementAccount === targetAccountKey;
            });
            const entries = sanitizeFondoEntries(
              scopedEntries,
              undefined,
              targetAccountKey,
            ).sort(
              (a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a),
            );
            return { entries, storage };
          } catch (err) {
            console.error("Error parsing stored fondo entries:", err);
            return null;
          }
        };

        const buildEntriesFromRaw = (
          rawData: string | null,
        ): StorageEntriesResult | null => {
          if (!rawData) return null;
          try {
            const parsed = JSON.parse(rawData);
            return buildEntriesFromStorage(parsed);
          } catch (err) {
            console.error("Error parsing stored fondo entries:", err);
            return null;
          }
        };

        const loadRemoteEntries = async (
          docKey: string,
        ): Promise<{
          result: StorageEntriesResult | null;
          status: "success" | "not-found" | "error";
        }> => {
          if (!docKey) return { result: null, status: "error" };
          try {
            const remoteStorage =
              await MovimientosFondosService.getDocument<FondoEntry>(docKey);
            if (!remoteStorage) {
              return { result: null, status: "not-found" };
            }

            // Prefer V2 movements subcollection to avoid document overwrites/truncation.
            let v2Movements: FondoEntry[] = [];
            try {
              const targetAccountKey = accountKeyRef.current;
              const cacheKey = buildV2MovementsCacheKey(
                docKey,
                targetAccountKey,
              );
              const cached = v2MovementsCacheRef.current[cacheKey];
              if (cached?.loaded) {
                v2Movements = Array.isArray(cached.movements)
                  ? cached.movements
                  : [];
              } else {
                // Default remote load: only the active day/range (today unless both Desde/Hasta are set).
                await ensureV2MovementsLoaded(docKey);
                const next = v2MovementsCacheRef.current[cacheKey];
                v2Movements = Array.isArray(next?.movements)
                  ? (next!.movements as FondoEntry[])
                  : [];
              }
            } catch (listErr) {
              console.error(
                `[FG-V2] Error listing v2 movements (${docKey}):`,
                listErr,
              );
            }

            // One-time migration: if v2 is empty but legacy array has movements.
            try {
              const legacyMovements = (remoteStorage.operations?.movements ??
                []) as FondoEntry[];
              if (
                v2Movements.length === 0 &&
                Array.isArray(legacyMovements) &&
                legacyMovements.length > 0
              ) {
                const hasAny =
                  await MovimientosFondosService.hasAnyV2Movements(docKey);
                if (!hasAny) {
                  console.warn(
                    `[FG-V2] Migrating legacy movements to v2 (${docKey})`,
                    { legacyCount: legacyMovements.length },
                  );
                  const { migrated } =
                    await MovimientosFondosService.migrateLegacyMovementsToV2<FondoEntry>(
                      docKey,
                      legacyMovements,
                    );
                  console.warn(`[FG-V2] Migration completed (${docKey})`, {
                    migrated,
                  });

                  // Clear legacy movements from main document to prevent future truncation/overwrites.
                  const cleaned =
                    MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
                      remoteStorage,
                      normalizedCompany,
                    );
                  cleaned.operations = { movements: [] };
                  await MovimientosFondosService.saveDocument(docKey, cleaned);

                  // After migration, load only the active day/range.
                  await ensureV2MovementsLoaded(docKey);
                  const cacheKey = buildV2MovementsCacheKey(
                    docKey,
                    accountKeyRef.current,
                  );
                  const next = v2MovementsCacheRef.current[cacheKey];
                  v2Movements = Array.isArray(next?.movements)
                    ? (next!.movements as FondoEntry[])
                    : [];
                }
              }
            } catch (migrateErr) {
              console.error(
                `[FG-V2] Error migrating legacy movements (${docKey}):`,
                migrateErr,
              );
            }

            return {
              result: buildEntriesFromStorage(
                remoteStorage,
                v2Movements,
                accountKeyRef.current,
              ),
              status: "success",
            };
          } catch (err) {
            console.error(
              `Error reading fondo entries from Firestore (${docKey}):`,
              err,
            );
            return { result: null, status: "error" };
          }
        };

        const companyKey =
          MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
        let resolvedEntries: FondoEntry[] | null = null;
        let resolvedState: MovementStorageState | null = null;
        let hasResolvedSource = false;
        let remoteConfirmedNotFound = false;
        let remoteAnyError = false;

        const assignResult = (result: StorageEntriesResult | null) => {
          if (!result) return false;
          if (!matchesSelectedCompany(result.storage)) return false;
          resolvedEntries = result.entries;
          resolvedState = result.storage?.state ?? null;
          // Keep snapshot lean: movements are stored in v2 subcollection.
          storageSnapshotRef.current = {
            ...result.storage,
            operations: { movements: [] },
          };
          hasResolvedSource = true;
          return true;
        };

        const tryRemoteKey = async (docKey: string | null) => {
          if (!docKey || hasResolvedSource) return;
          const { result, status } = await loadRemoteEntries(docKey);
          if (status === "error") {
            remoteAnyError = true;
            return;
          }
          if (status === "not-found") {
            remoteConfirmedNotFound = true;
            return;
          }
          if (status === "success" && result) {
            assignResult(result);
          }
        };

        await tryRemoteKey(companyKey);

        if (
          !hasResolvedSource &&
          legacyOwnerKey &&
          legacyOwnerKey !== companyKey
        ) {
          await tryRemoteKey(legacyOwnerKey);
        }

        if (!hasResolvedSource && remoteConfirmedNotFound && !remoteAnyError) {
          const emptyStorage =
            MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
              normalizedCompany,
            );
          storageSnapshotRef.current = emptyStorage;
          resolvedEntries = [];
          resolvedState = emptyStorage.state;
          hasResolvedSource = true;
          localStorage.removeItem(companyKey);
          if (legacyOwnerKey && legacyOwnerKey !== companyKey) {
            localStorage.removeItem(legacyOwnerKey);
          }
          const legacyKey = buildStorageKey(namespace, FONDO_KEY_SUFFIX);
          localStorage.removeItem(legacyKey);
        }

        if (!hasResolvedSource) {
          assignResult(buildEntriesFromRaw(localStorage.getItem(companyKey)));
        }

        if (
          !hasResolvedSource &&
          legacyOwnerKey &&
          legacyOwnerKey !== companyKey
        ) {
          assignResult(
            buildEntriesFromRaw(localStorage.getItem(legacyOwnerKey)),
          );
        }

        if (!hasResolvedSource) {
          const legacyKey = buildStorageKey(namespace, FONDO_KEY_SUFFIX);
          const legacyRaw = localStorage.getItem(legacyKey);
          if (legacyRaw) {
            try {
              const legacyParsed = JSON.parse(legacyRaw);
              const parsedEntries = sanitizeFondoEntries(
                legacyParsed,
                undefined,
                accountKeyRef.current,
              );
              if (parsedEntries.length > 0) {
                resolvedEntries = parsedEntries;
                const fallbackStorage =
                  MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
                    normalizedCompany,
                  );
                fallbackStorage.operations.movements = parsedEntries.map(
                  (entry) => ({
                    ...entry,
                    accountId: accountKeyRef.current,
                  }),
                );
                storageSnapshotRef.current = fallbackStorage;
              }
            } catch (err) {
              console.error("Error parsing legacy fondo entries:", err);
            }
          }
        }

        if (isMounted) {
          setFondoEntries(resolvedEntries ?? []);
          if (resolvedState) {
            applyLedgerStateFromStorage(resolvedState);
          }
        }
      } catch (err) {
        console.error("Error reading fondo entries:", err);
        if (isMounted) {
          setFondoEntries([]);
        }
      } finally {
        if (isMounted) {
          setHydratedCompany(normalizedCompany);
          setHydratedAccountKey(accountKeyRef.current);
          setEntriesHydrated(true);
          endMovementsLoading();
        }
      }
    };

    void loadEntries();

    return () => {
      isMounted = false;
    };
  }, [
    namespace,
    resolvedOwnerId,
    company,
    fondoTypesLoaded,
    applyLedgerStateFromStorage,
    beginMovementsLoading,
    endMovementsLoading,
  ]);

  // When switching tabs, do not reload from Firestore: just filter cached v2 movements in-memory.
  useEffect(() => {
    if (!entriesHydrated) return;
    const docKey = resolveV2DocKey({ company, resolvedOwnerId, v2MovementsCache: v2MovementsCacheRef.current, accountKey: accountKeyRef.current, MovimientosFondosService });
    if (!docKey) return;
    const cacheKey = buildV2MovementsCacheKey(docKey, accountKey);
    const cached = v2MovementsCacheRef.current[cacheKey];
    if (!cached?.loaded) return;

    const scopedEntries = cached.movements.filter((rawEntry) => {
      const candidate = rawEntry as Partial<FondoEntry>;
      const movementAccount = isMovementAccountKey(candidate.accountId)
        ? candidate.accountId
        : accountKey;
      return movementAccount === accountKey;
    });

    const entries = sanitizeFondoEntries(
      scopedEntries,
      undefined,
      accountKey,
    ).sort((a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a));
    setFondoEntries(entries);

    const state = storageSnapshotRef.current?.state;
    if (state) {
      applyLedgerStateFromStorage(state);
    }

    setHydratedAccountKey(accountKey);
  }, [
    accountKey,
    entriesHydrated,
    applyLedgerStateFromStorage,
  ]);

  useEffect(() => {
    if (!entriesHydrated || hydratedAccountKey !== accountKey) return;
    const normalizedCompany = (company || "").trim();
    if (normalizedCompany.length === 0) return;

    const hasCashOpening = fondoEntries.some(
      (entry) =>
        entry.providerCode === APERTURA_CAJA_PROVIDER_CODE ||
        String(entry.providerCode || "").trim().toUpperCase() ===
          APERTURA_CAJA_PROVIDER_CODE,
    );

    try {
      const key = buildPhysicalCountStorageKeyFn(accountKey, normalizedCompany);
      if (key) localStorage.setItem(key, hasCashOpening ? "false" : "true");
    } catch {
      // ignore
    }
  }, [
    accountKey,
    company,
    entriesHydrated,
    fondoEntries,
    hydratedAccountKey,
  ]);

  // On-demand v2 loading: keep Firestore reads constrained to the active day/range.
  useEffect(() => {
    if (!entriesHydrated) return;
    const docKey = resolveV2DocKey({ company, resolvedOwnerId, v2MovementsCache: v2MovementsCacheRef.current, accountKey: accountKeyRef.current, MovimientosFondosService });
    if (!docKey) return;

    // Only query the remote range when BOTH Desde/Hasta are set.
    if ((fromFilter && !toFilter) || (!fromFilter && toFilter)) return;

    void ensureV2MovementsLoaded(docKey);
  }, [
    entriesHydrated,
    pageSize,
    fromFilter,
    toFilter,
    currentDailyKey,
    ensureV2MovementsLoaded,
  ]);

  useEffect(() => {
    if (!selectedProvider) return;
    const exists = movementProviders.some((p) => p.code === selectedProvider);
    const isEditingSameProvider =
      editingEntryId && editingProviderCode === selectedProvider;
    if (!exists && !isEditingSameProvider) {
      setSelectedProvider("");
    }
  }, [
    movementProviders,
    selectedProvider,
    editingEntryId,
    editingProviderCode,
  ]);

  useEffect(() => {
    // Keep legacy validation for non-superadmin actors.
    // Superadmin may select users outside the company employee list when editing.
    if (isSuperAdminUser) return;
    if (manager && !employeeOptions.includes(manager)) {
      setManager("");
    }
  }, [manager, employeeOptions, isSuperAdminUser]);

  useEffect(() => {
    if (isIngreso) {
      setEgreso("");
    } else {
      setIngreso("");
    }
  }, [paymentType, isIngreso]);

  useEffect(() => {
    if (invoiceDocType !== "FCO" || !isEgreso) {
      setSelectedAppliedCreditNoteIds([]);
    }
  }, [invoiceDocType, isEgreso]);


  const resetFondoForm = useCallback(() => {
    setSelectedProvider("");
    setInvoiceNumber("");
    setInvoiceDocType("FCO");
    setEgreso("");
    setIngreso("");
    setManager("");
    setManager2("");
    setSelectedAppliedCreditNoteIds([]);
    setSelectedPendingCreditInvoiceIds([]);
    setManualCreditNoteDraft(null);
    setManualCreditNoteOpen(false);
    setManualCreditNoteTarget(null);
    setManualCreditNoteInvoiceNumber("");
    setManualCreditNoteAmount("");
    setManualCreditNoteObservation("");
    setManualCreditNoteError("");
    setPaymentType("COMPRA INVENTARIO");
    setNotes("");
    setEditingEntryId(null);
    // Clear all validation errors
    setProviderError("");
    setInvoiceError("");
    setAmountError("");
    setManagerError("");
    setManager2Error("");
    editingInProgressRef.current = false;
  }, []);

  /**
   * Envía un correo de notificación cuando se crea o edita un movimiento,
   * solo si el proveedor tiene configurado un correo de notificación.
   */


  /**
   * Función auxiliar para persistir movimientos a Firestore de forma inmediata.
    * Retorna true si se guardó correctamente, false si hubo error.
   */
  const persistMovementToFirestore = useCallback(
    (
      updatedEntries: FondoEntry[],
      operationType: "create" | "edit" | "delete",
      change?: {
        upsert?: FondoEntry;
        deleteId?: string;
        before?: FondoEntry | null;
      },
      extraWrites?: (batch: WriteBatch) => void,
    ) =>
      persistMovementToFirestoreFn(
        updatedEntries,
        operationType,
        change,
        extraWrites,
        {
          company,
          accountKey,
          initialAmount,
          initialAmountUSD,
          currencyEnabled,
          ledgerSnapshot,
          storageSnapshotRef,
          v2MovementsCacheRef,
        },
      ),
    [
      company,
      accountKey,
      initialAmount,
      initialAmountUSD,
      currencyEnabled,
      ledgerSnapshot,
    ],
  );

  const {
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
    handleMovementCreditInvoiceSelect,
    closingPaymentAvailableCreditNotes,
    closingPaymentCreditNotesTotal,
    submitClosingInvoicePayment,
  } = useClosingInvoicePayment({
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
  });

  const handleDeleteLatestDailyClosing = useCallback(
    (reason: string) =>
      deleteLatestDailyClosingFn(reason, {
        isSuperAdminUser,
        company,
        accountKey,
        user,
        fondoEntries,
        setFondoEntries,
        setLedgerSnapshot,
        setDailyClosings,
        setExpandedClosings,
        setPendingCierreDeCaja,
        persistMovementToFirestore,
        buildPhysicalCountStorageKey,
        cleanupPhysicalCountLegacyKeys,
        showToast,
        deleteLatestClosingInProgressRef,
        lastDailyClosingSavedAtRef,
        lastMovementCreatedAtRef,
        lastMovementDedupeRef,
        storageSnapshotRef,
      }),
    [
      isSuperAdminUser,
      company,
      accountKey,
      user,
      fondoEntries,
      setFondoEntries,
       setLedgerSnapshot,
      setDailyClosings,
      setExpandedClosings,
      setPendingCierreDeCaja,
      persistMovementToFirestore,
      buildPhysicalCountStorageKey,
      cleanupPhysicalCountLegacyKeys,
      showToast,
      deleteLatestClosingInProgressRef,
      lastDailyClosingSavedAtRef,
      lastMovementCreatedAtRef,
      lastMovementDedupeRef,
      storageSnapshotRef,
    ],
  );

  const persistCreatedMovement = useCallback(
    (entry: FondoEntry, updatedEntries: FondoEntry[]) =>
      persistCreatedMovementFn(entry, updatedEntries, {
        persistMovementToFirestore,
        showToast,
        providers,
        accountKey,
        company,
        user,
        buildPhysicalCountStorageKey,
        cleanupPhysicalCountLegacyKeys,
        resetFondoForm,
        movementAutoCloseLocked,
        isCajaNegra,
        setFondoEntries,
        setLedgerSnapshot,
        setPendingCierreDeCaja,
        setMovementModalOpen,
        editingInProgressRef,
        lastMovementDedupeRef,
        lastMovementCreatedAtRef,
      }),
    [
      persistMovementToFirestore,
      showToast,
      providers,
      accountKey,
      company,
      user,
      buildPhysicalCountStorageKey,
      cleanupPhysicalCountLegacyKeys,
      resetFondoForm,
      movementAutoCloseLocked,
      isCajaNegra,
      setFondoEntries,
      setLedgerSnapshot,
      setPendingCierreDeCaja,
      setMovementModalOpen,
      editingInProgressRef,
      lastMovementDedupeRef,
      lastMovementCreatedAtRef,
    ],
  );

  useEffect(() => {
    const shouldAuto =
      isRegularUser &&
      accountKey === "FondoGeneral" &&
      namespace === "fg" &&
      movementModalOpen;

    if (!shouldAuto) {
      setManagerLockedByShift(false);
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const nowISO = new Date().toISOString();
        const resolution = await resolveShiftManagerForNow(nowISO);
        if (cancelled || !resolution) return;

        if (resolution.mode === "manual") {
          setManagerLockedByShift(false);
          return;
        }

        if (resolution.mode === "missing") {
          setManagerLockedByShift(false);
          return;
        }

        setManagerLockedByShift(true);
        if (resolution.mode === "auto") {
          setManager(resolution.manager);
          setManagerError("");
        }
      } catch (err) {
        console.error("[FG] Error auto-locking manager by shift:", err);
      }
    };

    void tick();
    const interval = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    accountKey,
    isRegularUser,
    movementModalOpen,
    namespace,
    resolveShiftManagerForNow,
  ]);

  const handleSubmitFondo = async () => {
    await handleSubmitFondoFn({
      company,
      isSaving,
      movementSubmitInProgressRef,
      manager,
      isCajaNegra,
      editingEntryId,
      getTodayInvoiceMMDD,
      invoiceNumber,
      invoiceDocType,
      selectedProvider,
      setProviderError,
      selectedProviderExists,
      editingEntry,
      setInvoiceError,
      isRegularUser,
      accountKey,
      namespace,
      isDelifoodCompany,
      activeEmpresaForCompany,
      getFGMonthlySchedulesCached,
      setMissingShiftExpectedShift,
      setMissingShiftDateKey,
      setMissingShiftModalOpen,
      setManager,
      setManagerError,
      manager2,
      isEditingPaidFcrMovement,
      setManager2Error,
      isEgreso,
      isIngreso,
      egreso,
      ingreso,
      notes,
      movementProviders,
      paymentType,
      setAmountError,
      showToast,
      selectedAppliedCreditNoteIds,
      selectedProviderPendingCreditNotes,
      setPendingZeroAmountCreditNoteModalOpen,
      isAdminUser,
      isSuperAdminUser,
      ledgerSnapshot,
      fondoEntries,
      initialAmount,
      lastMovementCreatedAtRef,
      lastMovementDedupeRef,
      lastEditSaveTimestampRef,
      setIsSaving,
      editingInProgressRef,
      persistMovementToFirestore,
      persistCreatedMovement,
      setFondoEntries,
      setLedgerSnapshot,
      movementAutoCloseLocked,
      resetFondoForm,
      setMovementModalOpen,
      ownerAdminEmail,
      activeOwnerId,
      user,
      manualCreditNoteDraft,
      setSelectedProviderPendingCreditNotes,
      setSelectedAppliedCreditNoteIds,
      pendingClosingCreditInvoices,
      selectedPendingCreditInvoiceIds,
      setPendingClosingCreditInvoices,
      selectedProviderPendingCreditInvoices,
      setSelectedPendingCreditInvoiceIds,
      v2MovementsCacheRef,
      rebuildEntriesFromV2Cache,
      applyLedgerStateFromStorage,
      storageSnapshotRef,
      setNegativeBalanceModal,
      providers,
      movementCurrency,
    });
  };

  const startEditingEntry = (entry: FondoEntry) => {
        // Verificar si hay una edición en progreso o guardada recientemente (últimos 2 segundos)
    const now = Date.now();
    const timeSinceLastEdit = now - lastEditSaveTimestampRef.current;

    if (editingInProgressRef.current) {
      showToast(
        "Ya hay una edición en progreso. Completa o cancela la edición actual antes de editar otro movimiento.",
        "warning",
        5000,
      );
      return;
    }

    if (timeSinceLastEdit < 2000) {
      showToast(
        "Debes esperar un momento antes de editar otro movimiento.",
        "warning",
        4000,
      );
      return;
    }

    // Marcar que hay una edición en progreso
    editingInProgressRef.current = true;

    // Allow editing of entries even if previously edited; we accumulate audit history.
    setEditingEntryId(entry.id);
    setSelectedProvider(entry.providerCode);
    // Determine the correct payment type: use provider's type if exists, else entry's type
    const correctPaymentType =
      providerTypesMap.get(entry.providerCode) ?? entry.paymentType;
    setPaymentType(correctPaymentType);
    setInvoiceNumber(entry.invoiceNumber);
    setInvoiceDocType(normalizeInvoiceDocType((entry as any).invoiceDocType) as "FCO" | "FCR");
    setManager(entry.manager);
    setManager2(String((entry as any).manager2 || ""));
    setSelectedAppliedCreditNoteIds([]);
    setNotes(entry.notes ?? "");
    setMovementCurrency((entry.currency as "CRC" | "USD") ?? "CRC");
    // Set amounts based on the correct payment type, using the entry's amounts
    const isEgreso =
      isEgresoType(correctPaymentType) || isGastoType(correctPaymentType);
    if (isEgreso) {
      setEgreso(
        Math.trunc(entry.amountEgreso || entry.amountIngreso).toString(),
      );
      setIngreso("");
    } else {
      setIngreso(
        Math.trunc(entry.amountIngreso || entry.amountEgreso).toString(),
      );
      setEgreso("");
    }
    setMovementModalOpen(true);
  };

  const isMovementLocked = useCallback(
    (entry: FondoEntry): boolean =>
      isMovementLockedFn(entry, {
        accountKey,
        storageSnapshotRef,
      }),
    [accountKey],
  );

  const handleEditMovement = (entry: FondoEntry) => {
    // Superadmin should not edit "CIERRE FONDO VENTAS"; they should delete it.
    if (isSuperAdminUser && isCierreFondoVentasMovement(entry)) {
      showToast(
        'Este "CIERRE FONDO VENTAS" no se edita. Debe eliminarse.',
        "info",
        5000,
      );
      return;
    }

    if (isMovementLocked(entry)) {
      showToast(
        "Este movimiento está bloqueado (anterior al último cierre).",
        "info",
        5000,
      );
      return;
    }

    if (isAutoAdjustmentProvider(entry.providerCode)) {
      showToast("Los ajustes automáticos no se pueden editar.", "info", 5000);
      return;
    }

    if (
      Array.isArray(entry.appliedCreditNotes) &&
      entry.appliedCreditNotes.length > 0
    ) {
      showToast(
        "Este movimiento tiene notas de crédito aplicadas y no se puede editar.",
        "info",
        5000,
      );
      return;
    }

    // If this movement was generated from a daily closing, open the daily-closing modal
    // prefilled with that closing's values so the user edits the closing (not the generic movement).
    if (entry.originalEntryId) {
      const closingId = entry.originalEntryId;
      const record = dailyClosings.find((d) => d.id === closingId);
      if (!record) {
        // If we don't have the closing record locally, fall back to the generic editor.
        startEditingEntry(entry);
        return;
      }

      const initial: DailyClosingFormValues = {
        closingDate: record.closingDate,
        manager: record.manager,
        notes: record.notes ?? "",
        totalCRC: record.totalCRC ?? 0,
        totalUSD: record.totalUSD ?? 0,
        breakdownCRC: record.breakdownCRC ?? {},
        breakdownUSD: record.breakdownUSD ?? {},
      };
      setEditingDailyClosingId(record.id);
      setDailyClosingInitialValues(initial);
      setDailyClosingModalOpen(true);
      return;
    }

    // Default: open generic movement editor
    startEditingEntry(entry);
  };

  const cancelEditing = () => {
    closeMovementModal();
  };

  const openManualCreditNoteModal = () => {
    const currentMovementAmount = Math.max(
      0,
      Math.trunc(Number(isEgreso ? egreso : ingreso) || 0),
    );
    setManualCreditNoteTarget({
      id: "manual-credit-note-draft",
      providerCode: selectedProvider,
      invoiceNumber,
      paymentType,
      amountEgreso: isEgreso ? currentMovementAmount : 0,
      amountIngreso: isEgreso ? 0 : currentMovementAmount,
      manager,
      manager2: manager2 || undefined,
      notes,
      createdAt: new Date().toISOString(),
      currency: movementCurrency,
      accountId: accountKey,
      empresa: company,
      invoiceDocType: invoiceDocType === "FCR" ? "FCR" : "FCO",
    });
    setManualCreditNoteInvoiceNumber(
      manualCreditNoteDraft?.invoiceNumber ?? "",
    );
    setManualCreditNoteAmount(
      manualCreditNoteDraft ? String(manualCreditNoteDraft.amount) : "",
    );
    setManualCreditNoteObservation(manualCreditNoteDraft?.observation ?? "");
    setManualCreditNoteError("");
    setManualCreditNoteOpen(true);
  };

  const closeManualCreditNoteModal = () => {
    if (manualCreditNoteSaving) return;
    setManualCreditNoteOpen(false);
    setManualCreditNoteTarget(null);
    setManualCreditNoteInvoiceNumber("");
    setManualCreditNoteAmount("");
    setManualCreditNoteObservation("");
    setManualCreditNoteError("");
  };

  const handleSaveManualCreditNote = async () => {
    await handleSaveManualCreditNoteFn({
      manualCreditNoteTarget,
      company,
      manualCreditNoteInvoiceNumber,
      manualCreditNoteAmount,
      manualCreditNoteObservation,
      setManualCreditNoteError,
      setManualCreditNoteSaving,
      setManualCreditNoteDraft,
      setSelectedAppliedCreditNoteIds,
      showToast,
      closeManualCreditNoteModal,
    });
  };

  // Check if current user is the principal admin (owner) of the company
  const isPrincipalAdmin = useMemo(() => {
    if (!isAdminUser) return false;
    const companyOwnerId = String(companyData?.ownerId || "").trim();
    if (!companyOwnerId) return false;
    return actorOwnerIds.some((ownerId) => String(ownerId) === companyOwnerId);
  }, [actorOwnerIds, companyData?.ownerId, isAdminUser]);

  const cierreFondoVentasProviderCode = useMemo(() => {
    const found = providers.find(
      (p) =>
        (p?.name || "").toString().toUpperCase() ===
        CIERRE_FONDO_VENTAS_PROVIDER_NAME,
    );
    return found?.code || null;
  }, [providers]);

  const latestCierreFondoVentasMovementId = useMemo(() => {
    if (!fondoEntries || fondoEntries.length === 0) return null;

    const isVentas = (e: FondoEntry) => {
      if (cierreFondoVentasProviderCode) {
        return e.providerCode === cierreFondoVentasProviderCode;
      }
      const providerName = providers
        .find((p) => p.code === e.providerCode)
        ?.name?.toUpperCase();
      return providerName === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
    };

    const matches = fondoEntries.filter(isVentas);
    if (matches.length === 0) return null;

    const toMs = (iso: unknown) => {
      try {
        const ms = new Date(String(iso || "")).getTime();
        return Number.isFinite(ms) ? ms : 0;
      } catch {
        return 0;
      }
    };

    let best = matches[0];
    let bestMs = toMs(best.createdAt);
    for (let i = 1; i < matches.length; i++) {
      const cur = matches[i];
      const curMs = toMs(cur.createdAt);
      if (curMs > bestMs) {
        best = cur;
        bestMs = curMs;
        continue;
      }
      if (
        curMs === bestMs &&
        String(cur.id).localeCompare(String(best.id)) > 0
      ) {
        best = cur;
        bestMs = curMs;
      }
    }
    return best?.id || null;
  }, [fondoEntries, providers, cierreFondoVentasProviderCode]);

  const isCierreFondoVentasMovement = useCallback(
    (entry: FondoEntry): boolean =>
      isCierreFondoVentasMovementFn(entry, {
        providers,
        cierreFondoVentasProviderCode,
      }),
    [providers, cierreFondoVentasProviderCode],
  );

  const handleDeleteMovement = useCallback(
    (entry: FondoEntry) => {
      void handleDeleteMovementFn(entry, {
        accountKey,
        company,
        providers,
        cierreFondoVentasProviderCode,
        latestCierreFondoVentasMovementId,
        isPrincipalAdmin,
        isSuperAdminUser,
        showToast,
        setConfirmDeleteEntry,
        storageSnapshotRef,
      });
    },
    [
      accountKey,
      company,
      providers,
      cierreFondoVentasProviderCode,
      latestCierreFondoVentasMovementId,
      isPrincipalAdmin,
      isSuperAdminUser,
      showToast,
      setConfirmDeleteEntry,
      storageSnapshotRef,
    ],
  );

  const confirmDeleteMovement = useCallback(
    () => {
      void confirmDeleteMovementFn({
        accountKey,
        company,
        providers,
        cierreFondoVentasProviderCode,
        latestCierreFondoVentasMovementId,
        isPrincipalAdmin,
        isSuperAdminUser,
        isSaving,
        showToast,
        setConfirmDeleteEntry,
        confirmDeleteEntry,
        setIsSaving,
        fondoEntries,
        setFondoEntries,
        setLedgerSnapshot,
        persistMovementToFirestore,
        user,
        storageSnapshotRef,
        lastDailyClosingSavedAtRef,
        lastMovementCreatedAtRef,
        lastMovementDedupeRef,
      });
    },
    [
      accountKey,
      company,
      providers,
      cierreFondoVentasProviderCode,
      latestCierreFondoVentasMovementId,
      isPrincipalAdmin,
      isSuperAdminUser,
      isSaving,
      showToast,
      setConfirmDeleteEntry,
      confirmDeleteEntry,
      setIsSaving,
      fondoEntries,
      setFondoEntries,
       setLedgerSnapshot,
      persistMovementToFirestore,
      user,
      storageSnapshotRef,
      lastDailyClosingSavedAtRef,
      lastMovementCreatedAtRef,
      lastMovementDedupeRef,
    ],
  );

  const cancelDeleteMovement = useCallback(() => {
    void cancelDeleteMovementFn({
      setConfirmDeleteEntry,
    });
  }, [setConfirmDeleteEntry]);

  const isProviderSelectDisabled =
    !company || movementProvidersLoading || movementProviders.length === 0;
  // Detectar si estamos editando un movimiento EXISTENTE de CIERRE FONDO VENTAS (bloquear cambio de proveedor)
  // Solo aplica cuando editamos, no cuando creamos un nuevo movimiento
  const isEditingCierreFondoVentas = useMemo(() => {
    if (!editingEntryId) return false;
    // Buscar el movimiento original que se está editando
    const originalEntry = fondoEntries.find((e) => e.id === editingEntryId);
    if (!originalEntry) return false;
    // Verificar si el proveedor ORIGINAL del movimiento es CIERRE FONDO VENTAS
    const originalProvider = providers.find(
      (p) => p.code === originalEntry.providerCode,
    );
    return (
      originalProvider?.name?.toUpperCase() ===
      CIERRE_FONDO_VENTAS_PROVIDER_NAME
    );
  }, [editingEntryId, fondoEntries, providers]);

  const providerTypesMap = useMemo(() => {
    const map = new Map<string, FondoMovementType>();
    movementProviders.forEach((p) => {
      if (p.type && isFondoMovementType(p.type)) {
        map.set(p.code, p.type);
        return;
      }

      if (p.category === "Ingreso") {
        const fallback = ingresoTypes[0];
        if (fallback) map.set(p.code, fallback);
        return;
      }

      if (p.category === "Gasto") {
        const fallback = gastoTypes[0];
        if (fallback) map.set(p.code, fallback);
        return;
      }

      if (p.category === "Egreso") {
        const fallback = egresoTypes[0];
        if (fallback) map.set(p.code, fallback);
      }
    });
    return map;
  }, [movementProviders, ingresoTypes, gastoTypes, egresoTypes]);
  const selectedProviderExists = selectedProvider
    ? movementProviders.some((p) => p.code === selectedProvider)
    : false;

  // reset page when filters change so user sees first page of filtered results
  useEffect(() => {
    setPageIndex(0);
  }, [
    filterProviderCode,
    filterPaymentType,
    filterEditedOnly,
    searchQuery,
    fromFilter,
    toFilter,
  ]);

  const invoiceValid =
    /^[0-9]{1,4}$/.test(invoiceNumber) || invoiceNumber.length === 0;
  const egresoValue = Number.parseInt(egreso, 10);
  const ingresoValue = Number.parseInt(ingreso, 10);
  const egresoValid = isEgreso
    ? !Number.isNaN(egresoValue) && egresoValue > 0
    : true;
  const ingresoValid = isIngreso
    ? !Number.isNaN(ingresoValue) && ingresoValue > 0
    : true;
  const requiredAmountProvided = isEgreso
    ? egreso.trim().length > 0
    : ingreso.trim().length > 0;

  const selectedAppliedCreditNotes = useMemo(() => {
    if (!isEgreso || editingEntryId) return [];
    const selectedIds = new Set(selectedAppliedCreditNoteIds);
    const availableNotes =
      manualCreditNoteDraft && invoiceDocType === "FCO"
        ? [
            {
              id: "manual-nc-draft",
              invoiceNumber: manualCreditNoteDraft.invoiceNumber,
              amount: manualCreditNoteDraft.amount,
              balanceDue: manualCreditNoteDraft.amount,
              currency: movementCurrency,
            },
            ...selectedProviderPendingCreditNotes,
          ]
        : selectedProviderPendingCreditNotes;

    return availableNotes.filter(
      (note) => selectedIds.has(note.id) && note.currency === movementCurrency,
    );
  }, [
    editingEntryId,
    invoiceDocType,
    isEgreso,
    manualCreditNoteDraft,
    movementCurrency,
    selectedAppliedCreditNoteIds,
    selectedProviderPendingCreditNotes,
  ]);

  const movementPendingCreditNotes = useMemo(
    () =>
      invoiceDocType === "FCO"
        ? manualCreditNoteDraft
          ? [
              {
                id: "manual-nc-draft",
                invoiceNumber: manualCreditNoteDraft.invoiceNumber,
                amount: manualCreditNoteDraft.amount,
                balanceDue: manualCreditNoteDraft.amount,
                currency: movementCurrency,
              },
              ...selectedProviderPendingCreditNotes,
            ]
          : selectedProviderPendingCreditNotes
        : [],
    [invoiceDocType, manualCreditNoteDraft, movementCurrency, selectedProviderPendingCreditNotes],
  );

  const selectedProviderType = selectedProvider
    ? providerTypesMap.get(selectedProvider) ?? ""
    : "";
  const isCompraInventarioProvider =
    selectedProviderType.trim().toUpperCase() === "COMPRA INVENTARIO";

  const creditNotesAppliedTotal = useMemo(() => {
    let remaining = Math.max(0, Math.trunc(Number(egreso) || 0));
    let total = 0;
    selectedAppliedCreditNotes.forEach((note) => {
      if (remaining <= 0) return;
      const applied = Math.min(
        remaining,
        Math.max(0, Math.trunc(Number(note.balanceDue) || 0)),
      );
      total += applied;
      remaining -= applied;
    });
    return total;
  }, [egreso, selectedAppliedCreditNotes]);

  const computedAmountPayment = isEgreso
    ? roundCreditNotePaymentAmount(
        Math.max(0, Math.trunc(Number(egreso) || 0) - creditNotesAppliedTotal),
        movementCurrency,
        accountKey,
      )
    : undefined;

  useEffect(() => {
    setSelectedAppliedCreditNoteIds((prev) =>
      prev.filter((id) =>
        selectedProviderPendingCreditNotes.some(
          (note) => note.id === id && note.currency === movementCurrency,
        ),
      ),
    );
  }, [movementCurrency, selectedProviderPendingCreditNotes]);

  const { currentBalanceCRC, currentBalanceUSD } = useMemo(() => {
    return {
      // currentBalance debe ser el balance real persistido, no el del rango filtrado.
      // Si el usuario ajusta initialBalance, reflejamos el delta sin depender de movimientos cargados.
      currentBalanceCRC:
        ledgerSnapshot.currentCRC +
        ((Number(initialAmount) || 0) - ledgerSnapshot.initialCRC),
      currentBalanceUSD:
        ledgerSnapshot.currentUSD +
        ((Number(initialAmountUSD) || 0) - ledgerSnapshot.initialUSD),
    };
  }, [ledgerSnapshot, initialAmount, initialAmountUSD]);

  const balanceAfterByIdCRC = useMemo(() => {
    // Derivar balances desde el currentBalance real (persistido), no desde initialAmount + subset.
    // Caminamos hacia atrás: balanceAfter(entry) se obtiene restando deltas de movimientos más recientes.
    let running = Math.trunc(currentBalanceCRC);
    const orderedDesc = [...fondoEntries]
      .filter((e) => ((e.currency as any) || "CRC") === "CRC")
      .sort((a, b) => {
        const diff = getPrimaryMovementTime(b) - getPrimaryMovementTime(a);
        if (diff !== 0) return diff;
        return String(b.id).localeCompare(String(a.id));
      });
    const map = new Map<string, number>();
    orderedDesc.forEach((entry) => {
      map.set(entry.id, running);
      running -= Math.trunc(entry.amountIngreso || 0);
      running += resolveEffectiveEgresoAmount(entry);
    });
    return map;
  }, [fondoEntries, currentBalanceCRC]);

  const balanceAfterByIdUSD = useMemo(() => {
    let running = Math.trunc(currentBalanceUSD);
    const orderedDesc = [...fondoEntries]
      .filter((e) => ((e.currency as any) || "CRC") === "USD")
      .sort((a, b) => {
        const diff = getPrimaryMovementTime(b) - getPrimaryMovementTime(a);
        if (diff !== 0) return diff;
        return String(b.id).localeCompare(String(a.id));
      });
    const map = new Map<string, number>();
    orderedDesc.forEach((entry) => {
      map.set(entry.id, running);
      running -= Math.trunc(entry.amountIngreso || 0);
      running += resolveEffectiveEgresoAmount(entry);
    });
    return map;
  }, [fondoEntries, currentBalanceUSD]);

  useEffect(() => {
    if (!entriesHydrated || hydratedAccountKey !== accountKey) return;
    const normalizedCompany = (company || "").trim();
    if (
      normalizedCompany.length === 0 ||
      hydratedCompany.toLowerCase() !== normalizedCompany.toLowerCase()
    ) {
      return;
    }

    const persistEntries = async () => {
      const companyKey =
        MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
      let storageToPersist: MovementStorage<FondoEntry> | null = null;

      const normalizedInitialCRC =
        initialAmount.trim().length > 0 ? initialAmount.trim() : "0";
      const normalizedInitialUSD =
        initialAmountUSD.trim().length > 0 ? initialAmountUSD.trim() : "0";
      const hasSnapshot = Boolean(storageSnapshotRef.current);
      const metadataDiffers =
        normalizedInitialCRC !== "0" ||
        normalizedInitialUSD !== "0" ||
        !currencyEnabled.CRC ||
        !currencyEnabled.USD;

      if (!hasSnapshot && !metadataDiffers) {
        return;
      }

      try {
        const baseStorage = storageSnapshotRef.current
          ? MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
              storageSnapshotRef.current,
              normalizedCompany,
            )
          : MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
              normalizedCompany,
            );
        baseStorage.company = normalizedCompany;
        // V2: movements are stored in a subcollection. Never persist movements array to main doc.
        baseStorage.operations = { movements: [] };

        const stateSnapshot =
          baseStorage.state ??
          MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
            normalizedCompany,
          ).state;
        const parsedInitialCRC = Number(normalizedInitialCRC) || 0;
        const parsedInitialUSD = Number(normalizedInitialUSD) || 0;

        const parseBalance = (value: unknown) => {
          const parsed = typeof value === "number" ? value : Number(value);
          return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
        };

        const existingCRC = stateSnapshot.balancesByAccount.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === "CRC",
        );
        const existingUSD = stateSnapshot.balancesByAccount.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === "USD",
        );

        const prevInitialCRC = parseBalance(existingCRC?.initialBalance ?? 0);
        const prevInitialUSD = parseBalance(existingUSD?.initialBalance ?? 0);
        const prevCurrentCRC = parseBalance(
          existingCRC?.currentBalance ?? prevInitialCRC,
        );
        const prevCurrentUSD = parseBalance(
          existingUSD?.currentBalance ?? prevInitialUSD,
        );

        // Cambiar initialBalance ajusta currentBalance por el mismo delta.
        // No dependemos de `fondoEntries` porque pueden ser parciales por filtros.
        const nextCurrentCRC =
          prevCurrentCRC + (parsedInitialCRC - prevInitialCRC);
        const nextCurrentUSD =
          prevCurrentUSD + (parsedInitialUSD - prevInitialUSD);

        const nextCRC = {
          accountId: accountKey,
          currency: "CRC" as const,
          enabled: currencyEnabled.CRC,
          initialBalance: parsedInitialCRC,
          currentBalance: nextCurrentCRC,
        };
        const nextUSD = {
          accountId: accountKey,
          currency: "USD" as const,
          enabled: currencyEnabled.USD,
          initialBalance: parsedInitialUSD,
          currentBalance: nextCurrentUSD,
        };

        const crcChanged =
          !existingCRC ||
          existingCRC.enabled !== nextCRC.enabled ||
          existingCRC.initialBalance !== nextCRC.initialBalance ||
          existingCRC.currentBalance !== nextCRC.currentBalance;
        const usdChanged =
          !existingUSD ||
          existingUSD.enabled !== nextUSD.enabled ||
          existingUSD.initialBalance !== nextUSD.initialBalance ||
          existingUSD.currentBalance !== nextUSD.currentBalance;

        // If nothing changed for this account, do not write back to Firestore/localStorage.
        if (!crcChanged && !usdChanged) {
          return;
        }

        const nextAccountBalances = stateSnapshot.balancesByAccount.filter(
          (balance) => balance.accountId !== accountKey,
        );
        nextAccountBalances.push(nextCRC, nextUSD);
        stateSnapshot.balancesByAccount = nextAccountBalances;
        stateSnapshot.updatedAt = new Date().toISOString();
        // Preservar lockedUntil del snapshot actual si existe
        if (storageSnapshotRef.current?.state?.lockedUntil) {
          stateSnapshot.lockedUntil =
            storageSnapshotRef.current.state.lockedUntil;
        }
        baseStorage.state = stateSnapshot;

        // Sync UI snapshot
        setLedgerSnapshot({
          initialCRC: parsedInitialCRC,
          currentCRC: nextCurrentCRC,
          initialUSD: parsedInitialUSD,
          currentUSD: nextCurrentUSD,
        });

        // Guardar snapshot liviano en localStorage
        try {
          localStorage.setItem(companyKey, JSON.stringify(baseStorage));
        } catch (storageError) {
          console.warn(
            "[FG-V2] localStorage snapshot write failed:",
            storageError,
          );
        }

        const legacyKey = buildStorageKey(namespace, FONDO_KEY_SUFFIX);
        localStorage.removeItem(legacyKey);

        if (resolvedOwnerId) {
          const legacyOwnerKey =
            MovimientosFondosService.buildLegacyOwnerMovementsKey(
              resolvedOwnerId,
            );
          if (legacyOwnerKey !== companyKey) {
            localStorage.removeItem(legacyOwnerKey);
          }
        }

        storageSnapshotRef.current = baseStorage;
        storageToPersist = baseStorage;
      } catch (err) {
        console.error("Error preparing fondo entries for persistence:", err);
      }

      if (!storageToPersist) return;

      try {
        await MovimientosFondosService.saveDocument(
          companyKey,
          storageToPersist,
        );
      } catch (err) {
        console.error("Error storing fondo entries to Firestore:", err);
      }
    };

    void persistEntries();
  }, [
    namespace,
    entriesHydrated,
    company,
    hydratedCompany,
    resolvedOwnerId,
    currencyEnabled,
    initialAmount,
    initialAmountUSD,
    accountKey,
    hydratedAccountKey,
    setLedgerSnapshot,
  ]);

  const isSubmitDisabled =
    !company ||
    (!editingEntryId && isProviderSelectDisabled) ||
    !invoiceValid ||
    !requiredAmountProvided ||
    !egresoValid ||
    !ingresoValid ||
    (!isEditingPaidFcrMovement && !manager) ||
    employeesLoading ||
    isSaving;

  const amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );
  const amountFormatterUSD = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [],
  );
  const formatByCurrency = (currency: "CRC" | "USD", value: number) =>
    currency === "USD"
      ? `$ ${amountFormatterUSD.format(Math.trunc(value))}`
      : `₡ ${amountFormatter.format(Math.trunc(value))}`;

  const pendingSupplierPaymentAlerts = useMemo(() => {
    const map = new Map<
      string,
      { providerCode: string; providerName: string; count: number; crc: number; usd: number }
    >();

    pendingClosingCreditInvoices.forEach((invoice) => {
      const totalAmount = Math.max(
        0,
        Math.trunc(Number(invoice.originalAmount ?? invoice.amount) || 0),
      );
      const paidAmount = Math.max(
        0,
        Math.trunc(Number(invoice.paidAmount) || 0),
      );
      const balanceAmount = Math.max(
        0,
        Math.trunc(Number(invoice.balanceDue ?? totalAmount - paidAmount) || 0),
      );
      if (balanceAmount <= 0) return;

      const providerCode = invoice.providerCode;
      const current =
        map.get(providerCode) ??
        {
          providerCode,
          providerName: providersMap.get(providerCode) ?? providerCode,
          count: 0,
          crc: 0,
          usd: 0,
        };
      current.count += 1;
      if (invoice.currency === "USD") current.usd += balanceAmount;
      else current.crc += balanceAmount;
      map.set(providerCode, current);
    });

    return Array.from(map.values()).sort((a, b) => {
      const balanceA = a.crc + a.usd;
      const balanceB = b.crc + b.usd;
      if (balanceB !== balanceA) return balanceB - balanceA;
      return a.providerName.localeCompare(b.providerName, "es");
    });
  }, [pendingClosingCreditInvoices, providersMap]);

  const selectedProviderPendingPaymentAlert = useMemo(
    () =>
      selectedProvider
        ? pendingSupplierPaymentAlerts.find(
            (item) => item.providerCode === selectedProvider,
          ) ?? null
        : null,
    [pendingSupplierPaymentAlerts, selectedProvider],
  );

  const pendingCreditNotesByProvider = useMemo(() => {
    const map = new Map<string, number>();
    pendingCreditNotes.forEach((entry) => {
      const balanceDue = Math.max(
        0,
        Math.abs(
          Math.trunc(Number(entry.balanceDue ?? entry.amountDue ?? entry.amount) || 0),
        ),
      );
      if (balanceDue <= 0) return;
      const providerCode = String(entry.providerCode || "").trim();
      if (!providerCode) return;
      map.set(providerCode, (map.get(providerCode) ?? 0) + 1);
    });
    return map;
  }, [pendingCreditNotes]);

  const providerPendingCounts = useMemo(() => {
    const map = new Map<
      string,
      { pendingCreditNotesCount: number; pendingCreditInvoicesCount: number }
    >();

    pendingSupplierPaymentAlerts.forEach((item) => {
      map.set(item.providerCode, {
        pendingCreditNotesCount: 0,
        pendingCreditInvoicesCount: item.count,
      });
    });

    pendingCreditNotesByProvider.forEach((count, providerCode) => {
      const current =
        map.get(providerCode) ?? {
          pendingCreditNotesCount: 0,
          pendingCreditInvoicesCount: 0,
        };
      current.pendingCreditNotesCount = count;
      map.set(providerCode, current);
    });

    return map;
  }, [pendingCreditNotesByProvider, pendingSupplierPaymentAlerts]);

  const selectedProviderPendingNcCount = selectedProvider
    ? providerPendingCounts.get(selectedProvider)?.pendingCreditNotesCount ?? 0
    : 0;

  useEffect(() => {
    if (!selectedProvider || isCajaNegra) {
      setSelectedProviderPendingCreditNotes([]);
      return;
    }

    setSelectedProviderPendingCreditNotes(
      pendingCreditNotes
        .filter((note) => note.providerCode === selectedProvider)
        .map((note) => {
          const totalAmount = Math.max(
            0,
            Math.abs(Math.trunc(Number(note.originalAmount ?? note.amount) || 0)),
          );
          const paidAmount = Math.max(
            0,
            Math.trunc(Number(note.paidAmount) || 0),
          );
          const balanceDue = Math.max(
            0,
            Math.abs(Math.trunc(Number(note.balanceDue ?? totalAmount - paidAmount) || 0)),
          );
          return {
            id: note.id,
            invoiceNumber: note.invoiceNumber,
            amount: totalAmount,
            balanceDue,
            paidAmount,
            currency: (note.currency === "USD" ? "USD" : "CRC") as "CRC" | "USD",
          };
        })
        .filter((note) => note.balanceDue > 0),
    );
  }, [isCajaNegra, pendingCreditNotes, selectedProvider]);

  const selectedProviderPendingCreditInvoices = useMemo(
    () =>
      selectedProvider && !isCajaNegra
        ? pendingClosingCreditInvoices
            .filter((invoice) => invoice.providerCode === selectedProvider)
            .map((invoice) => {
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
                Math.trunc(
                  Number(invoice.balanceDue ?? totalAmount - paidAmount) || 0,
                ),
              );
              return {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: totalAmount,
                balanceDue,
                currency: (invoice.currency === "USD" ? "USD" : "CRC") as "CRC" | "USD",
              };
            })
            .filter((invoice) => invoice.balanceDue > 0)
        : [],
        [isCajaNegra, pendingClosingCreditInvoices, selectedProvider],
  );

  const filteredProvidersForMovement = useMemo(
    () =>
      movementProviders.map((provider) => {
        const pending = providerPendingCounts.get(provider.code);
        return {
          ...provider,
          pendingCreditNotesCount: pending?.pendingCreditNotesCount ?? 0,
          pendingCreditInvoicesCount: pending?.pendingCreditInvoicesCount ?? 0,
        };
      }),
    [movementProviders, providerPendingCounts],
  );

  useEffect(() => {
    if (!isEgreso || editingEntryId) {
      setSelectedPendingCreditInvoiceIds([]);
      return;
    }
    setSelectedPendingCreditInvoiceIds((prev) =>
      prev.filter((id) =>
        selectedProviderPendingCreditInvoices.some(
          (invoice) =>
            invoice.id === id && invoice.currency === movementCurrency,
        ),
      ),
    );
  }, [
    editingEntryId,
    isEgreso,
    movementCurrency,
    selectedProviderPendingCreditInvoices,
  ]);

  const formatDailyClosingDiff = (currency: "CRC" | "USD", diff: number) => {
    if (diff === 0) return "Sin diferencias";
    const sign = diff > 0 ? "+" : "-";
    return `${sign} ${formatByCurrency(currency, Math.abs(diff))}`;
  };

  const getDailyClosingDiffClass = (diff: number) => {
    if (diff === 0) return "text-[var(--muted-foreground)]";
    return diff > 0 ? "text-green-500" : "text-red-500";
  };

  const buildBreakdownLines = (
    currency: "CRC" | "USD",
    breakdown?: Record<number, number>,
  ) => {
    if (!breakdown) return [] as string[];
    return Object.entries(breakdown)
      .filter(([, count]) => count > 0)
      .map(
        ([denomination, count]) =>
          `${count} x ${formatByCurrency(currency, Number(denomination))}`,
      );
  };

  const amountClass = (
    isActive: boolean,
    inputHasValue: boolean,
    isValid: boolean,
  ) => {
    if (!isActive) return "border-[var(--input-border)]";
    if (inputHasValue && !isValid) return "border-red-500";
    return "border-[var(--input-border)]";
  };

  const getTodayInvoiceDDMM = (date: Date = new Date()) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}${mm}`;
  };

  const getTodayInvoiceMMDD = (date: Date = new Date()) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${mm}${dd}`;
  };

  const selectedProviderData = useMemo(() => {
    if (!selectedProvider) return null;
    return movementProviders.find((p) => p.code === selectedProvider) ?? null;
  }, [movementProviders, selectedProvider]);

  const isInvoiceDocTypeLockedToContado = useMemo(() => {
    // Solo aplica al crear; en edición se respeta el valor histórico.
    if (editingEntryId) return false;
    if (!selectedProvider) return false;
    // Regla de negocio: solo proveedores tipo COMPRA INVENTARIO pueden usar crédito (FCR)
    return !isInventoryPurchaseProviderType(selectedProviderData?.type);
  }, [editingEntryId, selectedProvider, selectedProviderData]);

  useEffect(() => {
    // Solo al agregar (no al editar): si el proveedor no es COMPRA INVENTARIO,
    // bloquear el tipo de factura a contado.
    if (editingEntryId) return;
    if (!isInvoiceDocTypeLockedToContado) return;
    if (invoiceDocType !== "FCO") setInvoiceDocType("FCO");
  }, [editingEntryId, invoiceDocType, isInvoiceDocTypeLockedToContado]);

  const isInvoiceAutoDateLocked = useMemo(() => {
    if (isCajaNegra) return true;
    if (!selectedProvider) return false;
    if (isAutoAdjustmentProvider(selectedProvider)) return true;
    if (selectedProvider.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME)
      return true;
    return (
      selectedProviderData?.name?.toUpperCase() ===
      CIERRE_FONDO_VENTAS_PROVIDER_NAME
    );
  }, [isCajaNegra, selectedProvider, selectedProviderData]);

   // Si el proveedor es un cierre/ajuste automático, usar DDMM como Nro. factura y bloquear edición.
  useEffect(() => {
    if (!isInvoiceAutoDateLocked) return;
    // Al editar un movimiento existente, no sobrescribir el Nro. factura guardado.
    if (editingEntryId) return;
    const today = isCajaNegra ? getTodayInvoiceMMDD() : getTodayInvoiceDDMM();
    if (invoiceNumber !== today) {
      setInvoiceNumber(today);
      setInvoiceError("");
    }
  }, [isInvoiceAutoDateLocked, editingEntryId, invoiceNumber, isCajaNegra]);

  const handleProviderChange = async (value: string) => {
    const prov = movementProviders.find((p) => p.code === value);
    const isCierreFondoVentasValue =
      !editingEntryId &&
      accountKey === "FondoGeneral" &&
      (String(value || "").trim().toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME ||
        prov?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME);

    if (isCierreFondoVentasValue) {
      try {
        const nowISO = await getAuthoritativeNowISO();
        const nowTiming = await resolveShiftTimingForNow(nowISO);
        if (nowTiming?.withinHorario) {
          const normalizeMin = (min: number) => {
            if (!Number.isFinite(min)) return 0;
            const m = Math.trunc(min) % 1440;
            return m < 0 ? m + 1440 : m;
          };
          const formatMinuteOfDay = (minute: number) => {
            const normalized = normalizeMin(minute);
            const hours = Math.floor(normalized / 60);
            const mins = normalized % 60;
            return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
          };
          const addMinutesToMinuteOfDay = (minute: number, delta: number) =>
            normalizeMin(minute + delta);

          const nowMin = normalizeMin(nowTiming.currentMin);
          const openMin = normalizeMin(nowTiming.openMin);
          const closeMin = normalizeMin(nowTiming.closeMin);
          const shiftDEndMin = normalizeMin(nowTiming.shiftChangeMin);
          const shiftNEndMin = closeMin;
          const isWithinCompanyHorario = (minute: number) => {
            if (openMin <= closeMin) {
              return minute >= openMin && minute <= closeMin;
            }
            return minute >= openMin || minute <= closeMin;
          };
          const closingsToday = fondoEntries
            .filter((e) => isCierreFondoVentasMovement(e))
            .filter((e) => {
              const info = getCostaRicaDateKeyAndMinute(String(e.createdAt || ""));
              return Boolean(info && info.dateKey === nowTiming.dateKey);
            })
            .filter((e) => {
              const info = getCostaRicaDateKeyAndMinute(String(e.createdAt || ""));
              return Boolean(info && isWithinCompanyHorario(normalizeMin(info.minuteOfDay)));
            })
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
          const closingShift: ShiftCode = closingsToday.length > 0 ? "N" : "D";
          const referenceShiftEndMin =
            closingShift === "D" ? shiftDEndMin : shiftNEndMin;
          const referenceShiftLabel = closingShift === "D" ? "D" : "N";
          const referenceShiftEndLabel =
            referenceShiftLabel === "D"
              ? formatMinuteOfDay(shiftDEndMin)
              : formatMinuteOfDay(shiftNEndMin);
          const referenceWindowStartLabel = formatMinuteOfDay(
            addMinutesToMinuteOfDay(
              referenceShiftEndMin,
              -cierreFondoVentasMinutesBeforeEnd,
            ),
          );
          const referenceWindowEndLabel = formatMinuteOfDay(
            addMinutesToMinuteOfDay(
              referenceShiftEndMin,
              cierreFondoVentasMinutesAfterEnd + 1,
            ),
          );
          const minutesUntilReferenceEnd =
            (referenceShiftEndMin - nowMin + 1440) % 1440;
          const minutesAfterReferenceEnd =
            (nowMin - referenceShiftEndMin + 1440) % 1440;
          const isInReferenceWindow =
            minutesUntilReferenceEnd <= cierreFondoVentasMinutesBeforeEnd ||
            minutesAfterReferenceEnd <= cierreFondoVentasMinutesAfterEnd;

          if (!isInReferenceWindow) {
            const humanDelta =
              nowMin < referenceShiftEndMin
                ? `Faltan ${minutesUntilReferenceEnd} min`
                : `Han pasado ${minutesAfterReferenceEnd} min`;
            showToast(
              `El \"CIERRE FONDO VENTAS\" solo se puede registrar desde las ${referenceWindowStartLabel} hasta las ${referenceWindowEndLabel} alrededor del fin del turno ${referenceShiftLabel} (${referenceShiftEndLabel}). ${humanDelta}.`,
              "warning",
              6000,
            );
            return;
          }

          // Enforzar 2 cierres por día: uno al final de D y otro al final de N (cierre).
          // Bloquear duplicados por ventana.
          try {
            const nowKey = getCostaRicaDateKeyAndMinute(nowISO)?.dateKey;
            if (nowKey) {
              const hasDCierre = closingsToday.length > 0;
              const hasNCierre = closingsToday.length > 1;

              if (closingShift === "D" && hasDCierre) {
                showToast(
                  `Ya existe un "CIERRE FONDO VENTAS" para el turno D (${formatMinuteOfDay(
                    shiftDEndMin,
                  )}) de hoy.`,
                  "warning",
                  5500,
                );
                return;
              }
              if (closingShift === "N" && hasNCierre) {
                showToast(
                  `Ya existe un "CIERRE FONDO VENTAS" para el turno N (${formatMinuteOfDay(
                    shiftNEndMin,
                  )}) de hoy.`,
                  "warning",
                  5500,
                );
                return;
              }
            }
          } catch (dupErr) {
            console.error("[FG] Error checking duplicate cierres:", dupErr);
          }

        }
      } catch (err) {
        console.error(
          "[FG] Error validating cierre fondo ventas on provider select:",
          err,
        );
        showToast(
          "No se pudo validar la hora del servidor. Cierre bloqueado.",
          "error",
          6000,
        );
        return;
      }
    }

    setSelectedProvider(value);
    setProviderError(""); // Clear error when user starts typing
    const oldPaymentType = paymentType;
    let nextPaymentType: FondoEntry["paymentType"] = "COMPRA INVENTARIO";
    let shouldAutoDateInvoice = false;
    try {
      // (prov) already resolved above
      shouldAutoDateInvoice =
        isCajaNegra ||
        isAutoAdjustmentProvider(value) ||
        prov?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
      if (
        prov &&
        prov.type &&
        isFondoMovementType(prov.type)
      ) {
        nextPaymentType = prov.type as FondoEntry["paymentType"];
        setPaymentType(nextPaymentType);
      } else if (prov?.category === "Ingreso") {
        nextPaymentType = FONDO_INGRESO_TYPES[0] as FondoEntry["paymentType"];
        setPaymentType(nextPaymentType);
      } else if (prov?.category === "Gasto") {
        nextPaymentType = FONDO_GASTO_TYPES[0] as FondoEntry["paymentType"];
        setPaymentType(nextPaymentType);
      } else if (prov?.category === "Egreso") {
        nextPaymentType = FONDO_EGRESO_TYPES[0] as FondoEntry["paymentType"];
        setPaymentType(nextPaymentType);
      } else if (isCajaNegra) {
        const upper = (prov?.code || value).toUpperCase();
        nextPaymentType = upper.includes("INGRESO")
          ? (FONDO_INGRESO_TYPES[0] as FondoEntry["paymentType"])
          : (FONDO_EGRESO_TYPES[0] as FondoEntry["paymentType"]);
        setPaymentType(nextPaymentType);
      } else {
        // fallback to default when provider has no type or it's invalid
        nextPaymentType = "COMPRA INVENTARIO";
        setPaymentType(nextPaymentType);
      }
    } catch {
      // defensive: ensure UI remains usable on unexpected provider shapes
      nextPaymentType = "COMPRA INVENTARIO";
      setPaymentType(nextPaymentType);
    }

    if (shouldAutoDateInvoice) {
      setInvoiceNumber(
        isCajaNegra ? getTodayInvoiceMMDD() : getTodayInvoiceDDMM(),
      );
      setInvoiceError("");
    }

    // Move amount between egreso and ingreso fields if type changes
    const oldIsEgreso =
      isEgresoType(oldPaymentType) || isGastoType(oldPaymentType);
    const newIsEgreso =
      isEgresoType(nextPaymentType) || isGastoType(nextPaymentType);
    if (oldIsEgreso && !newIsEgreso && egreso.trim()) {
      setIngreso(egreso);
      setEgreso("");
    } else if (!oldIsEgreso && newIsEgreso && ingreso.trim()) {
      setEgreso(ingreso);
      setIngreso("");
    }
  };
  const handleInvoiceNumberChange = (value: string) => {
    if (isInvoiceAutoDateLocked) return;
    setInvoiceNumber(value.replace(/\D/g, "").slice(0, 4));
    setInvoiceError(""); // Clear error when user starts typing
  };
  const managerOptionsLoading = Boolean(isSuperAdminUser && editingEntryId)
    ? superAdminUsersLoading
    : employeesLoading;

  const managerSelectDisabled =
    !company ||
    managerOptionsLoading ||
    employeeOptions.length === 0 ||
    (isRegularUser &&
      accountKey === "FondoGeneral" &&
      namespace === "fg" &&
      !editingEntryId &&
      managerLockedByShift) ||
    // Superadmin: manager is auto-assigned when creating.
    (Boolean(isSuperAdminUser) && !editingEntryId);
  const invoiceDisabled = !company || isInvoiceAutoDateLocked;
  const egresoBorderClass = amountClass(
    isEgreso,
    egreso.trim().length > 0,
    egresoValid,
  );
  const ingresoBorderClass = amountClass(
    isIngreso,
    ingreso.trim().length > 0,
    ingresoValid,
  );

  const closeMovementModal = () => {
    setMovementModalOpen(false);
    resetFondoForm();
    setMovementAutoCloseLocked(false);
  };
  const openCreateMovementDrawer = useCallback(() => {
    resetFondoForm();
    setMovementCurrency(currencyEnabled.CRC ? "CRC" : "USD");
    if (isCajaNegra) {
      setInvoiceNumber(getTodayInvoiceMMDD());
      setInvoiceError("");
    }
    // If a provider is already selected, derive paymentType from it so the form
    // doesn't stay with the reset default ('COMPRA INVENTARIO'). This prevents
    // cases where the UI shows a provider whose configured type (e.g. 'OTROS INGRESOS')
    // is ignored because resetFondoForm set the paymentType to the default.
    if (selectedProvider) {
      try {
        const prov = movementProviders.find((p) => p.code === selectedProvider);
        if (
          prov &&
          prov.type &&
          isFondoMovementType(prov.type)
        ) {
          setPaymentType(prov.type as FondoEntry["paymentType"]);
        } else if (prov?.category === "Ingreso") {
          setPaymentType(FONDO_INGRESO_TYPES[0] as FondoEntry["paymentType"]);
        } else if (prov?.category === "Gasto") {
          setPaymentType(FONDO_GASTO_TYPES[0] as FondoEntry["paymentType"]);
        } else if (prov?.category === "Egreso") {
          setPaymentType(FONDO_EGRESO_TYPES[0] as FondoEntry["paymentType"]);
        } else if (isCajaNegra) {
          const upper = (prov?.code || selectedProvider).toUpperCase();
          setPaymentType(
            upper.includes("INGRESO")
              ? (FONDO_INGRESO_TYPES[0] as FondoEntry["paymentType"])
              : (FONDO_EGRESO_TYPES[0] as FondoEntry["paymentType"]),
          );
        } else {
          setPaymentType("COMPRA INVENTARIO");
        }
      } catch {
        setPaymentType("COMPRA INVENTARIO");
      }
    }
    // If this FondoSection instance is scoped to ingresos/egresos, force that default
    if (mode === "ingreso") setPaymentType(FONDO_INGRESO_TYPES[0]);
    if (mode === "egreso") setPaymentType(FONDO_EGRESO_TYPES[0]);
    setMovementModalOpen(true);
  }, [
    resetFondoForm,
    currencyEnabled.CRC,
    selectedProvider,
    movementProviders,
    mode,
    isCajaNegra,
    getTodayInvoiceMMDD,
  ]);

  const confirmOpenCreateMovementNow = useCallback(() => {
    setConfirmOpenCreateMovement(false);
    openCreateMovementDrawer();
  }, [openCreateMovementDrawer]);

  const handleOpenCreateMovement = async () => {
    // Confirmación solo para cuentas (BCR/BN/BAC), para evitar confusiones.
    // Skip confirmation for Caja Negra (no company/account confirmation needed)
    if (accountKey !== "FondoGeneral" && !isCajaNegra) {
      setConfirmOpenCreateMovement(true);
      return;
    }

    if (
      isRegularUser &&
      accountKey === "FondoGeneral" &&
      namespace === "fg" &&
      !isCajaNegra &&
      !isDelifoodCompany
    ) {
      try {
        const nowISO = await getAuthoritativeNowISO();
        const resolution = await resolveShiftManagerForNow(nowISO);
        if (resolution?.mode === "missing") {
          setMissingShiftExpectedShift(resolution.expectedShift);
          setMissingShiftDateKey(resolution.dateKey);
          setMissingShiftModalOpen(true);
          return;
        }
      } catch (err) {
        console.error(
          "[FG] Error checking control horario before opening movement:",
          err,
        );
      }
    }

    // Si hubo un cierre pendiente (guardado en localStorage), solicitar confirmación de conteo físico.
    if (shouldPromptPhysicalCount()) {
      setConfirmPhysicalCountOpen(true);
      return;
    }

    openCreateMovementDrawer();
  };

  const handleOpenDailyClosing = () => {
    if (accountKey !== "FondoGeneral") return;
    setEditingDailyClosingId(null);

    // Find the last "CIERRE FONDO VENTAS" movement to get the default manager
    const lastCierreVentas = [...fondoEntries]
      .filter((entry) => {
        const provider = providers.find((p) => p.code === entry.providerCode);
        return (
          provider?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

    const initialValues: DailyClosingFormValues = {
      closingDate: new Date().toISOString(),
      manager: lastCierreVentas?.manager || "",
      notes: "",
      totalCRC: currentBalanceCRC,
      totalUSD: currentBalanceUSD,
      breakdownCRC: {},
      breakdownUSD: {},
    };

    setDailyClosingInitialValues(initialValues);
    setDailyClosingModalOpen(true);
  };

  const handleCloseDailyClosing = () => {
    setDailyClosingModalOpen(false);
    setEditingDailyClosingId(null);
    setDailyClosingInitialValues(null);
    setClosingPaymentModalOpen(false);
    setClosingPaymentTarget(null);
  };

  const handleCancelPhysicalCount = useCallback(() => {
    handleCancelPhysicalCountFn(setConfirmPhysicalCountOpen);
  }, []);

  const closePendingCierreModal = useCallback(() => {
    setPendingCierreModalOpen(false);
  }, []);

  const handleConfirmPhysicalCount = useCallback(() => {
    handleConfirmPhysicalCountFn({
      accountKey,
      company,
      openCreateMovementDrawer,
      setConfirmPhysicalCountOpen,
    });
  }, [accountKey, company, openCreateMovementDrawer]);

  const handleOpenCashOpening = useCallback(() => {
    setConfirmPhysicalCountOpen(false);
    const openingManager = (user?.name || user?.email || "").trim();
    setCashOpeningInitialValues({
      openingDate: new Date().toISOString(),
      manager: openingManager,
      notes: "",
      totalCRC: currentBalanceCRC,
      totalUSD: currentBalanceUSD,
      breakdownCRC: {},
      breakdownUSD: {},
    });
    setCashOpeningModalOpen(true);
  }, [
    currentBalanceCRC,
    currentBalanceUSD,
    setConfirmPhysicalCountOpen,
    setCashOpeningInitialValues,
    setCashOpeningModalOpen,
    user?.email,
    user?.name,
  ]);

  const handleCloseCashOpening = useCallback(() => {
    setCashOpeningModalOpen(false);
    setCashOpeningInitialValues(null);
  }, []);

  const handleConfirmCashOpening = useCallback(
    async (opening: CashOpeningFormValues) => {
      await handleConfirmCashOpeningFn(opening, {
        accountKey,
        company,
        currentBalanceCRC,
        currentBalanceUSD,
        buildPhysicalCountStorageKey: () => buildPhysicalCountStorageKeyFn(accountKey, company),
        cleanupPhysicalCountLegacyKeys: () => cleanupPhysicalCountLegacyKeysFn(accountKey, company),
        persistMovementToFirestore,
        fondoEntries,
        setFondoEntries,
        setLedgerSnapshot,
        showToast,
        ownerAdminEmail,
        user,
        setCashOpeningModalOpen,
        setCashOpeningInitialValues,
        openingSubmitInProgressRef,
      });
    },
    [
      accountKey,
      company,
      currentBalanceCRC,
      currentBalanceUSD,
      persistMovementToFirestore,
      fondoEntries,
      setFondoEntries,
      setLedgerSnapshot,
      showToast,
      ownerAdminEmail,
      user,
      setCashOpeningModalOpen,
      setCashOpeningInitialValues,
      openingSubmitInProgressRef,
      buildPhysicalCountStorageKeyFn,
      cleanupPhysicalCountLegacyKeysFn,
    ],
  );

  const handleConfirmDailyClosing = async (closing: DailyClosingFormValues) => {
    return await handleConfirmDailyClosingFn(closing, {
      accountKey,
      activeOwnerId,
      beginDailyClosingsRequest,
      buildPhysicalCountStorageKey: () => buildPhysicalCountStorageKeyFn(accountKey, company),
      cleanupPhysicalCountLegacyKeys: () => cleanupPhysicalCountLegacyKeysFn(accountKey, company),
      company,
      currentBalanceCRC,
      currentBalanceUSD,
      dailyClosingSubmitInProgressRef,
      dailyClosings,
      dailyClosingsRequestCountRef,
      editingDailyClosingId,
      finishDailyClosingsRequest,
      fondoEntries,
      formatToastWaitTime,
      isRegularUser,
      lastDailyClosingSavedAtRef,
      loadedDailyClosingKeysRef,
      loadingDailyClosingKeysRef,
      ownerAdminEmail,
      persistMovementToFirestore,
      setDailyClosingInitialValues,
      setDailyClosingModalOpen,
      setDailyClosings,
      setDailyClosingsHydrated,
      setEditingDailyClosingId,
      setFondoEntries,
      setLedgerSnapshot,
      setPendingCierreDeCaja,
      showToast,
      storageSnapshotRef,
      user,
    });


  };

  const handleAdminCompanyChange = useCallback(
    (value: string) => {
      if (!canSelectCompany) return;
      const previousValue = adminCompany;
      setAdminCompany(value);
      try {
        localStorage.setItem(SHARED_COMPANY_STORAGE_KEY, value);
        // Disparar evento de storage manualmente para sincronizar dentro de la misma ventana
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: SHARED_COMPANY_STORAGE_KEY,
            newValue: value,
            oldValue: previousValue,
            storageArea: localStorage,
          }),
        );
      } catch (error) {
        console.error("Error saving selected company to localStorage:", error);
      }
      resetStateForCompanyChange({
        mode,
        keepFiltersAcrossCompanies,
        setEntriesHydrated,
        setHydratedCompany,
        setFondoEntries,
        storageSnapshotRef,
        setInitialAmount,
        setInitialAmountUSD,
        setDailyClosingsHydrated,
        setDailyClosings,
        setDailyClosingsRefreshing,
        dailyClosingsRequestCountRef,
        loadedDailyClosingKeysRef,
        loadingDailyClosingKeysRef,
        setCurrencyEnabled,
        setMovementModalOpen,
        resetFondoForm,
        setMovementAutoCloseLocked,
        setSelectedProvider,
        setFilterProviderCode,
        setFilterPaymentType,
        setFilterEditedOnly,
        setSearchQuery,
        setFromFilter,
        setToFilter,
        setQuickRange,
        setPageIndex,
      });
    },
    [
      canSelectCompany,
      mode,
      resetFondoForm,
      adminCompany,
      keepFiltersAcrossCompanies,
    ],
  );

  // Escuchar cambios de empresa desde ProviderSection (sincronización bidireccional)
  useEffect(() => {
    if (!canSelectCompany) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === SHARED_COMPANY_STORAGE_KEY &&
        event.newValue &&
        event.newValue !== adminCompany
      ) {
        setAdminCompany(event.newValue);
        // Reset state when company changes from external source
        resetStateForCompanyChange({
          mode,
          keepFiltersAcrossCompanies,
          setEntriesHydrated,
          setHydratedCompany,
          setFondoEntries,
          storageSnapshotRef,
          setInitialAmount,
          setInitialAmountUSD,
          setDailyClosingsHydrated,
          setDailyClosings,
          setDailyClosingsRefreshing,
          dailyClosingsRequestCountRef,
          loadedDailyClosingKeysRef,
          loadingDailyClosingKeysRef,
          setCurrencyEnabled,
          setMovementModalOpen,
          resetFondoForm,
          setMovementAutoCloseLocked,
          setSelectedProvider,
          setFilterProviderCode,
          setFilterPaymentType,
          setFilterEditedOnly,
          setSearchQuery,
          setFromFilter,
          setToFilter,
          setQuickRange,
          setPageIndex,
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [
    canSelectCompany,
    adminCompany,
    mode,
    resetFondoForm,
    keepFiltersAcrossCompanies,
  ]);

  const handleFondoKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmitFondo();
    }
  };

  const closingsAreLoading =
    accountKey === "FondoGeneral" &&
    dailyClosingHistoryOpen &&
    (!dailyClosingsHydrated || dailyClosingsRefreshing);

  const isFondoMovementsLoading = useMemo(() => {
    return Boolean(company) && (!entriesHydrated || movementsLoading);
  }, [company, entriesHydrated, movementsLoading]);

  // Keep superadmin totals collapsed by default per-day.
  useEffect(() => {
    if (!isSuperAdminUser) return;
    if (!isSingleDayFilter) {
      setSuperAdminTotalsOpen(false);
      return;
    }
    setSuperAdminTotalsOpen(false);
  }, [isSuperAdminUser, isSingleDayFilter, fromFilter]);

  const totalsByCurrency = useMemo(() => {
    const acc: Record<"CRC" | "USD", { ingreso: number; egreso: number }> = {
      CRC: { ingreso: 0, egreso: 0 },
      USD: { ingreso: 0, egreso: 0 },
    };
    for (const e of filteredEntries) {
      const cur = (e.currency as "CRC" | "USD") || "CRC";
      const ing = Math.trunc(e.amountIngreso || 0);
      const eg = Math.trunc(e.amountEgreso || 0);
      if (ing > 0) acc[cur].ingreso += ing;
      if (eg > 0) acc[cur].egreso += eg;
    }
    return acc;
  }, [filteredEntries]);

  const getCompanyKey = useCallback(
    (emp: Empresas) =>
      String(emp?.name || emp?.ubicacion || emp?.id || "").trim(),
    [],
  );

  const getCompanyLabel = useCallback(
    (emp: Empresas) => {
      const name = String(emp?.name || "").trim();
      const ubicacion = String(emp?.ubicacion || "").trim();
      const key = getCompanyKey(emp);

      if (!name && !ubicacion) return key || "Sin nombre";
      if (!ubicacion) return name || key || "Sin nombre";
      if (!name) return ubicacion || key || "Sin nombre";

      const nameLower = name.toLowerCase();
      const ubicLower = ubicacion.toLowerCase();

      if (nameLower === ubicLower) return name;

      let baseName = name;
      if (nameLower.includes(ubicLower)) {
        const escaped = ubicacion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        baseName = name
          .replace(new RegExp(escaped, "ig"), " ")
          .replace(/\s{2,}/g, " ")
          .trim();
      }

      return `${ubicacion} - ${baseName || name}`;
    },
    [getCompanyKey],
  );

  const companySelectId = `fg-company-select-${namespace}`;
  const showCompanySelector =
    canSelectCompany &&
    (ownerCompaniesLoading ||
      sortedOwnerCompanies.length > 0 ||
      !!ownerCompaniesError);
  const currentCompanyLabel = useMemo(() => {
    const selected = String(company || "").trim();
    if (!selected) return "Sin empresa seleccionada";

    const match = sortedOwnerCompanies.find(
      (emp) => getCompanyKey(emp) === selected,
    );
    return match ? getCompanyLabel(match).split(" - ")[0] : selected;
  }, [company, sortedOwnerCompanies, getCompanyKey, getCompanyLabel]);
  const companySelectorContent = useMemo(() => {
    if (!showCompanySelector) return null;

    return (
      <CompanySelectorContent
        company={company}
        companySelectId={companySelectId}
        currentCompanyLabel={currentCompanyLabel}
        getCompanyKey={getCompanyKey}
        getCompanyLabel={getCompanyLabel}
        handleAdminCompanyChange={handleAdminCompanyChange}
        ownerCompaniesError={ownerCompaniesError}
        ownerCompaniesLoading={ownerCompaniesLoading}
        sortedOwnerCompanies={sortedOwnerCompanies}
      />
    );
  }, [
    showCompanySelector,
    currentCompanyLabel,
    ownerCompaniesError,
    companySelectId,
    company,
    ownerCompaniesLoading,
    sortedOwnerCompanies,
    handleAdminCompanyChange,
    getCompanyKey,
    getCompanyLabel,
  ]);

  useEffect(() => {
    if (!onCompanySelectorChange) return;
    if (companySelectorPlacement === "external") {
      onCompanySelectorChange(companySelectorContent);
      return () => onCompanySelectorChange(null);
    }
    onCompanySelectorChange(null);
  }, [
    companySelectorPlacement,
    companySelectorContent,
    onCompanySelectorChange,
  ]);

  if (authLoading) {
    return (
      <div id={id} className="mt-6">
        <div className="p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded text-center">
          <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!canAccessSection) {
    return (
      <div id={id} className="mt-6">
        <AccessRestrictedMessage
          description={`No tienes permisos para acceder a ${namespaceDescription}.`}
        />
      </div>
    );
  }

  if (!fondoTypesLoaded) {
    return (
      <div id={id} className="mt-6">
        <div className="p-8 bg-[var(--card-bg)] border border-[var(--input-border)] rounded text-center space-y-3">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          </div>
          <p className="text-[var(--muted-foreground)]">
            Cargando tipos de movimientos...
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Esto solo ocurre la primera vez
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      className="mt-3 sm:mt-4 lg:mt-6
      mx-auto
      flex h-full min-h-0 w-full flex-1 flex-col
      space-y-3 sm:space-y-4 lg:space-y-6
      px-0"
    >
      {companySelectorPlacement === "content" && companySelectorContent && (
        <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-3 sm:p-4">
          {companySelectorContent}
        </div>
      )}

      <FondoFiltersToolbar
        filterProviderCode={filterProviderCode}
        setFilterProviderCode={setFilterProviderCode}
        setProviderFilter={setProviderFilter}
        providerSearchInput={providerSearchInput}
        setProviderSearchInput={setProviderSearchInput}
        isProviderDropdownOpen={isProviderDropdownOpen}
        setIsProviderDropdownOpen={setIsProviderDropdownOpen}
        movementProvidersLoading={movementProvidersLoading}
        filteredProvidersForFilter={filteredProvidersForFilter}
        filterPaymentType={filterPaymentType}
        setFilterPaymentType={setFilterPaymentType}
        setTypeFilter={setTypeFilter}
        typeSearchInput={typeSearchInput}
        setTypeSearchInput={setTypeSearchInput}
        isTypeDropdownOpen={isTypeDropdownOpen}
        setIsTypeDropdownOpen={setIsTypeDropdownOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filtersDropdownRef={filtersDropdownRef}
        filtersDropdownOpen={filtersDropdownOpen}
        setFiltersDropdownOpen={setFiltersDropdownOpen}
        showPendingClosingCreditInvoices={showPendingClosingCreditInvoices}
        setShowPendingClosingCreditInvoices={
          setShowPendingClosingCreditInvoices
        }
        filterEditedOnly={filterEditedOnly}
        setFilterEditedOnly={setFilterEditedOnly}
        quickRange={quickRange}
        todayKey={todayKey}
        fromFilter={fromFilter}
        setFromFilter={setFromFilter}
        toFilter={toFilter}
        setToFilter={setToFilter}
        calendarFromOpen={calendarFromOpen}
        setCalendarFromOpen={setCalendarFromOpen}
        calendarToOpen={calendarToOpen}
        setCalendarToOpen={setCalendarToOpen}
        calendarFromMonth={calendarFromMonth}
        setCalendarFromMonth={setCalendarFromMonth}
        calendarToMonth={calendarToMonth}
        setCalendarToMonth={setCalendarToMonth}
        formatKeyToDisplay={formatKeyToDisplay}
        setQuickRange={setQuickRange}
        setPageSize={setPageSize}
        setPageIndex={setPageIndex}
        fromCalendarRef={fromCalendarRef}
        toCalendarRef={toCalendarRef}
        fromButtonRef={fromButtonRef}
        toButtonRef={toButtonRef}
        accountKey={accountKey}
        setDailyClosingHistoryRange={setDailyClosingHistoryRange}
        setDailyClosingHistoryOpen={setDailyClosingHistoryOpen}
        closingsAreLoading={closingsAreLoading}
        pendingCierreDeCaja={pendingCierreDeCaja}
        handleOpenDailyClosing={handleOpenDailyClosing}
        handleOpenCreateMovement={handleOpenCreateMovement}
        entriesHydrated={entriesHydrated}
      />

      {!authLoading && !company && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          {canSelectCompany
            ? "Selecciona una empresa para continuar."
            : "Tu usuario no tiene una empresa asociada; registra una empresa para continuar."}
        </p>
      )}

      {providersError && (
        <div className="mb-4 text-sm text-red-500">{providersError}</div>
      )}

      <MovementDrawer
        open={movementModalOpen}
        onClose={closeMovementModal}
        editingEntry={editingEntry}
        movementAutoCloseLocked={movementAutoCloseLocked}
        onToggleMovementAutoCloseLocked={() =>
          setMovementAutoCloseLocked((prev) => !prev)
        }
        selectedProvider={selectedProvider}
        onProviderChange={handleProviderChange}
        providers={filteredProvidersForMovement}
        providersLoading={movementProvidersLoading}
        isProviderSelectDisabled={
          isProviderSelectDisabled ||
          isEditingCierreFondoVentas ||
          isEditingPaidFcrMovement
        }
        providerDisabledTooltip={
          isEditingPaidFcrMovement
            ? "Solo se puede editar el monto y la observacion de un pago FCR"
            : isEditingCierreFondoVentas
            ? 'No se puede cambiar el proveedor de un movimiento "CIERRE FONDO VENTAS"'
            : undefined
        }
        selectedProviderExists={selectedProviderExists}
        invoiceNumber={invoiceNumber}
        onInvoiceNumberChange={handleInvoiceNumberChange}
        invoiceDocType={invoiceDocType}
        onInvoiceDocTypeChange={setInvoiceDocType}
        allowCreditInvoiceOption={Boolean(
          editingEntryId && invoiceDocType === "FCR",
        )}
        lockInvoiceDocTypeToContado={isInvoiceDocTypeLockedToContado}
        invoiceValid={invoiceValid}
        invoiceDisabled={invoiceDisabled || isEditingPaidFcrMovement}
        paymentType={paymentType}
        isEgreso={isEgreso}
        egreso={egreso}
        onEgresoChange={handleEgresoChange}
        egresoBorderClass={egresoBorderClass}
        ingreso={ingreso}
        onIngresoChange={handleIngresoChange}
        ingresoBorderClass={ingresoBorderClass}
        notes={notes}
        onNotesChange={handleNotesChange}
        manager={manager}
        onManagerChange={handleManagerChange}
        manager2={manager2}
        onManager2Change={handleManager2Change}
        accountKey={accountKey}
        showManager2={false}
        managerSelectDisabled={managerSelectDisabled || isEditingPaidFcrMovement}
        manager2SelectDisabled={
          !company || managerOptionsLoading || employeeOptions.length === 0
        }
        employeeOptions={employeeOptions}
        employeesLoading={managerOptionsLoading}
        editingEntryId={editingEntryId}
        onCancelEditing={cancelEditing}
        onSubmit={handleSubmitFondo}
        isSubmitDisabled={isSubmitDisabled}
        isSaving={isSaving}
        onFieldKeyDown={handleFondoKeyDown}
        currency={movementCurrency}
        onCurrencyChange={(c) => setMovementCurrency(c)}
        currencySelectDisabled={isEditingPaidFcrMovement}
        currencyEnabled={currencyEnabled}
        providerError={providerError}
        invoiceError={invoiceError}
        amountError={amountError}
        managerError={managerError}
        manager2Error={manager2Error}
        pendingCreditNotesCount={selectedProviderPendingNcCount}
        pendingCreditInvoicesCount={
          isEditingPaidFcrMovement
            ? 0
            : selectedProviderPendingPaymentAlert?.count ?? 0
        }
        pendingCreditInvoicesBalanceLabel={
          !isEditingPaidFcrMovement && selectedProviderPendingPaymentAlert
            ? [
                selectedProviderPendingPaymentAlert.crc > 0
                  ? formatByCurrency(
                      "CRC",
                      selectedProviderPendingPaymentAlert.crc,
                    )
                  : "",
                selectedProviderPendingPaymentAlert.usd > 0
                  ? formatByCurrency(
                      "USD",
                      selectedProviderPendingPaymentAlert.usd,
                    )
                  : "",
              ]
                .filter(Boolean)
                .join(" / ")
            : ""
        }
        pendingCreditInvoices={
          isEditingPaidFcrMovement ? [] : selectedProviderPendingCreditInvoices
        }
        onSelectPendingCreditInvoice={handleMovementCreditInvoiceSelect}
        pendingCreditNotes={movementPendingCreditNotes}
        selectedCreditNoteIds={selectedAppliedCreditNoteIds}
        onToggleCreditNote={(id) => {
          setSelectedAppliedCreditNoteIds((prev) =>
            prev.includes(id)
              ? prev.filter((item) => item !== id)
              : [...prev, id],
          );
        }}
        creditNotesAppliedTotal={creditNotesAppliedTotal}
        amountPayment={computedAmountPayment}
        onAddManualCreditNote={openManualCreditNoteModal}
        balanceCRC={currentBalanceCRC}
        balanceUSD={currentBalanceUSD}
        isCompraInventarioProvider={isCompraInventarioProvider}
      />

      <ManualCreditNoteDrawer
        open={manualCreditNoteOpen}
        error={manualCreditNoteError}
        target={manualCreditNoteTarget}
        invoiceNumber={manualCreditNoteInvoiceNumber}
        amount={manualCreditNoteAmount}
        observation={manualCreditNoteObservation}
        saving={manualCreditNoteSaving}
        providersMap={providersMap}
        formatByCurrency={formatByCurrency}
        onClose={closeManualCreditNoteModal}
        onInvoiceNumberChange={setManualCreditNoteInvoiceNumber}
        onAmountChange={setManualCreditNoteAmount}
        onObservationChange={setManualCreditNoteObservation}
        onSubmit={() => {
          void handleSaveManualCreditNote();
        }}
      />

      {!isCajaNegra &&
        !movementProvidersLoading &&
        movementProviders.length === 0 &&
        company && (
          <p className="text-sm text-[var(--muted-foreground)] mt-3">
            Registra un proveedor para poder asociarlo a los movimientos del
            fondo.
          </p>
        )}

      {!isSuperAdminUser &&
        !managerOptionsLoading &&
        employeeOptions.length === 0 &&
        company && (
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            La empresa no tiene empleados registrados; agrega empleados para
            seleccionar un encargado.
          </p>
        )}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {fondoEntries.length === 0 && !showPendingClosingCreditInvoices ? (
            isFondoMovementsLoading ? (
              <FondoMovementsSkeleton />
            ) : (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--card-bg)]/60 px-4 py-6 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  No hay movimientos aun.
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Los registros apareceran aqui cuando se agregue el primer
                  movimiento.
                </p>
              </div>
            )
          ) : (
            <div className="relative overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/80 text-white shadow-sm">
              {isFondoMovementsLoading && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#020617]/35 backdrop-blur-sm">
                  <div className="flex min-w-[210px] flex-col items-center rounded-lg border border-cyan-400/25 bg-[#0d1117]/85 px-5 py-4 text-center shadow-2xl shadow-black/40">
                    <div className="relative flex h-12 w-12 items-center justify-center">
                      <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10">
                        <Loader2 className="h-6 w-6 animate-spin text-cyan-200" />
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-cyan-50">
                      Actualizando movimientos
                    </p>
                    <p className="mt-1 text-xs text-cyan-100/60">
                      Aplicando filtros y fechas
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-4 border-b border-[var(--input-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                    Movimientos ({filteredEntries.length})
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Mostrando {pageRange.from}-{pageRange.to} de{" "}
                    {filteredEntries.length}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      Mostrar
                    </span>
                    <select
                      value={
                        pageSize === "all"
                          ? "all"
                          : pageSize === "daily"
                            ? "daily"
                            : String(pageSize)
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") setPageSize("all");
                        else if (v === "daily") setPageSize("daily");
                        else setPageSize(Number.parseInt(v, 10) || 10);
                      }}
                      className="h-9 min-w-0 flex-1 rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-2 text-xs text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 sm:flex-initial"
                    >
                      <option value="daily">Diariamente</option>
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="15">15</option>
                      <option value="all">Todos</option>
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <div className="flex flex-col items-start gap-2 text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:gap-3">
                      <label className="flex cursor-pointer items-center gap-2 rounded border border-cyan-700/35 bg-cyan-950/25 px-2.5 py-2 transition-colors hover:border-cyan-500/45">
                        <input
                          aria-label="Recordar filtros"
                          title="Recordar filtros"
                          className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                          type="checkbox"
                          checked={rememberFilters}
                          onChange={(e) => setRememberFilters(e.target.checked)}
                        />
                        <span className="whitespace-nowrap text-xs">
                          Recordar ajustes
                        </span>
                      </label>
                      {isAdminUser && (
                        <label className="flex cursor-pointer items-center gap-2 rounded border border-cyan-700/35 bg-cyan-950/25 px-2.5 py-2 transition-colors hover:border-cyan-500/45">
                          <input
                            aria-label="Mantener filtros entre empresas"
                            title="Mantener filtros entre empresas"
                            className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                            type="checkbox"
                            checked={keepFiltersAcrossCompanies}
                            onChange={(e) =>
                              setKeepFiltersAcrossCompanies(e.target.checked)
                            }
                          />
                          <span className="whitespace-nowrap text-xs">
                            Mantener entre empresas
                          </span>
                        </label>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={handlePrevPage}
                        disabled={disablePrevButton}
                        className="h-9 flex-1 rounded border border-[var(--input-border)] px-3 text-xs font-medium transition-colors hover:border-[var(--accent)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
                      >
                        Ant
                      </button>
                      <div className="rounded border border-cyan-700/35 bg-cyan-950/25 px-2 py-2 text-[10px] font-medium text-[var(--foreground)] sm:text-xs whitespace-nowrap">
                        {isDailyMode
                          ? formatGroupLabel(currentDailyKey)
                          : `${Math.min(pageIndex + 1, totalPages)}/${totalPages}`}
                      </div>
                      <button
                        type="button"
                        onClick={handleNextPage}
                        disabled={disableNextButton}
                        className="h-9 flex-1 rounded border border-[var(--input-border)] px-3 text-xs font-medium transition-colors hover:border-[var(--accent)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
                      >
                        Sig
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="max-h-[28rem] overflow-y-auto sm:max-h-[36rem]">
                {(fromFilter || toFilter) && (
                  <div className="px-2 sm:px-3 py-2">
                    <div className="text-xs sm:text-sm text-[var(--muted-foreground)] flex flex-col sm:flex-row sm:items-center gap-2">
                      <span>
                        Filtro:{" "}
                        {fromFilter ? formatGroupLabel(fromFilter) : "-"}
                        {toFilter ? ` ? ${formatGroupLabel(toFilter)}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFromFilter(null);
                          setToFilter(null);
                          setPageIndex(0);
                          setPageSize("daily");
                        }}
                        className="px-2 py-1 border border-[var(--input-border)] rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)] text-xs self-start"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs sm:text-sm">
                    <colgroup>
                      <col style={{ width: columnWidths.hora }} />
                      <col style={{ width: columnWidths.motivo }} />
                      <col style={{ width: columnWidths.tipo }} />
                      <col style={{ width: columnWidths.factura }} />
                      <col style={{ width: columnWidths.monto }} />
                      <col style={{ width: columnWidths.encargado }} />
                      <col style={{ width: columnWidths.editar }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-cyan-950/35 text-xs uppercase tracking-wide text-cyan-50/80">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">
                          <div className="relative pr-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Hora
                            </div>
                            <div
                              onMouseDown={(e) => startResizing(e, "hora")}
                              className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                              style={{ touchAction: "none" }}
                            >
                              <div
                                style={{
                                  width: 2,
                                  height: "70%",
                                  background: "rgba(255,255,255,0.18)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          <div className="relative pr-2">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4" />
                              Motivo
                            </div>
                            <div
                              onMouseDown={(e) => startResizing(e, "motivo")}
                              className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                              style={{ touchAction: "none" }}
                            >
                              <div
                                style={{
                                  width: 2,
                                  height: "70%",
                                  background: "rgba(255,255,255,0.18)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          <div className="relative pr-2">
                            <div className="flex items-center gap-2">
                              <Tag className="w-4 h-4" />
                              Tipo
                            </div>
                            <div
                              onMouseDown={(e) => startResizing(e, "tipo")}
                              className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                              style={{ touchAction: "none" }}
                            >
                              <div
                                style={{
                                  width: 2,
                                  height: "70%",
                                  background: "rgba(255,255,255,0.18)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          <div className="relative pr-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                               Nro. factura
                            </div>
                            <div
                              onMouseDown={(e) => startResizing(e, "factura")}
                              className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                              style={{ touchAction: "none" }}
                            >
                              <div
                                style={{
                                  width: 2,
                                  height: "70%",
                                  background: "rgba(255,255,255,0.18)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          <div className="relative pr-2">
                            <div className="flex items-center gap-2">
                              <Banknote className="w-4 h-4" />
                              Monto
                            </div>
                            <div
                              onMouseDown={(e) => startResizing(e, "monto")}
                              className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                              style={{ touchAction: "none" }}
                            >
                              <div
                                style={{
                                  width: 2,
                                  height: "70%",
                                  background: "rgba(255,255,255,0.18)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          <div className="relative pr-2">
                            <div className="flex items-center gap-2">
                              <UserCircle className="w-4 h-4" />
                              Encargado
                            </div>
                            <div
                              onMouseDown={(e) => startResizing(e, "encargado")}
                              className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                              style={{ touchAction: "none" }}
                            >
                              <div
                                style={{
                                  width: 2,
                                  height: "70%",
                                  background: "rgba(255,255,255,0.18)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          <div className="relative pr-2">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSortAsc((prev: boolean) => {
                                    try {
                                      localStorage.setItem(
                                        "fondogeneral-sortAscTouched",
                                        "true",
                                      );
                                    } catch {
                                      // ignore storage errors
                                    }
                                    return !prev;
                                  })
                                }
                                title={
                                  sortAsc
                                    ? "Mostrar más reciente arriba"
                                    : "Mostrar más reciente abajo"
                                }
                                aria-label="Invertir orden de movimientos"
                                className="p-1 border border-[var(--input-border)] rounded hover:bg-[var(--muted)]"
                              >
                                <ArrowUpDown className="w-4 h-4" />
                              </button>
                            </div>
                            <div
                              onMouseDown={(e) => startResizing(e, "editar")}
                              className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                              style={{ touchAction: "none" }}
                            >
                              <div
                                style={{
                                  width: 2,
                                  height: "70%",
                                  background: "rgba(255,255,255,0.18)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <PendingCreditInvoicesSection
                      showPendingClosingCreditInvoices={showPendingClosingCreditInvoices}
                      pendingClosingCreditInvoices={pendingClosingCreditInvoices}
                      providersMap={providersMap}
                      dateTimeFormatter={dateTimeFormatter}
                      formatByCurrency={formatByCurrency}
                      onOpenPaymentModal={openClosingInvoicePaymentModal}
                    />
                    {Array.from(groupedByDay.entries()).map(
                      ([dayKey, entries]) => (
                        <tbody key={dayKey}>
                          {entries.map((fe) => {
                            // the newest entry is the first element in fondoEntries (inserted at index 0)
                            const isMostRecent = fe.id === fondoEntries[0]?.id;
                            const providerName =
                              providersMap.get(fe.providerCode) ??
                              fe.providerCode;
                            const providerType = providerTypesMap.get(
                              fe.providerCode,
                            );
                            const entryCurrency =
                              (fe.currency as "CRC" | "USD") || "CRC";
                            const normalizedIngreso = Math.trunc(
                              fe.amountIngreso || 0,
                            );
                            const normalizedEgreso = Math.trunc(
                              resolveEffectiveEgresoAmount(fe),
                            );
                            const invoiceEgresoAmount = Math.trunc(
                              String(fe.id || "").startsWith("fcr-pago-")
                                ? (fe.originalAmount ?? fe.amountEgreso) || 0
                                : (fe.amountEgreso || 0),
                            );
                            const appliedCreditNotesTotal = Array.isArray(
                              fe.appliedCreditNotes,
                            )
                              ? fe.appliedCreditNotes.reduce(
                                  (sum, note) =>
                                    sum +
                                    Math.max(
                                      0,
                                      Math.trunc(
                                        Number(note.appliedAmount) || 0,
                                      ),
                                    ),
                                  0,
                                )
                              : 0;
                            const appliedCreditNotesAdjustment = Math.max(
                              0,
                              invoiceEgresoAmount -
                                appliedCreditNotesTotal -
                                normalizedEgreso,
                            );
                            let isEntryEgreso =
                              isEgresoType(fe.paymentType) ||
                              isGastoType(fe.paymentType);
                            if (
                              normalizedIngreso > 0 &&
                              normalizedEgreso === 0
                            ) {
                              isEntryEgreso = false;
                            } else if (
                              normalizedEgreso > 0 &&
                              normalizedIngreso === 0
                            ) {
                              isEntryEgreso = true;
                            }
                            const movementAmount = isEntryEgreso
                              ? normalizedEgreso
                              : normalizedIngreso;
                            const balanceAfter =
                              entryCurrency === "USD"
                                ? (balanceAfterByIdUSD.get(fe.id) ??
                                  Math.trunc(currentBalanceUSD))
                                : (balanceAfterByIdCRC.get(fe.id) ??
                                  Math.trunc(currentBalanceCRC));
                            // compute the balance immediately before this movement was applied (in the movement currency)
                            const previousBalance = isEntryEgreso
                              ? balanceAfter + normalizedEgreso
                              : balanceAfter - normalizedIngreso;
                            const isPaidFcrEntry = isPaidFcrMovement(fe);
                            const isLockedMovement = isMovementLocked(fe);
                            const primaryManager =
                              getPrimaryMovementManager(fe);
                            const primaryDateIso =
                              getPrimaryMovementDateISO(fe);
                            const recordedAt = new Date(primaryDateIso);
                            const formattedDate = Number.isNaN(
                              recordedAt.getTime(),
                            )
                              ? "Sin fecha"
                              : dateTimeFormatter.format(recordedAt);
                            const originalRegisteredAt = new Date(
                              fe.invoiceCreatedAt || fe.createdAt,
                            );
                            const formattedOriginalRegisteredAt = Number.isNaN(
                              originalRegisteredAt.getTime(),
                            )
                              ? "Sin fecha"
                              : dateTimeFormatter.format(originalRegisteredAt);
                            const isFcrInfoExpanded = expandedFcrInfoRows.has(
                              fe.id,
                            );
                            const owedFcrAmountRaw =
                              fe.amountDue ?? fe.balanceDue;
                            const owedFcrAmount = Number.isFinite(
                              Number(owedFcrAmountRaw),
                            )
                              ? Math.max(
                                  0,
                                  Math.trunc(Number(owedFcrAmountRaw) || 0),
                                )
                              : null;

                            const originalFcrAmount = Number.isFinite(
                              Number(fe.originalAmount),
                            )
                              ? Math.max(
                                  0,
                                  Math.trunc(Number(fe.originalAmount) || 0),
                                )
                              : null;
                            const isAppliedCreditNotesExpanded =
                              expandedAppliedCreditNotesRows.has(fe.id);
                            const hasAppliedCreditNotes =
                              Array.isArray(fe.appliedCreditNotes) &&
                              fe.appliedCreditNotes.length > 0;
                            const isAutoAdjustment = isAutoAdjustmentProvider(
                              fe.providerCode,
                            );
                            const providerNameUpper = String(providerName)
                              .trim()
                              .toUpperCase();
                            const isGeneralClosingRow =
                              providerNameUpper ===
                                AUTO_ADJUSTMENT_PROVIDER_CODE ||
                              providerNameUpper ===
                                AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY ||
                              hasGeneralClosingAdjustmentNotes(fe.notes);
                            const isCashOpeningRow =
                              fe.providerCode === APERTURA_CAJA_PROVIDER_CODE ||
                              providerNameUpper === APERTURA_CAJA_PROVIDER_CODE;
                            const displayPaymentType =
                              (isAutoAdjustment || isGeneralClosingRow) &&
                              !hasGeneralClosingNoDiffNotes(fe.notes) &&
                              fe.paymentType !== "INFORMATIVO"
                                ? "AJUSTE CIERRE"
                                : fe.paymentType === "INFORMATIVO" &&
                                    providerType
                                  ? providerType
                                  : !providerType
                                    ? "INFORMATIVO"
                                    : fe.paymentType;
                            const isSuccessfulClosing =
                              isAutoAdjustment && movementAmount === 0;
                            const amountPrefix = isEntryEgreso ? "-" : "+";
                            // prepare tooltip text for edited entries
                            let auditTooltip: string | undefined;
                            let parsedAudit: any | null = null;
                            if (fe.isAudit && fe.auditDetails) {
                              try {
                                const parsed = JSON.parse(
                                  fe.auditDetails,
                                ) as any;
                                // normalize to history array for backward compatibility
                                let history: any[] = [];
                                if (Array.isArray(parsed?.history)) {
                                  history = parsed.history;
                                } else if (parsed?.before && parsed?.after) {
                                  history = [
                                    {
                                      at: parsed.at ?? fe.createdAt,
                                      before: parsed.before,
                                      after: parsed.after,
                                    },
                                  ];
                                }
                                parsedAudit = { history };

                                // build tooltip from accumulated history (show each change timestamp + small summary)
                                const lines: string[] = history.map((h) => {
                                  const at = h?.at
                                    ? dateTimeFormatter.format(new Date(h.at))
                                      : "-";
                                  const before = h?.before ?? {};
                                  const after = h?.after ?? {};
                                  const parts: string[] = [];

                                  // Con el nuevo formato simplificado, mostramos todos los campos presentes
                                  if (
                                    "providerCode" in before ||
                                    "providerCode" in after
                                  ) {
                                    parts.push(
                                      `Proveedor: ${before.providerCode ?? "-"} -> ${
                                        after.providerCode ?? "-"
                                      }`,
                                    );
                                  }
                                  if (
                                    "invoiceNumber" in before ||
                                    "invoiceNumber" in after
                                  ) {
                                    parts.push(
                                      `Factura: ${before.invoiceNumber ?? "-"} -> ${
                                        after.invoiceNumber ?? "-"
                                      }`,
                                    );
                                  }
                                  if (
                                    "paymentType" in before ||
                                    "paymentType" in after
                                  ) {
                                    parts.push(
                                      `Tipo: ${before.paymentType ?? "-"} -> ${
                                        after.paymentType ?? "-"
                                      }`,
                                    );
                                  }

                                  // Manejar cambio de moneda
                                  if (
                                    "currency" in before ||
                                    "currency" in after
                                  ) {
                                    const beforeCur =
                                      before.currency || entryCurrency || "CRC";
                                    const afterCur =
                                      after.currency || entryCurrency || "CRC";
                                    if (beforeCur !== afterCur) {
                                      parts.push(
                                        `Moneda: ${beforeCur} ? ${afterCur}`,
                                      );
                                    }
                                  }

                                  // Manejar montos (pueden estar en amountEgreso o amountIngreso)
                                  if (
                                    "amountEgreso" in before ||
                                    "amountEgreso" in after ||
                                    "amountIngreso" in before ||
                                    "amountIngreso" in after
                                  ) {
                                    const beforeAmt = Number(
                                      before.amountEgreso ||
                                        before.amountIngreso ||
                                        0,
                                    );
                                    const afterAmt = Number(
                                      after.amountEgreso ||
                                        after.amountIngreso ||
                                        0,
                                    );
                                    const beforeCur =
                                      (before.currency as "CRC" | "USD") ||
                                      entryCurrency ||
                                      "CRC";
                                    const afterCur =
                                      (after.currency as "CRC" | "USD") ||
                                      entryCurrency ||
                                      "CRC";
                                    parts.push(
                                      `Monto: ${formatByCurrency(
                                        beforeCur,
                                        beforeAmt,
                                      )} ? ${formatByCurrency(afterCur, afterAmt)}`,
                                    );
                                  }

                                  if (
                                    "manager" in before ||
                                    "manager" in after
                                  ) {
                                    parts.push(
                                      `Encargado: ${before.manager ?? "-"} -> ${
                                        after.manager ?? "-"
                                      }`,
                                    );
                                  }
                                  if ("notes" in before || "notes" in after) {
                                    parts.push(
                                      `Notas: "${before.notes ?? ""}" ? "${
                                        after.notes ?? ""
                                      }"`,
                                    );
                                  }

                                  return `${at}: ${
                                    parts.join("; ") ||
                                    "Editado (sin cambios detectados)"
                                  } `;
                                });
                                auditTooltip = lines.join("\n");
                              } catch {
                                auditTooltip = "Editado";
                                parsedAudit = null;
                              }
                            }
                            return (
                              <React.Fragment key={fe.id}>
                                <tr
                                  className={`transition-colors hover:bg-[var(--muted)]/35 [&>td]:border-b [&>td]:border-cyan-900/35 ${
                                    isMostRecent
                                      ? "bg-gray-500/10 hover:bg-gray-500/20"
                                      : ""
                                  } ${isMovementLocked(fe) ? "opacity-60" : ""}`}
                                >
                                  <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                    {formattedDate}
                                  </td>
                                  <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold text-[var(--foreground)]">
                                        {providerName}
                                      </div>

                                      {fe.isAudit && (
                                        <div
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => {
                                            if (parsedAudit) {
                                              setAuditModalData(parsedAudit);
                                              setAuditModalOpen(true);
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (
                                              (e.key === "Enter" ||
                                                e.key === " ") &&
                                              parsedAudit
                                            ) {
                                              setAuditModalData(parsedAudit);
                                              setAuditModalOpen(true);
                                            }
                                          }}
                                          title={auditTooltip}
                                          className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-yellow-500/25 bg-yellow-500/10 px-2 py-0.5 text-[11px] text-yellow-300 transition-colors hover:bg-yellow-500/20"
                                        >
                                          <Pencil className="w-3 h-3 text-yellow-300" />
                                          <span>Editado</span>
                                        </div>
                                      )}
                                      {isPaidFcrMovement(fe) && (
                                        <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                                          <Tag className="w-3 h-3" />
                                          FC
                                        </span>
                                      )}
                                    </div>
                                    <MovementNotesBlock notes={fe.notes} />
                                  </td>
                                  <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                    <span className="inline-flex max-w-full items-center rounded border border-[var(--input-border)] bg-[var(--muted)]/15 px-2 py-1 text-xs text-[var(--foreground)]">
                                      {displayPaymentType === "INFORMATIVO"
                                        ? "-"
                                        : formatMovementType(
                                            displayPaymentType,
                                          )}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                    <span className="font-medium text-[var(--foreground)]">
                                      #{fe.invoiceNumber}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    {isCashOpeningRow ? (
                                      (() => {
                                        const openingCRC = Math.trunc(
                                          fe.openingBalanceCRC ?? 0,
                                        );
                                        const openingUSD = Math.trunc(
                                          fe.openingBalanceUSD ?? 0,
                                        );
                                        const breakdownCRC =
                                          fe.openingBreakdownCRC ?? fe.breakdown ?? {};
                                        const breakdownUSD =
                                          fe.openingBreakdownUSD ?? {};

                                        return (
                                          <div className="flex flex-col gap-2 text-right">
                                            <div className="text-xs text-[var(--muted-foreground)]">
                                              Saldo apertura
                                            </div>
                                            <div className="grid gap-2 text-sm font-semibold text-[var(--foreground)] sm:grid-cols-2">
                                              {currencyEnabled.CRC && (
                                                <div className="rounded border border-[var(--input-border)] bg-[var(--muted)]/15 px-2 py-1">
                                                  <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                                                    CRC
                                                  </div>
                                                  <div>{formatByCurrency("CRC", openingCRC)}</div>
                                                </div>
                                              )}
                                              {currencyEnabled.USD && (
                                                <div className="rounded border border-[var(--input-border)] bg-[var(--muted)]/15 px-2 py-1">
                                                  <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                                                    USD
                                                  </div>
                                                  <div>{formatByCurrency("USD", openingUSD)}</div>
                                                </div>
                                              )}
                                            </div>
                                            <div className="mt-1 grid gap-2 sm:grid-cols-2">
                                              {currencyEnabled.CRC && (
                                                <div className="rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-2 py-1 text-left">
                                                  <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                                                    Billetes CRC
                                                  </div>
                                                  <div className="mt-1 text-xs font-normal text-[var(--foreground)]">
                                                    {Object.entries(breakdownCRC).length > 0
                                                      ? Object.entries(breakdownCRC)
                                                          .filter(([, count]) => Number(count) > 0)
                                                          .map(([denom, count]) => `${denom}x${count}`)
                                                          .join(" · ")
                                                      : "-"}
                                                  </div>
                                                </div>
                                              )}
                                              {currencyEnabled.USD && (
                                                <div className="rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-2 py-1 text-left">
                                                  <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                                                    Billetes USD
                                                  </div>
                                                  <div className="mt-1 text-xs font-normal text-[var(--foreground)]">
                                                    {Object.entries(breakdownUSD).length > 0
                                                      ? Object.entries(breakdownUSD)
                                                          .filter(([, count]) => Number(count) > 0)
                                                          .map(([denom, count]) => `${denom}x${count}`)
                                                          .join(" · ")
                                                      : "-"}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()
                                    ) : isAutoAdjustment ? (
                                      (() => {
                                        const closingRecord = fe.originalEntryId
                                          ? dailyClosings.find(
                                              (d) =>
                                                d.id === fe.originalEntryId,
                                            )
                                          : null;

                                        const hasPersistedClosingBalance =
                                          fe.closingBalanceCRC !== undefined ||
                                          fe.closingBalanceUSD !== undefined ||
                                          Boolean(closingRecord);

                                        if (!hasPersistedClosingBalance) {
                                          if (isSuccessfulClosing) {
                                            return (
                                              <div className="text-center text-[var(--muted-foreground)]">
                                                -
                                              </div>
                                            );
                                          }

                                          return (
                                            <div className="flex flex-col gap-1 text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                {isEntryEgreso ? (
                                                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                                                ) : (
                                                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                                                )}
                                                <span
                                                  className={`rounded px-2 py-1 text-xs font-semibold ${
                                                    isEntryEgreso
                                                      ? "bg-red-500/10 text-red-400"
                                                      : "bg-emerald-500/10 text-emerald-400"
                                                  }`}
                                                >
                                                  {`${amountPrefix} ${formatByCurrency(
                                                    entryCurrency,
                                                    movementAmount,
                                                  )}`}
                                                </span>
                                              </div>
                                              <span className="text-xs text-[var(--muted-foreground)] flex items-center justify-center gap-1">
                                                <span>Saldo anterior:</span>
                                                <span>
                                                  {formatByCurrency(
                                                    entryCurrency,
                                                    previousBalance,
                                                  )}
                                                </span>
                                              </span>
                                            </div>
                                          );
                                        }

                                        const closingCRC = Math.trunc(
                                          fe.closingBalanceCRC ??
                                            closingRecord?.totalCRC ??
                                            closingRecord?.recordedBalanceCRC ??
                                            0,
                                        );
                                        const closingUSD = Math.trunc(
                                          fe.closingBalanceUSD ??
                                            closingRecord?.totalUSD ??
                                            closingRecord?.recordedBalanceUSD ??
                                            0,
                                        );

                                        return (
                                          <div className="flex flex-col gap-1 text-right">
                                            {movementAmount !== 0 ? (
                                              <div className="flex items-center justify-end gap-2">
                                                {isEntryEgreso ? (
                                                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                                                ) : (
                                                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                                                )}
                                                <span
                                                  className={`rounded px-2 py-1 text-xs font-semibold ${
                                                    isEntryEgreso
                                                      ? "bg-red-500/10 text-red-400"
                                                      : "bg-emerald-500/10 text-emerald-400"
                                                  }`}
                                                >
                                                  {`${amountPrefix} ${formatByCurrency(
                                                    entryCurrency,
                                                    movementAmount,
                                                  )}`}
                                                </span>
                                              </div>
                                            ) : null}

                                            <div className="text-xs text-[var(--muted-foreground)]">
                                              Saldo al cierre
                                            </div>
                                            <div className="text-sm font-semibold text-[var(--foreground)] flex flex-col gap-0.5">
                                              {currencyEnabled.CRC && (
                                                <div>
                                                  {formatByCurrency(
                                                    "CRC",
                                                    closingCRC,
                                                  )}
                                                </div>
                                              )}
                                              {currencyEnabled.USD && (
                                                <div>
                                                  {formatByCurrency(
                                                    "USD",
                                                    closingUSD,
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()
                                    ) : isSuccessfulClosing ? (
                                      <div className="text-center text-[var(--muted-foreground)]">
                                        -
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-1 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          {isEntryEgreso ? (
                                            <ArrowUpRight className="w-4 h-4 text-red-500" />
                                          ) : (
                                            <ArrowDownRight className="w-4 h-4 text-green-500" />
                                          )}
                                          <span
                                            className={`pl-4 rounded px-2 py-1 font-semibold whitespace-nowrap text-[var(--foreground)] ${
                                              isEntryEgreso
                                                ? "bg-red-500/10 text-red-400"
                                                : "bg-emerald-500/10 text-emerald-400"
                                            } ${
                                              isEntryEgreso &&
                                              appliedCreditNotesTotal > 0
                                                ? "text-sm"
                                                : "text-sm"
                                            }`}
                                          >
                                            {`${amountPrefix} ${formatByCurrency(
                                              entryCurrency,
                                              movementAmount,
                                            )}`}
                                          </span>
                                        </div>
                                        <div className="mt-0.5 flex w-full min-w-0 flex-col gap-1 self-start text-left">
                                          <div className="flex w-full flex-col items-center gap-0 rounded border border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1">
                                            <span className="flex items-center justify-center gap-1 text-xs text-[var(--muted-foreground)]">
                                              <Banknote className="h-3 w-3 shrink-0" />
                                              Saldo anterior
                                            </span>
                                            <span className="w-full pl-4 text-center text-sm font-semibold text-[var(--foreground)] whitespace-nowrap">
                                              {formatByCurrency(
                                                entryCurrency,
                                                previousBalance,
                                              )}
                                            </span>
                                          </div>
                                          {isEntryEgreso &&
                                            (appliedCreditNotesTotal > 0 ||
                                              appliedCreditNotesAdjustment >
                                                0) && (
                                              <>
                                                <div className="flex w-full items-center gap-0 rounded bg-sky-500/10 px-2 py-1">
                                                  <span className="flex items-center justify-center gap-1 text-xs text-sky-200">
                                                    <FileText className="h-3 w-3 shrink-0" />
                                                    Factura
                                                  </span>
                                                  <span className="w-full pl-4 text-center text-sm font-semibold text-sky-100 whitespace-nowrap">
                                                    {formatByCurrency(
                                                      entryCurrency,
                                                      invoiceEgresoAmount,
                                                    )}
                                                  </span>
                                                </div>
                                                {appliedCreditNotesTotal >
                                                  0 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setExpandedAppliedCreditNotesRows(
                                                        (prev) => {
                                                          const next = new Set(
                                                            prev,
                                                          );
                                                          if (next.has(fe.id)) {
                                                            next.delete(fe.id);
                                                          } else {
                                                            next.add(fe.id);
                                                          }
                                                          return next;
                                                        },
                                                      );
                                                    }}
                                                    title={isAppliedCreditNotesExpanded ? "Ocultar NCs" : "Ver NCs aplicadas"}
                                                    aria-expanded={isAppliedCreditNotesExpanded}
                                                    className={`flex w-full gap-0 rounded border px-2 py-1 text-left transition-all ${
                                                      isAppliedCreditNotesExpanded
                                                        ? "border-yellow-500/40 bg-yellow-500/30"
                                                        : "border-yellow-500/20 bg-yellow-500/20 hover:border-yellow-500/30 hover:bg-yellow-500/25"
                                                    }`}
                                                  >
                                                    <span className="flex items-center justify-center gap-1 text-xs text-yellow-300">
                                                      <Tag className="h-3 w-3 shrink-0" />
                                                      NC
                                                    </span>
                                                    <span className="flex items-center justify-end gap-1 pl-4 text-center text-sm font-semibold text-yellow-300 whitespace-nowrap">
                                                      -
                                                      {formatByCurrency(
                                                        entryCurrency,
                                                        appliedCreditNotesTotal,
                                                      )}
                                                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${
                                                        isAppliedCreditNotesExpanded ? "rotate-180" : ""
                                                      }`} />
                                                    </span>
                                                  </button>
                                                )}
                                                {appliedCreditNotesAdjustment >
                                                  0 &&
                                                  (!isPaidFcrEntry ||
                                                    (owedFcrAmount !== null &&
                                                      owedFcrAmount <= 0)) && (
                                                  <div className="flex w-full items-center gap-0 rounded border border-orange-500/15 bg-orange-500/10 px-2 py-1">
                                                    <span className="flex items-center justify-center gap-1 text-xs text-orange-200">
                                                      <RotateCcw className="h-3 w-3 shrink-0" />
                                                      Redondeo
                                                    </span>
                                                    <span className="flex w-full items-center justify-end gap-1 pl-4 text-center text-sm font-semibold text-orange-200 whitespace-nowrap">
                                                      -
                                                      {formatByCurrency(
                                                        entryCurrency,
                                                        appliedCreditNotesAdjustment,
                                                      )}
                                                    </span>
                                                  </div>
                                                )}
                                                {hasAppliedCreditNotes &&
                                                  isAppliedCreditNotesExpanded &&
                                                  Array.isArray(
                                                    fe.appliedCreditNotes,
                                                  ) &&
                                                  fe.appliedCreditNotes.map(
                                                    (note) => {
                                                      const noteLabel =
                                                        note.invoiceNumber
                                                          ? `NC #${note.invoiceNumber}`
                                                          : `NC ${note.id}`;
                                                      const appliedAmount =
                                                        Math.max(
                                                          0,
                                                          Math.trunc(
                                                            Number(
                                                              note.appliedAmount,
                                                            ) || 0,
                                                          ),
                                                        );
                                                      return (
                                                        <div
                                                          key={note.id}
                                                          className="flex w-full items-center gap-0 rounded border border-yellow-500/10 bg-yellow-500/5 px-2 py-0.5"
                                                        >
                                                          <span className="flex items-center gap-1 text-[11px] text-yellow-200">
                                                            <CheckCircle className="h-2.5 w-2.5 shrink-0" />
                                                            {noteLabel}
                                                          </span>
                                                          <span className="w-full text-right text-xs font-medium text-yellow-200">
                                                            -
                                                            {formatByCurrency(
                                                              entryCurrency,
                                                              appliedAmount,
                                                            )}
                                                          </span>
                                                        </div>
                                                      );
                                                    },
                                                  )}
                                              </>
                                            )}
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                    {primaryManager}
                                  </td>
                                  <MovementActionsCell
                                    entry={fe}
                                    isLockedMovement={isLockedMovement}
                                    isPaidFcrEntry={isPaidFcrEntry}
                                    hasAppliedCreditNotes={hasAppliedCreditNotes}
                                    isAppliedCreditNotesExpanded={isAppliedCreditNotesExpanded}
                                    isFcrInfoExpanded={isFcrInfoExpanded}
                                    isAutoAdjustment={isAutoAdjustment}
                                    isPrincipalAdmin={isPrincipalAdmin}
                                    isSuperAdminUser={isSuperAdminUser}
                                    latestCierreFondoVentasMovementId={latestCierreFondoVentasMovementId}
                                    editingEntryId={editingEntryId}
                                    isCierreFondoVentasMovement={isCierreFondoVentasMovement}
                                    onEdit={handleEditMovement}
                                    onDelete={handleDeleteMovement}
                                    onToggleFcrInfo={(entryId) => {
                                      setExpandedFcrInfoRows((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(entryId)) {
                                          next.delete(entryId);
                                        } else {
                                          next.add(entryId);
                                        }
                                        return next;
                                      });
                                    }}
                                    onToggleAppliedCreditNotes={(entryId) => {
                                      setExpandedAppliedCreditNotesRows((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(entryId)) {
                                          next.delete(entryId);
                                        } else {
                                          next.add(entryId);
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                </tr>

                                {hasAppliedCreditNotes &&
                                  isAppliedCreditNotesExpanded &&
                                  !isPaidFcrEntry && (
                                    <AppliedCreditNotesDetails
                                      notes={fe.appliedCreditNotes!}
                                      currency={entryCurrency}
                                      appliedCreditNotesTotal={appliedCreditNotesTotal}
                                      formatByCurrency={formatByCurrency}
                                      variant="sky"
                                      colSpan={7}
                                    />
                                  )}

                                {isPaidFcrEntry && isFcrInfoExpanded && (
                                  <PaidFcrInfoRow
                                    primaryManager={primaryManager}
                                    formattedDate={formattedDate}
                                    manager={fe.manager}
                                    formattedOriginalRegisteredAt={formattedOriginalRegisteredAt}
                                    originalFcrAmount={originalFcrAmount}
                                    owedFcrAmount={owedFcrAmount}
                                    entryCurrency={entryCurrency}
                                    hasAppliedCreditNotes={hasAppliedCreditNotes}
                                    appliedCreditNotes={fe.appliedCreditNotes ?? []}
                                    appliedCreditNotesTotal={appliedCreditNotesTotal}
                                    appliedCreditNotesAdjustment={appliedCreditNotesAdjustment}
                                    formatByCurrency={formatByCurrency}
                                    colSpan={7}
                                  />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      ),
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Totals for the current search / filters */}
          {isSingleDayFilter &&
            filteredEntries.length > 0 &&
            (isAdminUser || isSuperAdminUser) && (
              <FondoTotalsSummary
                isSuperAdminUser={isSuperAdminUser}
                superAdminTotalsOpen={superAdminTotalsOpen}
                onToggleSuperAdminTotalsOpen={() =>
                  setSuperAdminTotalsOpen((p) => !p)
                }
                totalsByCurrency={totalsByCurrency}
                formatByCurrency={formatByCurrency}
              />
            )}
        </div>

        <FondoCurrentBalanceCard
          enabledBalanceCurrencies={enabledBalanceCurrencies}
          currentBalanceCRC={currentBalanceCRC}
          currentBalanceUSD={currentBalanceUSD}
          formatByCurrency={formatByCurrency}
        />
      </div>

      <AuditHistoryModal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        auditModalData={auditModalData}
        dateTimeFormatter={dateTimeFormatter}
        formatByCurrency={formatByCurrency}
        providersMap={providersMap}
      />
      {/* daily closings block removed from inline view */}
      <DailyClosingModal
        key={`daily-${dailyClosingModalOpen ? "open" : "closed"}-${editingDailyClosingId ?? dailyClosingInitialValues?.closingDate ?? "new"}`}
        open={dailyClosingModalOpen}
        onClose={handleCloseDailyClosing}
        onConfirm={handleConfirmDailyClosing}
        initialValues={dailyClosingInitialValues}
        editId={editingDailyClosingId}
        onShowHistory={() => {
          setDailyClosingHistoryRange("today");
          setDailyClosingHistoryOpen(true);
        }}
        employees={employeeOptions}
        loadingEmployees={employeesLoading}
        currentBalanceCRC={currentBalanceCRC}
        currentBalanceUSD={currentBalanceUSD}
        managerReadonly={!editingDailyClosingId}
      />

      <FacturaPaymentModal
        open={closingPaymentModalOpen}
        target={closingPaymentTarget}
        providerName={
          closingPaymentTarget
            ? providers.find(
                (provider) =>
                  provider.code === closingPaymentTarget.providerCode,
              )?.name || closingPaymentTarget.providerCode
            : ""
        }
        employeeOptions={employeeOptions}
        employeesLoading={employeesLoading}
        balanceCRC={currentBalanceCRC}
        balanceUSD={currentBalanceUSD}
        paymentAmount={closingPaymentAmount}
        paymentNotes={closingPaymentNotes}
        paymentManager2={closingPaymentManager2}
        selectedPaymentPaid={Math.max(
          0,
          Math.trunc(Number(closingPaymentTarget?.paidAmount) || 0),
        )}
        selectedPaymentBalance={Math.max(
          0,
          Math.trunc(
            Number(
              closingPaymentTarget?.balanceDue ??
                Math.max(
                  0,
                  Math.trunc(
                    Number(
                      closingPaymentTarget?.originalAmount ??
                        closingPaymentTarget?.amount,
                    ) || 0,
                  ),
                ) -
                  Math.max(
                    0,
                    Math.trunc(Number(closingPaymentTarget?.paidAmount) || 0),
                  ),
            ) || 0,
          ),
        )}
        selectedPaymentStatus={String(
          closingPaymentTarget?.paymentStatus || "PENDIENTE",
        )}
        paymentSubmitting={closingPaymentSubmitting}
        canSubmitFullPayment={true}
        allowPartialPayment={true}
        onClose={closeClosingInvoicePaymentModal}
        onPaymentAmountChange={setClosingPaymentAmount}
        onPaymentNotesChange={setClosingPaymentNotes}
        onPaymentManager2Change={setClosingPaymentManager2}
        onSubmitPartial={() => void submitClosingInvoicePayment("partial")}
        onSubmitFull={() => void submitClosingInvoicePayment("full")}
        pendingCreditNotes={closingPaymentAvailableCreditNotes}
        selectedCreditNoteIds={closingPaymentCreditNoteIds}
        onToggleCreditNote={(id) => {
          setClosingPaymentCreditNoteIds((prev) =>
            prev.includes(id)
              ? prev.filter((item) => item !== id)
              : [...prev, id],
          );
        }}
        creditNotesAppliedTotal={closingPaymentCreditNotesTotal}
      />

      <ConfirmModal
        open={confirmOpenCreateMovement}
        title="Confirmar empresa y cuenta"
        message={`Vas a registrar un movimiento en la empresa "${
          company || ""
        }" y en la cuenta "${accountKey}". Verifica que sea correcto antes de continuar.`}
        confirmText="Continuar"
        cancelText="Cancelar"
        actionType="change"
        onConfirm={confirmOpenCreateMovementNow}
        onCancel={cancelOpenCreateMovement}
      />

      <ConfirmModal
        open={missingShiftModalOpen}
        title="Turno no asignado"
        message={`No se cuenta con un turno (${missingShiftExpectedShift}) asignado para ${missingShiftDateKey || "hoy"}. Debes asignarlo en Control Horario para continuar.`}
        confirmText="Ir a Control Horario"
        cancelText="Cancelar"
        actionType="change"
        onConfirm={() => {
          setMissingShiftModalOpen(false);
          setMovementModalOpen(false);
          window.location.hash = "#controlhorario";
        }}
        onCancel={() => setMissingShiftModalOpen(false)}
      />

      <FondoConfirmModals
        confirmPhysicalCountOpen={confirmPhysicalCountOpen}
        handleCancelPhysicalCount={handleCancelPhysicalCount}
        handleOpenCashOpening={handleOpenCashOpening}
        pendingCierreModalOpen={pendingCierreModalOpen}
        closePendingCierreModal={closePendingCierreModal}
        confirmDeleteEntry={confirmDeleteEntry}
        confirmDeleteMovement={confirmDeleteMovement}
        cancelDeleteMovement={cancelDeleteMovement}
      />

      <CashOpeningModal
        key={`cash-opening-${cashOpeningModalOpen ? "open" : "closed"}-${cashOpeningInitialValues?.openingDate ?? "new"}`}
        open={cashOpeningModalOpen}
        onClose={handleCloseCashOpening}
        onConfirm={handleConfirmCashOpening}
        initialValues={cashOpeningInitialValues}
        employees={employeeOptions}
        loadingEmployees={employeesLoading}
        currentBalanceCRC={currentBalanceCRC}
        currentBalanceUSD={currentBalanceUSD}
        managerReadonly={false}
      />

      <ConfirmModal
        open={pendingZeroAmountCreditNoteModalOpen}
        title="NC pendiente en monto 0"
        message={`Existe ${
          pendingZeroAmountCreditNotes.length === 1
            ? "una nota de credito pendiente con monto 0"
            : `${pendingZeroAmountCreditNotes.length} notas de credito pendientes con monto 0`
        }. Debes corregir el monto desde FC/NC antes de agregar un movimiento.`}
        singleButton
        singleButtonText="Ir a FC/NC"
        actionType="change"
        onCancel={() => {
          setPendingZeroAmountCreditNoteModalOpen(false);
          window.location.hash = "#facturas";
        }}
        onConfirm={() => {}}
      />

      <ConfirmModal
        open={negativeBalanceModal.open}
        title="Saldo insuficiente"
        message={
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta acción no puede llevarse a cabo porque el saldo quedaría en
              negativo.
            </p>

            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Monto de la salida
                </span>
                <span className="font-semibold">
                  {negativeBalanceModal.currency === "USD" ? "$ " : "₡ "}
                  {new Intl.NumberFormat(
                    negativeBalanceModal.currency === "USD" ? "en-US" : "es-CR",
                    {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    },
                  ).format(negativeBalanceModal.amount)}
                </span>
              </div>

              <div className="border-t border-destructive/20" />

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Saldo resultante
                </span>
                <span className="font-semibold text-destructive flex items-center gap-1">
                  <span>?</span>
                  {negativeBalanceModal.currency === "USD" ? "$ " : "₡ "}
                  {new Intl.NumberFormat(
                    negativeBalanceModal.currency === "USD" ? "en-US" : "es-CR",
                    {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    },
                  ).format(negativeBalanceModal.resultingNegativeAmount)}
                </span>
              </div>
            </div>
          </div>
        }
        confirmText="De Acuerdo"
        cancelText=""
        singleButton={true}
        singleButtonText="De Acuerdo"
        actionType="assign"
        onConfirm={() =>
          setNegativeBalanceModal({
            open: false,
            amount: 0,
            currency: "CRC",
            resultingNegativeAmount: 0,
          })
        }
        onCancel={() =>
          setNegativeBalanceModal({
            open: false,
            amount: 0,
            currency: "CRC",
            resultingNegativeAmount: 0,
          })
        }
      />

      <DailyClosingHistoryModal
        open={dailyClosingHistoryOpen}
        onClose={() => setDailyClosingHistoryOpen(false)}
        closingsAreLoading={closingsAreLoading}
        dailyClosings={dailyClosings}
        quickRange={dailyClosingHistoryRange}
        onQuickRangeChange={setDailyClosingHistoryRange}
        dailyClosingDateFormatter={dailyClosingDateFormatter}
        dateTimeFormatter={dateTimeFormatter}
        buildBreakdownLines={buildBreakdownLines}
        formatByCurrency={formatByCurrency}
        formatDailyClosingDiff={formatDailyClosingDiff}
        getDailyClosingDiffClass={getDailyClosingDiffClass}
        fondoEntries={fondoEntries}
        isAutoAdjustmentProvider={isAutoAdjustmentProvider}
        expandedClosings={expandedClosings}
        setExpandedClosings={setExpandedClosings}
        canDeleteLatestClosing={
          Boolean(isSuperAdminUser) &&
          accountKey === "FondoGeneral" &&
          Boolean((company || "").trim()) &&
          dailyClosings.length > 0
        }
        latestClosingLabel={latestDailyClosingLabel}
        onDeleteLatestClosing={handleDeleteLatestDailyClosing}
      />
    </div>
  );
}
