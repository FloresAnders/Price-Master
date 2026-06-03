"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import {
  UserPlus,
  Plus,
  Pencil,
  Trash2,
  X,
  Banknote,
  Clock,
  Layers,
  Tag,
  FileText,
  UserCircle,
  ArrowUpDown,
  EyeIcon,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  LockOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
  CheckCircle,
  Info,
  RotateCcw,
  Mail,
  MessageSquare,
  XCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useProviders } from "../../../hooks/useProviders";
import useToast from "../../../hooks/useToast";
import type { UserPermissions, Empresas, User } from "../../../types/firestore";
import { getDefaultPermissions } from "../../../utils/permissions";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import DailyClosingHistoryModal from "../../../components/modals/DailyClosingHistoryModal";
import { EmpresasService } from "../../../services/empresas";
import { UsersService } from "../../../services/users";
import { ProvidersService } from "../../../services/providers";
import { SchedulesService } from "../../../services/schedules";
import {
  resolveManagerFromControlHorario,
  getControlHorarioShiftTiming,
  getCostaRicaDateKeyAndMinute,
  type ShiftCode,
} from "@/utils/controlHorarioManager";
import { generateEgresoProviderCreatedEmail } from "../../../services/email-templates/proveedor-egreso-creado";
import {
  FacturasService,
  type AppliedCreditNote,
  type FacturaMovement,
} from "../../../services/facturas";
import {
  findLatestMovementByInvoiceNumber,
  sendDuplicateInvoiceAlertEmail,
} from "../../../services/duplicate-invoice-alert";
import { AuditHistoryModal } from "./audit-history-modal";
import {
  MovimientosFondosService,
  MovementAccountKey,
  MovementCurrencyKey,
  MovementStorage,
  MovementStorageState,
} from "../../../services/movimientos-fondos";
import {
  ReportesMovimientosService,
  ReporteMovimientosDetailItem,
  type ReporteMovimientoCurrency,
} from "../../../services/reportes-movimientos";
import {
  DailyClosingsService,
  DailyClosingRecord,

} from "../../../services/daily-closings";
import { buildDailyClosingEmailTemplate } from "../../../services/email-templates/daily-closing";
import AgregarMovimiento from "./AgregarMovimiento";
import DailyClosingModal, { DailyClosingFormValues } from "./DailyClosingModal";
import FacturaPaymentModal from "./FacturaPaymentModal";
import { FondoMovementsSkeleton } from "./FondoMovementsSkeleton";
import { ensureV2MovementsLoaded as ensureV2MovementsLoadedFn } from "../utils/v2movementsLoader";
import { handleSaveManualCreditNote as handleSaveManualCreditNoteFn } from "../utils/manualCreditNote";
import { handleSubmitFondo as handleSubmitFondoFn } from "../utils/submitFondo";
import { useActorOwnership } from "../../../hooks/useActorOwnership";
import type { FondoEntry, FondoMovementType } from "../types";
import { submitClosingInvoicePayment as submitClosingInvoicePaymentFn } from "../utils/closingInvoicePayment";
import { persistMovementToFirestore as persistMovementToFirestoreFn } from "../utils/persistence";
import { handleConfirmDailyClosing as handleConfirmDailyClosingFn } from "../utils/dailyClosing";
import {
  FONDO_INGRESO_TYPES,
  FONDO_GASTO_TYPES,
  FONDO_EGRESO_TYPES,
  FONDO_TYPE_OPTIONS,
  AUTO_ADJUSTMENT_PROVIDER_CODE,
  AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY,
  AUTO_ADJUSTMENT_MANAGER,
  AUTO_ADJUSTMENT_CLOSING_TYPE,
  CIERRE_FONDO_VENTAS_PROVIDER_NAME,
  CIERRE_FONDO_VENTAS_MINUTES_BEFORE_END,
  CIERRE_FONDO_VENTAS_MINUTES_AFTER_END,
  INGRESO_DESDE_FONDO_VENTAS_NAME,
  MAX_AUDIT_EDITS,
  FONDO_KEY_SUFFIX,
  DAILY_CLOSINGS_STORAGE_PREFIX,
  SHARED_COMPANY_STORAGE_KEY,
  NAMESPACE_PERMISSIONS,
  NAMESPACE_DESCRIPTIONS,
  ACCOUNT_KEY_BY_NAMESPACE,
  MOVEMENT_ACCOUNT_KEYS,
  SAVE_COOLDOWN_MS,
  CACHE_TTL_MS,
  MOVEMENT_COOLDOWN_MS,
  CLOSING_GUARD_LOCK_DURATION_MS,
} from "../constants";
import { db } from "@/config/firebase";
import { findBestStringMatch } from "../../../utils/stringSimilarity";
import {
  dateKeyToISODate,
  dateToKey,
  isoDateToDateKey,
} from "../../../utils/dateKey";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

import {
  stripUndefinedDeep,
  normalizeMovementLabel,
  parseLastCreatedCooldown,
  getEffectiveLastCreatedAtMs,
  isAutoAdjustmentProvider,
  isIngresoDesdeFondoVentasMovement,
  getMovementTypeKey,
  includesMovementType,
  getCanonicalFondoMovementType,
  isFondoMovementType,
  isIngresoType,
  isGastoType,
  isEgresoType,
  formatMovementType,
  isGeneralClosingProviderName,
  hasGeneralClosingAdjustmentNotes,
  hasGeneralClosingNoDiffNotes,
  isInventoryPurchasePaymentType,
  isInventoryPurchaseProviderType,
  normalizeStoredType,
  normalizeInvoiceDocType,
  resolveEffectiveEgresoAmount,
  isPaidFcrMovement,
  getPrimaryMovementDateISO,
  getPrimaryMovementTime,
  getPrimaryMovementManager,
  getFcrPaymentInvoiceId,
  getFcrPaymentAmount,
  roundCreditNotePaymentAmount,
  getChangedFields,
  compressAuditHistory,
  buildStorageKey,
  sanitizeMoneyNumber,
  sanitizeBreakdown,
  sanitizeAdjustmentResolution,
  mergeDailyClosingRecords,
  isMovementAccountKey,
  getAccountKeyFromNamespace,
  coerceIdentifier,
  coerceInvoice,
  coerceNotes,
  coerceTruncNumber,
  resolveCreatedAt,
  dateKeyFromDate,
  sanitizeFondoEntries,
  formatToastWaitTime,
  type LastCreatedCooldownPayload,
  type ClosingGuardKind,
  type PendingCreditNoteOption,
} from "../utils/helpers";
import {
  buildV2MovementsCacheKey,
  buildLocalDayIsoRange,
  resolveV2DocKey,
} from "../utils/v2movements";
import { useFondoMovementTypes } from "../hooks/useFondoMovementTypes";
import { useSuperAdminUsers } from "../hooks/useSuperAdminUsers";
import { useFondoFilters } from "../hooks/useFondoFilters";
import { useDailyClosingState } from "../hooks/useDailyClosingState";
import { useMovementForm } from "../hooks/useMovementForm";
import {
  isMovementLocked as isMovementLockedFn,
  isCierreFondoVentasMovement as isCierreFondoVentasMovementFn,
  handleDeleteMovement as handleDeleteMovementFn,
  confirmDeleteMovement as confirmDeleteMovementFn,
  cancelDeleteMovement as cancelDeleteMovementFn,
} from "../utils/movementDeletion";
import {
  acquireClosingGuard,
  forceClearClosingGuards,
  releaseClosingGuard,
  touchClosingGuard,
} from "../utils/closingGuards";
import {
  buildPhysicalCountStorageKey as buildPhysicalCountStorageKeyFn,
  buildLegacyPhysicalCountStorageKey as buildLegacyPhysicalCountStorageKeyFn,
  cleanupPhysicalCountLegacyKeys as cleanupPhysicalCountLegacyKeysFn,
  shouldPromptPhysicalCount as shouldPromptPhysicalCountFn,
} from "../utils/physicalCount";
import { sendMovementNotification } from "../utils/notifications";
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
  const allowedOwnerIds = useMemo(() => {
    const set = new Set<string>();
    actorOwnerIds.forEach((id) => {
      const normalized =
        typeof id === "string" ? id.trim() : String(id || "").trim();
      if (normalized) set.add(normalized);
    });
    if (user?.ownerId) {
      const normalized = String(user.ownerId).trim();
      if (normalized) set.add(normalized);
    }
    return set;
  }, [actorOwnerIds, user?.ownerId]);
  const allowedOwnerIdsKey = useMemo(
    () => Array.from(allowedOwnerIds).sort().join("|"),
    [allowedOwnerIds],
  );
  const resolvedOwnerId = useMemo(() => {
    const normalizedPrimary = (primaryOwnerId || "").trim();
    if (normalizedPrimary) return normalizedPrimary;
    const [firstAllowed] = Array.from(allowedOwnerIds);
    if (firstAllowed) return firstAllowed;
    return "";
  }, [allowedOwnerIds, primaryOwnerId]);
  const isAdminUser = user?.role === "admin";
  const isSuperAdminUser = user?.role === "superadmin";
  const isRegularUser = user?.role === "user";
  const [superAdminTotalsOpen, setSuperAdminTotalsOpen] = useState(false);
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
  const [ownerAdminEmail, setOwnerAdminEmail] = useState<string | null>(null);
  const [ownerCompanies, setOwnerCompanies] = useState<Empresas[]>([]);
  const [ownerCompaniesLoading, setOwnerCompaniesLoading] = useState(false);
  const [ownerCompaniesError, setOwnerCompaniesError] = useState<string | null>(
    null,
  );

  const sortedOwnerCompanies = useMemo(() => {
    const normalize = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    const valueKey = (emp: Empresas) =>
      normalize(emp?.name || emp?.ubicacion || emp?.id || "");

    const score = (emp: Empresas) =>
      (normalize(emp?.id) ? 2 : 0) +
      (normalize(emp?.name) ? 1 : 0) +
      (normalize(emp?.ubicacion) ? 1 : 0);

    const byKey = new Map<string, Empresas>();
    ownerCompanies.forEach((emp) => {
      const key = valueKey(emp);
      if (!key) return;
      const existing = byKey.get(key);
      if (!existing || score(emp) > score(existing)) {
        byKey.set(key, emp);
      }
    });

    const deduped = Array.from(byKey.values());

    const ubicacionesWithNamed = new Set<string>();
    deduped.forEach((emp) => {
      const name = normalize(emp?.name);
      const ubicacion = normalize(emp?.ubicacion);
      if (name && ubicacion) ubicacionesWithNamed.add(ubicacion);
    });

    const cleaned = deduped.filter((emp) => {
      const name = normalize(emp?.name);
      const ubicacion = normalize(emp?.ubicacion);
      if (!name && ubicacion && ubicacionesWithNamed.has(ubicacion))
        return false;
      return true;
    });

    return cleaned.sort((a, b) =>
      (a.name || a.ubicacion || "").localeCompare(
        b.name || b.ubicacion || "",
        "es",
        {
          sensitivity: "base",
        },
      ),
    );
  }, [ownerCompanies]);

  useEffect(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const getEmpresaCompanyKey = (emp: Empresas) =>
      String(emp?.name || emp?.ubicacion || emp?.id || "").trim();
    const normalizedAssignedCompany = normalizeCompanyKey(assignedCompany);

    if (authLoading || !user) {
      setOwnerCompanies([]);
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(null);
      return;
    }

    if (!canSelectCompany && !normalizedAssignedCompany) {
      setOwnerCompanies([]);
      setResolvedCompany("");
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(null);
      return;
    }

    if (isAdminUser && allowedOwnerIds.size === 0) {
      setOwnerCompanies([]);
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(
        "No se pudo determinar el ownerId asociado a tu cuenta.",
      );
      return;
    }

    let isMounted = true;
    setOwnerCompaniesLoading(true);
    setOwnerCompaniesError(null);

    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isMounted) return;
        const filtered = isAdminUser
          ? empresas.filter((emp) => {
              const owner = (emp.ownerId || "").trim();
              if (!owner) return false;
              return allowedOwnerIds.has(owner);
            })
          : canSelectCompany
            ? empresas
            : empresas.filter((emp) => {
                const candidates = [emp.name, emp.ubicacion, emp.id]
                  .map(normalizeCompanyKey)
                  .filter(Boolean);
                return candidates.includes(normalizedAssignedCompany);
              });
        setOwnerCompanies(filtered);
        if (canSelectCompany) {
          setAdminCompany((current) => {
            const normalizedCurrent = normalizeCompanyKey(current);
            if (normalizedCurrent.length > 0) {
              const exists = filtered.some((emp) => {
                const candidates = [emp.name, emp.ubicacion, emp.id]
                  .map(normalizeCompanyKey)
                  .filter(Boolean);
                return candidates.includes(normalizedCurrent);
              });
              if (exists) return current;
            }

            const fallback = filtered[0];
            return fallback ? getEmpresaCompanyKey(fallback) : "";
          });
        }
        if (!canSelectCompany) {
          const fallback = filtered[0];
          setResolvedCompany(
            fallback ? getEmpresaCompanyKey(fallback) : assignedCompany,
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setOwnerCompanies([]);
        setOwnerCompaniesError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las empresas disponibles.",
        );
      })
      .finally(() => {
        if (isMounted) setOwnerCompaniesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    allowedOwnerIds,
    allowedOwnerIdsKey,
    assignedCompany,
    authLoading,
    canSelectCompany,
    isAdminUser,
    user,
  ]);

  const activeOwnerId = useMemo(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    if (canSelectCompany) {
      const normalizedCompany = normalizeCompanyKey(adminCompany);
      if (normalizedCompany.length > 0) {
        const match = ownerCompanies.find((emp) => {
          const candidates = [emp.name, emp.ubicacion, emp.id]
            .map(normalizeCompanyKey)
            .filter(Boolean);
          return candidates.includes(normalizedCompany);
        });
        const ownerId =
          typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
        if (ownerId) return ownerId;
      }

      const fallbackAdminOwner =
        typeof ownerCompanies[0]?.ownerId === "string"
          ? ownerCompanies[0].ownerId.trim()
          : "";
      if (fallbackAdminOwner) return fallbackAdminOwner;
    }

    const normalizedAssignedCompany = normalizeCompanyKey(company);
    if (normalizedAssignedCompany.length > 0 && ownerCompanies.length > 0) {
      const match = ownerCompanies.find((emp) => {
        const candidates = [emp.name, emp.ubicacion, emp.id]
          .map(normalizeCompanyKey)
          .filter(Boolean);
        return candidates.includes(normalizedAssignedCompany);
      });
      const ownerId =
        typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
      if (ownerId) return ownerId;
    }

    return resolvedOwnerId;
  }, [
    adminCompany,
    canSelectCompany,
    company,
    ownerCompanies,
    resolvedOwnerId,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!activeOwnerId) {
      setOwnerAdminEmail(null);
      return () => {
        cancelled = true;
      };
    }

    setOwnerAdminEmail(null);

    const loadAdminEmail = async () => {
      try {
        const admin = await UsersService.getPrimaryAdminByOwner(activeOwnerId);
        if (cancelled) return;
        const email =
          typeof admin?.email === "string" ? admin.email.trim() : "";
        setOwnerAdminEmail(email.length > 0 ? email : null);
      } catch (error) {
        if (cancelled) return;
        console.error(
          "Error loading owner admin email for daily closing notifications:",
          error,
        );
        setOwnerAdminEmail(null);
      }
    };

    void loadAdminEmail();

    return () => {
      cancelled = true;
    };
  }, [activeOwnerId]);
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

  const fgSchedulesMonthCacheRef = useRef<
    Map<
      string,
      {
        at: number;
        promise: Promise<
          Awaited<
            ReturnType<typeof SchedulesService.getSchedulesByLocationYearMonth>
          >
        >;
      }
    >
  >(new Map());
  const FG_SCHEDULES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  const getFGMonthlySchedulesCached = useCallback(
    async (locationValue: string, year: number, month0: number) => {
      const key = `${locationValue}__${year}__${month0}`;
      const now = Date.now();
      const cached = fgSchedulesMonthCacheRef.current.get(key);
      if (cached && now - cached.at < FG_SCHEDULES_CACHE_TTL_MS) {
        return cached.promise;
      }
      const promise = SchedulesService.getSchedulesByLocationYearMonth(
        locationValue,
        year,
        month0,
      );
      fgSchedulesMonthCacheRef.current.set(key, { at: now, promise });
      return promise;
    },
    [],
  );

  const activeEmpresaForCompany = useMemo(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    const normalizedSelected = normalizeCompanyKey(company);
    if (!normalizedSelected) return null;

    const matches = ownerCompanies.filter((emp) => {
      const candidates = [emp?.name, emp?.ubicacion, emp?.id]
        .map(normalizeCompanyKey)
        .filter(Boolean);
      return candidates.includes(normalizedSelected);
    });

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    const score = (emp: Empresas) => {
      const name = normalizeCompanyKey(emp?.name);
      const ubicacion = normalizeCompanyKey(emp?.ubicacion);
      const id = normalizeCompanyKey(emp?.id);
      const exact =
        normalizedSelected === name ||
        normalizedSelected === ubicacion ||
        normalizedSelected === id
          ? 3
          : 0;
      const hasOpen = String(emp?.horarioApertura || "").trim() ? 2 : 0;
      const hasClose = String(emp?.horarioCierre || "").trim() ? 2 : 0;
      const hasEmployees =
        Array.isArray(emp?.empleados) && emp.empleados.length > 0 ? 1 : 0;
      return exact + hasOpen + hasClose + hasEmployees;
    };

    let best = matches[0];
    let bestScore = score(best);
    for (let i = 1; i < matches.length; i++) {
      const cur = matches[i];
      const curScore = score(cur);
      if (curScore > bestScore) {
        best = cur;
        bestScore = curScore;
      }
    }

    return best;
  }, [company, ownerCompanies]);

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
  const [companyEmployees, setCompanyEmployees] = useState<string[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [selectedProviderPendingNcCount, setSelectedProviderPendingNcCount] =
    useState(0);
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

  const [pendingClosingCreditInvoices, setPendingClosingCreditInvoices] =
    useState<FacturaMovement[]>([]);
  const [
    showPendingClosingCreditInvoices,
    setShowPendingClosingCreditInvoices,
  ] = useState(false);
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
  const [pendingCierreDeCaja, setPendingCierreDeCaja] = useState(false);
  const [pendingCierreModalOpen, setPendingCierreModalOpen] = useState(false);
  const [pendingZeroAmountCreditNotes, setPendingZeroAmountCreditNotes] =
    useState<FacturaMovement[]>([]);
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

  useEffect(() => {
    let cancelled = false;

    if (!company) {
      setPendingClosingCreditInvoices([]);
      setPendingZeroAmountCreditNotes([]);
      return () => {
        cancelled = true;
      };
    }

    FacturasService.listMovementsByEmpresa(company, { limit: 800 })
      .then((movements) => {
        if (cancelled) return;
        const pending = movements
          .filter((movement) => {
            if (normalizeInvoiceDocType(movement.invoiceDocType) !== "FCR") {
              return false;
            }
            const totalAmount = Math.max(
              0,
              Math.trunc(
                Number(movement.originalAmount ?? movement.amount) || 0,
              ),
            );
            const paidAmount = Math.max(
              0,
              Math.trunc(Number(movement.paidAmount) || 0),
            );
            const balanceDue = Math.max(
              0,
              Math.trunc(
                Number(movement.balanceDue ?? totalAmount - paidAmount) || 0,
              ),
            );
            return (
              balanceDue > 0 &&
              !["PAGADA", "REBAJADA"].includes(
                String(movement.paymentStatus || "").toUpperCase(),
              )
            );
          })
          .sort((a, b) => {
            const aDate = new Date(a.createdAt || 0).getTime();
            const bDate = new Date(b.createdAt || 0).getTime();
            return bDate - aDate;
          });
        setPendingClosingCreditInvoices(pending);
        const pendingZeroNotes = movements.filter((movement) => {
          if (normalizeInvoiceDocType(movement.invoiceDocType) !== "NC") {
            return false;
          }
          if (Math.max(0, Math.trunc(Number(movement.amount) || 0)) !== 0) {
            return false;
          }
          return !["PAGADA", "REBAJADA"].includes(
            String(movement.paymentStatus || "PENDIENTE").toUpperCase(),
          );
        });
        setPendingZeroAmountCreditNotes(pendingZeroNotes);
      })
      .catch((error) => {
        console.error("[FONDO] Error loading pending credit invoices:", error);
        if (!cancelled) {
          setPendingClosingCreditInvoices([]);
          setPendingZeroAmountCreditNotes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company]);

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
    setCurrentDailyKey,
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
    providerFilter,
    setProviderFilter,
    isProviderDropdownOpen,
    setIsProviderDropdownOpen,
    providerSearchInput,
    setProviderSearchInput,
    filteredProvidersForFilter,
    filterPaymentType,
    setFilterPaymentType,
    typeFilter,
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
    displayedEntries,
    daysWithMovements,
    filteredEntries,
    earliestEntryKey,
    totalPages,
    paginatedEntries,
    isDailyMode,
    shiftDateKey,
    disablePrevButton,
    disableNextButton,
    pageRange,
    handlePrevPage,
    handleNextPage,
    groupedByDay,
    formatGroupLabel,
    formatKeyToDisplay,
    isFilterActive,
    isSingleDayFilter,
    dateOnlyFormatter,
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
    latestDailyClosing,
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
    physicalCountWasDone,
    setPhysicalCountWasDone,
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
    resetFormFields,
  } = useMovementForm({ mode, fondoEntries });
  const { superAdminUsers, superAdminUsersLoading } = useSuperAdminUsers(
    Boolean(isSuperAdminUser),
    editingEntryId,
  );

  const [entriesHydrated, setEntriesHydrated] = useState(false);
  const [hydratedCompany, setHydratedCompany] = useState("");
  const [hydratedAccountKey, setHydratedAccountKey] =
    useState<MovementAccountKey>(accountKey);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const movementsLoadingCountRef = useRef(0);
  const beginMovementsLoading = useCallback(() => {
    movementsLoadingCountRef.current += 1;
    setMovementsLoading(true);
  }, []);
  const endMovementsLoading = useCallback(() => {
    movementsLoadingCountRef.current = Math.max(
      0,
      movementsLoadingCountRef.current - 1,
    );
    if (!isComponentMountedRef.current) return;
    if (movementsLoadingCountRef.current === 0) {
      setMovementsLoading(false);
    }
  }, []);
  const [currencyEnabled, setCurrencyEnabled] = useState<
    Record<MovementCurrencyKey, boolean>
  >({
    CRC: true,
    USD: true,
  });
  const [companyData, setCompanyData] = useState<Empresas | null>(null);

  const enabledBalanceCurrencies = useMemo(
    () =>
      (["CRC", "USD"] as MovementCurrencyKey[]).filter(
        (currency) => currencyEnabled[currency],
      ),
    [currencyEnabled],
  );

  // Marca en localStorage para confirmar conteo físico antes del primer movimiento
  // después del cierre de hoy. IMPORTANTE: debe leerse en tiempo real (no memoizada)
  // porque localStorage puede cambiar sin alterar dependencias de React.
  // Legacy keys (previous formats)
  const buildLegacyPhysicalCountStorageKey = useCallback(
    () => buildLegacyPhysicalCountStorageKeyFn(accountKey, company),
    [company, accountKey],
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
  const storageSnapshotRef = useRef<MovementStorage<FondoEntry> | null>(null);

  // Keep latest accountKey without re-triggering full remote reloads on tab switch.
  const accountKeyRef = useRef<MovementAccountKey>(accountKey);
  useEffect(() => {
    accountKeyRef.current = accountKey;
  }, [accountKey]);

  const applyLedgerStateFromStorage = useCallback(
    (state?: MovementStorageState | null) => {
      if (!state) return;

      const parseBalance = (value: unknown) => {
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
      };

      const resolveSettings = (currency: MovementCurrencyKey) => {
        const accountBalance = state.balancesByAccount?.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === currency,
        );
        return {
          enabled: accountBalance?.enabled ?? true,
          initialBalance: parseBalance(accountBalance?.initialBalance ?? 0),
          currentBalance: parseBalance(accountBalance?.currentBalance ?? 0),
        };
      };

      const crcSettings = resolveSettings("CRC");
      const usdSettings = resolveSettings("USD");

      setCurrencyEnabled({
        CRC: crcSettings.enabled,
        USD: usdSettings.enabled,
      });

      setInitialAmount(crcSettings.initialBalance.toString());
      setInitialAmountUSD(usdSettings.initialBalance.toString());

      setLedgerSnapshot({
        initialCRC: crcSettings.initialBalance,
        currentCRC: crcSettings.currentBalance,
        initialUSD: usdSettings.initialBalance,
        currentUSD: usdSettings.currentBalance,
      });
    },
    [accountKey],
  );

  // Cache v2 movements per companyKey to avoid re-reading the whole subcollection when switching tabs.
  // Also stores a Firestore cursor so we can load more pages only when needed.
  const v2MovementsCacheRef = useRef<
    Record<
      string,
      {
        loaded: boolean;
        movements: FondoEntry[];
        cursor: QueryDocumentSnapshot<DocumentData> | null;
        exhausted: boolean;
        loading: boolean;
        queryKey?: string;
        startIso?: string;
        endIsoExclusive?: string;
      }
    >
  >({});



  const rebuildEntriesFromV2Cache = useCallback(
    (docKey: string, targetAccountKey: MovementAccountKey) => {
      const cacheKey = buildV2MovementsCacheKey(docKey, targetAccountKey);
      const cached = v2MovementsCacheRef.current[cacheKey];
      if (!cached?.loaded) return;

      const scopedEntries = cached.movements.filter((rawEntry) => {
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
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setFondoEntries(entries);

      const state = storageSnapshotRef.current?.state;
      if (state) {
        applyLedgerStateFromStorage(state);
      }
    },
    [applyLedgerStateFromStorage, buildV2MovementsCacheKey],
  );

  const ensureV2MovementsLoaded = useCallback(
    (docKey: string, options?: { append?: boolean }) =>
      ensureV2MovementsLoadedFn(docKey, options, {
        rebuildEntriesFromV2Cache,
        beginMovementsLoading,
        endMovementsLoading,
        pageSize,
        currentDailyKey,
        todayKey,
        fromFilter,
        toFilter,
        accountKeyRef,
        v2MovementsCacheRef,
      }),
    [
      rebuildEntriesFromV2Cache,
      beginMovementsLoading,
      endMovementsLoading,
      pageSize,
      currentDailyKey,
      todayKey,
      fromFilter,
      toFilter,
    ],
  );

  // When using numeric pagination, load more remote pages only if needed.
  useEffect(() => {
    if (!entriesHydrated) return;
    const docKey = resolveV2DocKey({ company, resolvedOwnerId, v2MovementsCache: v2MovementsCacheRef.current, accountKey: accountKeyRef.current, MovimientosFondosService });
    if (!docKey) return;
    const cacheKey = buildV2MovementsCacheKey(docKey, accountKey);
    const cached = v2MovementsCacheRef.current[cacheKey];
    if (!cached?.loaded || cached.loading || cached.exhausted) return;

    if (pageSize === "daily") return;

    if (pageSize === "all") {
      // "Todos" should keep fetching batches until the active range is exhausted.
      void ensureV2MovementsLoaded(docKey, { append: true });
      return;
    }

    if (typeof pageSize !== "number" || pageSize <= 0) return;

    const needed = (pageIndex + 1) * pageSize;
    if (cached.movements.length >= needed) return;

    // Append one more batch when user navigates past what we have.
    void ensureV2MovementsLoaded(docKey, { append: true });
  }, [
    entriesHydrated,
    pageSize,
    pageIndex,
    fondoEntries.length,
    accountKey,
    ensureV2MovementsLoaded,
  ]);

  useEffect(() => {
    setCurrencyEnabled({ CRC: true, USD: true });
    setMovementCurrency("CRC");
    setInitialAmount("0");
    setInitialAmountUSD("0");
    storageSnapshotRef.current = null;
  }, [company, accountKey]);

  useEffect(() => {
    if (currencyEnabled[movementCurrency]) return;
    if (currencyEnabled.CRC) {
      setMovementCurrency("CRC");
      return;
    }
    if (currencyEnabled.USD) {
      setMovementCurrency("USD");
    }
  }, [currencyEnabled, movementCurrency]);

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
    if (
      !entriesHydrated ||
      providers.length === 0 ||
      fondoEntries.length === 0
    ) {
      return;
    }

    const sortedEntries = [...fondoEntries].sort(
      (a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a),
    );
    // Determine if there is a pending "CIERRE FONDO VENTAS" that has not
    // been superseded by an auto-adjustment (CIERRE DE FONDO GENERAL) or by a
    // confirmed daily closing record. We consider the most recent cierre entry
    // and compare it with the latest daily closing saved for the company.
    let hasPendingCierreDeCaja = false;
    let cierreEntryTs = 0;
    for (const entry of sortedEntries) {
      // If we find an auto-adjustment (CIERRE DE FONDO GENERAL) newer than any
      // cierre entry, there is no pending cierre.
      if (isAutoAdjustmentProvider(entry.providerCode)) {
        cierreEntryTs = 0;
        break;
      }
      // Buscar el nombre del proveedor por su código
      const providerData = providers.find((p) => p.code === entry.providerCode);
      if (
        providerData?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME
      ) {
        const parsed = Date.parse(String(entry.createdAt || ""));
        cierreEntryTs = Number.isFinite(parsed) ? parsed : 0;
        break;
      }
    }

    if (cierreEntryTs > 0) {
      // If we have daily closings loaded, compare timestamps: if the latest
      // daily closing is at or after the cierre entry, consider it confirmed
      // (not pending). Otherwise keep as pending.
      let latestDailyClosingTs = 0;
      if (Array.isArray(dailyClosings) && dailyClosings.length > 0) {
        for (const record of dailyClosings) {
          const ts = Date.parse(record.createdAt || record.closingDate || "");
          if (Number.isFinite(ts) && ts > latestDailyClosingTs)
            latestDailyClosingTs = ts;
        }
      }
      hasPendingCierreDeCaja = cierreEntryTs > latestDailyClosingTs;
    } else {
      hasPendingCierreDeCaja = false;
    }

    setPendingCierreDeCaja(hasPendingCierreDeCaja);
    console.log(
      "[CIERRE-DEBUG] Estado pendingCierreDeCaja después de cargar:",
      hasPendingCierreDeCaja,
      {
        cierreEntryTs,
        latestDailyClosingTs: Array.isArray(dailyClosings)
          ? Math.max(
              ...dailyClosings.map(
                (r) => Date.parse(r.createdAt || r.closingDate || "") || 0,
              ),
            )
          : 0,
      },
    );
  }, [
    entriesHydrated,
    providers,
    fondoEntries,
    dailyClosings,
    dailyClosingsHydrated,
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
    let isActive = true;
    setCompanyEmployees([]);

    if (!company) {
      setEmployeesLoading(false);
      return () => {
        isActive = false;
      };
    }

    // Solo cargar empleados de la empresa si estamos en fondogeneral (fg) o cajanegra (cn)
    // Para otros fondos (BCR, BN, BAC), no cargar empleados
    if (namespace !== "fg" && namespace !== "cn") {
      setEmployeesLoading(false);
      return () => {
        isActive = false;
      };
    }

    setEmployeesLoading(true);
    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isActive) return;
        const match = empresas.find(
          (emp) => emp.name?.toLowerCase() === company.toLowerCase(),
        );
        const names =
          match?.empleados?.map((emp) => emp.Empleado).filter(Boolean) ?? [];
        setCompanyEmployees(names as string[]);
      })
      .catch((err) => {
        console.error("Error loading company employees:", err);
        if (isActive) setCompanyEmployees([]);
      })
      .finally(() => {
        if (isActive) setEmployeesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [company, namespace]);

  // Load company data to check ownerId for delete permissions
  useEffect(() => {
    let isActive = true;
    setCompanyData(null);

    if (!company) {
      return () => {
        isActive = false;
      };
    }

    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isActive) return;
        const match = empresas.find(
          (emp) => emp.name?.toLowerCase() === company.toLowerCase(),
        );
        if (match) {
          setCompanyData(match);
        }
      })
      .catch((err) => {
        console.error("Error loading company data:", err);
        if (isActive) setCompanyData(null);
      });

    return () => {
      isActive = false;
    };
  }, [company]);

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

  const resolveShiftManagerForNow = useCallback(
    async (nowISO: string) => {
      const empresa = activeEmpresaForCompany;
      const normalizedCompany = (company || "").trim();
      if (!empresa || !normalizedCompany) return null;

      const companyKeysToTry = (() => {
        const set = new Set<string>();
        set.add(normalizedCompany);
        [empresa?.name, empresa?.ubicacion, empresa?.id]
          .map((v) => (typeof v === "string" ? v.trim() : String(v || "").trim()))
          .filter(Boolean)
          .forEach((v) => set.add(v));
        return Array.from(set);
      })();

      const ymParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(new Date(nowISO));
      const year = Number(ymParts.find((p) => p.type === "year")?.value);
      const month1 = Number(ymParts.find((p) => p.type === "month")?.value);
      const month0 = Math.max(0, Math.min(11, month1 - 1));
      if (!Number.isFinite(year) || !Number.isFinite(month1)) return null;

      const schedulesLists = await Promise.all(
        companyKeysToTry.map((key) => getFGMonthlySchedulesCached(key, year, month0)),
      );
      const monthSchedules = schedulesLists.flat();
      return resolveManagerFromControlHorario({ nowISO, empresa, monthSchedules });
    },
    [activeEmpresaForCompany, company, getFGMonthlySchedulesCached],
  );

  const resolveShiftTimingForNow = useCallback(
    async (nowISO: string) => {
      const empresa = activeEmpresaForCompany;
      const normalizedCompany = (company || "").trim();
      if (!empresa || !normalizedCompany) return null;

      const companyKeysToTry = (() => {
        const set = new Set<string>();
        set.add(normalizedCompany);
        [empresa?.name, empresa?.ubicacion, empresa?.id]
          .map((v) => (typeof v === "string" ? v.trim() : String(v || "").trim()))
          .filter(Boolean)
          .forEach((v) => set.add(v));
        return Array.from(set);
      })();

      const ymParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(new Date(nowISO));
      const year = Number(ymParts.find((p) => p.type === "year")?.value);
      const month1 = Number(ymParts.find((p) => p.type === "month")?.value);
      const month0 = Math.max(0, Math.min(11, month1 - 1));
      if (!Number.isFinite(year) || !Number.isFinite(month1)) return null;

      const schedulesLists = await Promise.all(
        companyKeysToTry.map((key) => getFGMonthlySchedulesCached(key, year, month0)),
      );
      const monthSchedules = schedulesLists.flat();
      return getControlHorarioShiftTiming({ nowISO, empresa, monthSchedules });
    },
    [activeEmpresaForCompany, company, getFGMonthlySchedulesCached],
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
    if (!user?.id || !companyData?.ownerId) return false;
    return String(user.id) === String(companyData.ownerId);
  }, [user, companyData]);

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
    !manager ||
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
        const nowISO = new Date().toISOString();
        const nowTiming = await resolveShiftTimingForNow(nowISO);
        if (nowTiming?.withinHorario) {
          const normalizeMin = (min: number) => {
            if (!Number.isFinite(min)) return 0;
            const m = Math.trunc(min) % 1440;
            return m < 0 ? m + 1440 : m;
          };

          const nowMin = normalizeMin(nowTiming.currentMin);
          const shiftDEndMin = normalizeMin(nowTiming.shiftChangeMin);
          const shiftNEndMin = normalizeMin(nowTiming.closeMin);
          const getClosingShiftForMinute = (minute: number): ShiftCode | null => {
            const normalizedMinute = normalizeMin(minute);
            const isInWindow = (endMin: number) => {
              const normalizedEnd = normalizeMin(endMin);
              const minutesUntilEnd =
                (normalizedEnd - normalizedMinute + 1440) % 1440;
              const minutesAfterEnd =
                (normalizedMinute - normalizedEnd + 1440) % 1440;
              return (
                minutesUntilEnd <= CIERRE_FONDO_VENTAS_MINUTES_BEFORE_END ||
                minutesAfterEnd <= CIERRE_FONDO_VENTAS_MINUTES_AFTER_END
              );
            };

            if (isInWindow(shiftDEndMin)) return "D";
            if (isInWindow(shiftNEndMin)) return "N";
            return null;
          };
          const closingShift = getClosingShiftForMinute(nowMin);
          const minutesUntilDWindow =
            (normalizeMin(
              shiftDEndMin - CIERRE_FONDO_VENTAS_MINUTES_BEFORE_END,
            ) -
              nowMin +
              1440) %
            1440;
          const minutesUntilNWindow =
            (normalizeMin(
              shiftNEndMin - CIERRE_FONDO_VENTAS_MINUTES_BEFORE_END,
            ) -
              nowMin +
              1440) %
            1440;
          const minutesUntilAllowed = Math.min(
            minutesUntilDWindow,
            minutesUntilNWindow,
          );

          if (!closingShift) {
            showToast(
              `El \"CIERRE FONDO VENTAS\" solo se puede registrar desde ${CIERRE_FONDO_VENTAS_MINUTES_BEFORE_END} minutos antes y hasta ${CIERRE_FONDO_VENTAS_MINUTES_AFTER_END} minutos despues del fin del turno. Faltan ${minutesUntilAllowed} min.`,
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
              const cierresToday = fondoEntries.filter((e) =>
                isCierreFondoVentasMovement(e),
              );
              let hasDCierre = false;
              let hasNCierre = false;
              cierresToday.forEach((e) => {
                const info = getCostaRicaDateKeyAndMinute(String(e.createdAt || ""));
                if (!info) return;
                if (info.dateKey !== nowKey) return;
                const minute = normalizeMin(info.minuteOfDay);
                const existingShift = getClosingShiftForMinute(minute);
                if (existingShift === "D") hasDCierre = true;
                if (existingShift === "N") hasNCierre = true;
              });

              if (closingShift === "D" && hasDCierre) {
                showToast(
                  'Ya existe un "CIERRE FONDO VENTAS" para el turno D de hoy.',
                  "warning",
                  5500,
                );
                return;
              }
              if (closingShift === "N" && hasNCierre) {
                showToast(
                  'Ya existe un "CIERRE FONDO VENTAS" para el turno N de hoy.',
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
        const nowISO = new Date().toISOString();
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
      setPhysicalCountWasDone(false);
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

  const openClosingInvoicePaymentModal = useCallback(
    (invoice: FacturaMovement) => {
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
    [isCajaNegra, pendingCierreDeCaja, showToast],
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
      const invoice = pendingClosingCreditInvoices.find(
        (item) => item.id === invoiceId,
      );
      if (invoice) openClosingInvoicePaymentModal(invoice);
    },
    [openClosingInvoicePaymentModal, pendingClosingCreditInvoices],
  );

  const handleMovementCreditInvoiceSelect = useCallback(
    (invoiceId: string) => {
      const invoice = pendingClosingCreditInvoices.find(
        (item) => item.id === invoiceId,
      );
      if (invoice) {
        openClosingInvoicePaymentModal(invoice);
        setMovementModalOpen(false);
      }
    },
    [openClosingInvoicePaymentModal, pendingClosingCreditInvoices],
  );

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
        Number(closingPaymentTarget.originalAmount ?? closingPaymentTarget.amount) ||
          0,
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
      setClosingPaymentSubmitting,
      setClosingPaymentCreditNoteIds,
      setPendingCierreModalOpen,
      setPendingClosingCreditInvoices,
      setSelectedProviderPendingCreditNotes,
      showToast,
      storageSnapshotRef,
      v2MovementsCacheRef,
      applyLedgerStateFromStorage,
    ],
  );

  const handleCancelPhysicalCount = useCallback(() => {
    setConfirmPhysicalCountOpen(false);
  }, []);

  const closePendingCierreModal = useCallback(() => {
    setPendingCierreModalOpen(false);
  }, []);

  const handleConfirmPhysicalCount = useCallback(() => {
    setConfirmPhysicalCountOpen(false);
    // Marcar como confirmado inmediatamente para no volver a solicitar el conteo
    // aunque el usuario cierre el formulario sin guardar un movimiento.
    if (typeof window !== "undefined" && accountKey === "FondoGeneral") {
      try {
        const key = buildPhysicalCountStorageKey();
        if (key) localStorage.setItem(key, "false");
        cleanupPhysicalCountLegacyKeys();
      } catch {
        // ignore
      }
    }
    openCreateMovementDrawer();
  }, [
    openCreateMovementDrawer,
    accountKey,
    buildPhysicalCountStorageKey,
    cleanupPhysicalCountLegacyKeys,
  ]);

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
      setEntriesHydrated(false);
      setHydratedCompany("");
      setFondoEntries([]);
      storageSnapshotRef.current = null;
      setInitialAmount("0");
      setInitialAmountUSD("0");
      setDailyClosingsHydrated(false);
      setDailyClosings([]);
      setDailyClosingsRefreshing(false);
      dailyClosingsRequestCountRef.current = 0;
      loadedDailyClosingKeysRef.current = new Set();
      loadingDailyClosingKeysRef.current = new Set();
      setCurrencyEnabled({ CRC: true, USD: true });
      setMovementModalOpen(false);
      resetFondoForm();
      setMovementAutoCloseLocked(false);
      setSelectedProvider("");
      // Solo resetear filtros si no está activo keepFiltersAcrossCompanies
      if (!keepFiltersAcrossCompanies) {
        const todayKey = dateKeyFromDate(new Date());
        setFilterProviderCode("all");
        setFilterPaymentType(
          mode === "all"
            ? "all"
            : mode === "ingreso"
              ? FONDO_INGRESO_TYPES[0]
              : FONDO_EGRESO_TYPES[0],
        );
        setFilterEditedOnly(false);
        setSearchQuery("");
        setFromFilter(todayKey);
        setToFilter(todayKey);
        setQuickRange("today");
      }
      setPageIndex(0);
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
        setEntriesHydrated(false);
        setHydratedCompany("");
        setFondoEntries([]);
        storageSnapshotRef.current = null;
        setInitialAmount("0");
        setInitialAmountUSD("0");
        setDailyClosingsHydrated(false);
        setDailyClosings([]);
        setDailyClosingsRefreshing(false);
        dailyClosingsRequestCountRef.current = 0;
        loadedDailyClosingKeysRef.current = new Set();
        loadingDailyClosingKeysRef.current = new Set();
        setCurrencyEnabled({ CRC: true, USD: true });
        setMovementModalOpen(false);
        resetFondoForm();
        setMovementAutoCloseLocked(false);
        setSelectedProvider("");
        // Solo resetear filtros si no está activo keepFiltersAcrossCompanies
        if (!keepFiltersAcrossCompanies) {
          const todayKey = dateKeyFromDate(new Date());
          setFilterProviderCode("all");
          setFilterPaymentType(
            mode === "all"
              ? "all"
              : mode === "ingreso"
                ? FONDO_INGRESO_TYPES[0]
                : FONDO_EGRESO_TYPES[0],
          );
          setFilterEditedOnly(false);
          setSearchQuery("");
          setFromFilter(todayKey);
          setToFilter(todayKey);
          setQuickRange("today");
        }
        setPageIndex(0);
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
      <div className="flex w-full min-w-0 flex-col gap-3 text-sm text-[var(--foreground)] xl:flex-row xl:items-end xl:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] ">
            Empresa actual
          </p>
          <p
            className="truncate text-sm font-semibold text-[var(--foreground)]"
            title={currentCompanyLabel}
          >
            {currentCompanyLabel}
          </p>
          {ownerCompaniesError && (
            <p className="text-xs text-red-500 mt-1">{ownerCompaniesError}</p>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <select
            id={companySelectId}
            value={company}
            onChange={(e) => handleAdminCompanyChange(e.target.value)}
            disabled={
              ownerCompaniesLoading || sortedOwnerCompanies.length === 0
            }
            className="w-full min-w-0 max-w-full truncate rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus:border-[var(--accent)]"
          >
            {ownerCompaniesLoading && (
              <option value="">Cargando empresas...</option>
            )}
            {!ownerCompaniesLoading && sortedOwnerCompanies.length === 0 && (
              <option value="">Sin empresas disponibles</option>
            )}
            {!ownerCompaniesLoading && sortedOwnerCompanies.length > 0 && (
              <>
                <option value="" disabled hidden>
                  Selecciona una empresa
                </option>
                {sortedOwnerCompanies.map((emp, index) => (
                  <option
                    key={
                      emp.id || emp.name || emp.ubicacion || `company-${index}`
                    }
                    value={getCompanyKey(emp)}
                  >
                    {getCompanyLabel(emp)}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>
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

      <section className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {/* Proveedor: busqueda con autocomplete como en el drawer de agregar movimiento */}
          <div className="relative min-w-0">
            <div className="relative">
              {filterProviderCode !== "all" && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setFilterProviderCode("all");
                    setProviderFilter("");
                    setProviderSearchInput("");
                  }}
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-red-400 transition-colors hover:text-red-300"
                  tabIndex={-1}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
              <input
                value={providerSearchInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setProviderSearchInput(value);
                  setIsProviderDropdownOpen(true);
                  if (value.trim() === "") {
                    setFilterProviderCode("all");
                    setProviderFilter("");
                  }
                }}
                onFocus={() => setIsProviderDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsProviderDropdownOpen(false), 200);
                }}
                className={`h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)] ${
                  filterProviderCode !== "all" ? "pl-10 pr-11" : "pr-11"
                }`}
                placeholder={
                  movementProvidersLoading
                    ? "Cargando proveedores..."
                    : "  Buscar proveedor"
                }
              />
              <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-cyan-100/80">
                <Search className="h-4 w-4" />
              </span>
            </div>
            {isProviderDropdownOpen && !movementProvidersLoading && (
              <div className="absolute z-[9999] mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                {providerSearchInput.trim() === "" && (
                  <button
                    type="button"
                    className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                      filterProviderCode === "all"
                        ? "bg-cyan-500/20 text-cyan-50"
                        : "text-cyan-100/70"
                    }`}
                    onMouseDown={() => {
                      setFilterProviderCode("all");
                      setProviderFilter("");
                      setProviderSearchInput("");
                      setIsProviderDropdownOpen(false);
                    }}
                  >
                    Todos los proveedores
                  </button>
                )}
                {filteredProvidersForFilter.length > 0 ? (
                  filteredProvidersForFilter.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                        filterProviderCode === p.code
                          ? "bg-cyan-500/20 text-cyan-50"
                          : "text-[var(--foreground)]"
                      }`}
                      onMouseDown={() => {
                        setFilterProviderCode(p.code);
                        setProviderFilter(`${p.name} (${p.code})`);
                        setProviderSearchInput(`${p.name} (${p.code})`);
                        setIsProviderDropdownOpen(false);
                      }}
                    >
                      {p.name} ({p.code})
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-cyan-100/50">
                    No se encontraron proveedores
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tipo de movimiento: busqueda con autocomplete */}
          <div className="relative min-w-0">
            <div className="relative">
              {filterPaymentType !== "all" && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setFilterPaymentType("all");
                    setTypeFilter("");
                    setTypeSearchInput("");
                  }}
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-red-400 transition-colors hover:text-red-300"
                  tabIndex={-1}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
              <input
                value={typeSearchInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setTypeSearchInput(value);
                  setIsTypeDropdownOpen(true);
                  if (value.trim() === "") {
                    setFilterPaymentType("all");
                    setTypeFilter("");
                  }
                }}
                onFocus={() => setIsTypeDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsTypeDropdownOpen(false), 200);
                }}
                className={`h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)] ${
                  filterPaymentType !== "all" ? "pl-10 pr-11" : "pr-11"
                }`}
                placeholder="  Buscar tipo de movimiento"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-cyan-100/80">
                <Search className="h-4 w-4" />
              </span>
            </div>
            {isTypeDropdownOpen && (
              <div className="absolute z-[9999] mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                {typeSearchInput.trim() === "" && (
                  <button
                    type="button"
                    className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                      filterPaymentType === "all"
                        ? "bg-cyan-500/20 text-cyan-50"
                        : "text-cyan-100/70"
                    }`}
                    onMouseDown={() => {
                      setFilterPaymentType("all");
                      setTypeFilter("");
                      setTypeSearchInput("");
                      setIsTypeDropdownOpen(false);
                    }}
                  >
                    Todos los tipos
                  </button>
                )}
                {(() => {
                  const search = typeSearchInput.toLowerCase().trim();
                  const hasFilter = search !== "";
                  const groups = [
                    { group: "Ingresos", types: FONDO_INGRESO_TYPES },
                    { group: "Gastos", types: FONDO_GASTO_TYPES },
                    { group: "Egresos", types: FONDO_EGRESO_TYPES },
                  ];
                  let hasAnyMatch = false;
                  return groups.map(({ group, types }) => {
                    const filtered = hasFilter
                      ? types.filter(
                          (t) =>
                            formatMovementType(t)
                              .toLowerCase()
                              .includes(search) ||
                            t.toLowerCase().includes(search),
                        )
                      : types;
                    if (filtered.length === 0) return null;
                    hasAnyMatch = true;
                    return (
                      <React.Fragment key={group}>
                        <div className="px-3 py-1.5 text-xs font-semibold text-cyan-100/50 uppercase tracking-wider">
                          {group}
                        </div>
                        {filtered.map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                              filterPaymentType === t
                                ? "bg-cyan-500/20 text-cyan-50"
                                : "text-[var(--foreground)]"
                            }`}
                            onMouseDown={() => {
                              setFilterPaymentType(t);
                              setTypeFilter(formatMovementType(t));
                              setTypeSearchInput(formatMovementType(t));
                              setIsTypeDropdownOpen(false);
                            }}
                          >
                            {formatMovementType(t)}
                          </button>
                        ))}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Buscar factura: mantener input con icono tal como estaba */}
          <div className="relative min-w-0">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar factura, notas..."
              className="h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] py-2 pl-3 pr-11 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--accent)]/60 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1"
              aria-label="Buscar movimientos"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)]">
              <Search className="h-4 w-4" />
            </span>
          </div>

          <div className="flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-700/35 bg-cyan-950/20 px-3 py-2 text-sm text-[var(--foreground)]">
            <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-center">
              {/* Dropdown Vista */}
              <div
                className="relative w-full sm:w-auto"
                ref={filtersDropdownRef}
              >
                <button
                  type="button"
                  onClick={() => setFiltersDropdownOpen((prev) => !prev)}
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--input-border)] bg-transparent px-3 text-xs font-semibold tracking-wide text-[var(--foreground)] transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--muted)]/20 active:scale-[0.98] sm:w-auto"
                  aria-haspopup="menu"
                  aria-expanded={filtersDropdownOpen}
                  title="Mostrar facturas en especifico estado o editados"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  <span>Vista</span>
                </button>
                {filtersDropdownOpen && (
                  <div className="absolute left-1/2 top-full z-[9999] mt-2 w-[260px] -translate-x-1/2 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl">
                    <div className="flex flex-col py-1">
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                        <input
                          type="checkbox"
                          checked={showPendingClosingCreditInvoices}
                          onChange={(event) =>
                            setShowPendingClosingCreditInvoices(
                              event.target.checked,
                            )
                          }
                          className="h-4 w-4 accent-amber-400"
                        />
                        <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                        <span className="leading-tight">
                          Facturas de crédito pendientes
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                        <input
                          type="checkbox"
                          checked={filterEditedOnly}
                          onChange={(e) =>
                            setFilterEditedOnly(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-[var(--input-border)] accent-[var(--accent)]"
                        />
                        <Pencil className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                        <span>Editados</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón limpiar */}
              <button
                type="button"
                onClick={() => {
                  setFilterProviderCode("all");
                  setFilterPaymentType("all");
                  setFilterEditedOnly(false);
                  setSearchQuery("");
                  setFromFilter(null);
                  setToFilter(null);
                  setQuickRange(null);
                  setCalendarFromOpen(false);
                  setCalendarToOpen(false);
                  const m = new Date();
                  m.setDate(1);
                  m.setHours(0, 0, 0, 0);
                  setCalendarFromMonth(new Date(m));
                  setCalendarToMonth(new Date(m));
                  setPageSize("daily");
                  setPageIndex(0);
                }}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--input-border)] bg-transparent px-3 text-xs font-semibold tracking-wide text-[var(--foreground)] transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--muted)]/20 active:scale-[0.98] sm:w-auto"
                title="Limpiar filtros"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Limpiar</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-[var(--input-border)] pt-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-[minmax(150px,180px)_minmax(150px,180px)_minmax(150px,170px)_44px] xl:items-end">
            <div className="relative min-w-0">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Desde
              </label>
              <button
                type="button"
                ref={fromButtonRef}
                onClick={() => setCalendarFromOpen((prev) => !prev)}
                className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] [&_[aria-disabled='true']]:opacity-25"
                title="Seleccionar fecha desde"
                aria-label="Seleccionar fecha desde"
              >
                <span className="truncate text-sm font-medium">
                  {fromFilter ? formatKeyToDisplay(fromFilter) : "dd/mm/yyyy"}
                </span>
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                  <CalendarDays className="h-4 w-4" />
                </span>
              </button>

              {calendarFromOpen && (
                <div
                  ref={fromCalendarRef}
                  className="absolute left-0 top-full mt-1 sm:mt-2 z-50 w-full min-w-[280px] sm:w-72"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 sm:p-3 text-[var(--foreground)] shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          const m = new Date(calendarFromMonth);
                          m.setMonth(m.getMonth() - 1);
                          setCalendarFromMonth(new Date(m));
                        }}
                        className="p-1 rounded hover:bg-[var(--muted)]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="text-sm font-semibold capitalize">
                        {calendarFromMonth.toLocaleString("es-CR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const m = new Date(calendarFromMonth);
                          m.setMonth(m.getMonth() + 1);
                          setCalendarFromMonth(new Date(m));
                        }}
                        className="p-1 rounded hover:bg-[var(--muted)]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted-foreground)]">
                      {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                        <div key={`${d}-${i}`} className="py-1">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                      {(() => {
                        const cells: React.ReactNode[] = [];
                        const year = calendarFromMonth.getFullYear();
                        const month = calendarFromMonth.getMonth();
                        const first = new Date(year, month, 1);
                        const start = first.getDay();
                        const daysInMonth = new Date(
                          year,
                          month + 1,
                          0,
                        ).getDate();

                        for (let i = 0; i < start; i++)
                          cells.push(<div key={`pad-f-${i}`} />);

                        for (let day = 1; day <= daysInMonth; day++) {
                          const d = new Date(year, month, day);
                          const key = dateKeyFromDate(d);
                          const enabled = key <= todayKey;
                          const isSelected = fromFilter === key;
                          if (enabled) {
                            cells.push(
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setQuickRange(null);
                                  setFromFilter(key);
                                  setCalendarFromOpen(false);
                                  setPageSize("all");
                                  setPageIndex(0);
                                }}
                                className={`py-1 rounded ${
                                  isSelected
                                    ? "bg-[var(--accent)] text-white"
                                    : "hover:bg-[var(--muted)]"
                                }`}
                              >
                                {day}
                              </button>,
                            );
                          } else {
                            cells.push(
                              <div
                                key={key}
                                className="py-1 text-[var(--muted-foreground)] opacity-60"
                              >
                                {day}
                              </div>,
                            );
                          }
                        }
                        return cells;
                      })()}
                    </div>

                    <div className="mt-3 flex justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          const todayKey = dateKeyFromDate(new Date());
                          setQuickRange(null);
                          setFromFilter(todayKey);
                          setCalendarFromOpen(false);
                        }}
                        className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      >
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarFromOpen(false)}
                        className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative min-w-0">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Hasta
              </label>
              <button
                type="button"
                ref={toButtonRef}
                onClick={() => setCalendarToOpen((prev) => !prev)}
                className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                title="Seleccionar fecha hasta"
                aria-label="Seleccionar fecha hasta"
              >
                <span className="truncate text-sm font-medium">
                  {toFilter ? formatKeyToDisplay(toFilter) : "dd/mm/yyyy"}
                </span>
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                  <CalendarDays className="h-4 w-4" />
                </span>
              </button>

              {calendarToOpen && (
                <div
                  ref={toCalendarRef}
                  className="absolute left-0 top-full mt-2 z-50 w-full sm:w-64"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          const m = new Date(calendarToMonth);
                          m.setMonth(m.getMonth() - 1);
                          setCalendarToMonth(new Date(m));
                        }}
                        className="p-1 rounded hover:bg-[var(--muted)]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="text-sm font-semibold capitalize">
                        {calendarToMonth.toLocaleString("es-CR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const m = new Date(calendarToMonth);
                          m.setMonth(m.getMonth() + 1);
                          setCalendarToMonth(new Date(m));
                        }}
                        className="p-1 rounded hover:bg-[var(--muted)]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted-foreground)]">
                      {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                        <div key={`${d}-${i}`} className="py-1">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                      {(() => {
                        const cells: React.ReactNode[] = [];
                        const year = calendarToMonth.getFullYear();
                        const month = calendarToMonth.getMonth();
                        const first = new Date(year, month, 1);
                        const start = first.getDay();
                        const daysInMonth = new Date(
                          year,
                          month + 1,
                          0,
                        ).getDate();

                        for (let i = 0; i < start; i++)
                          cells.push(<div key={`pad-t-${i}`} />);

                        for (let day = 1; day <= daysInMonth; day++) {
                          const d = new Date(year, month, day);
                          const key = dateKeyFromDate(d);
                          const enabled = key <= todayKey;
                          const isSelected = toFilter === key;
                          if (enabled) {
                            cells.push(
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setQuickRange(null);
                                  setToFilter(key);
                                  setCalendarToOpen(false);
                                  setPageSize("all");
                                  setPageIndex(0);
                                }}
                                className={`py-1 rounded ${
                                  isSelected
                                    ? "bg-[var(--accent)] text-white"
                                    : "hover:bg-[var(--muted)]"
                                }`}
                              >
                                {day}
                              </button>,
                            );
                          } else {
                            cells.push(
                              <div
                                key={key}
                                className="py-1 text-[var(--muted-foreground)] opacity-60"
                              >
                                {day}
                              </div>,
                            );
                          }
                        }
                        return cells;
                      })()}
                    </div>

                    <div className="mt-3 flex justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          const todayKey = dateKeyFromDate(new Date());
                          setQuickRange(null);
                          setToFilter(todayKey);
                          setCalendarToOpen(false);
                        }}
                        className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      >
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarToOpen(false)}
                        className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Filtro
              </label>
              <select
                className="h-11 w-full min-w-0 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm font-medium text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1"
                value={quickRange || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuickRange(v || null);
                  const now = new Date();
                  let from: Date | null = null;
                  let to: Date | null = null;
                  if (v === "today") {
                    const t = new Date(now);
                    from = to = t;
                  } else if (v === "yesterday") {
                    const y = new Date(now);
                    y.setDate(now.getDate() - 1);
                    from = to = y;
                  } else if (v === "thisweek") {
                    const day = now.getDay();
                    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes como inicio
                    from = new Date(now.setDate(diff));
                    to = new Date();
                  } else if (v === "lastweek") {
                    const day = now.getDay();
                    const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
                    from = new Date(now.getFullYear(), now.getMonth(), diff);
                    to = new Date(now.getFullYear(), now.getMonth(), diff + 6);
                  } else if (v === "lastmonth") {
                    const first = new Date(
                      now.getFullYear(),
                      now.getMonth() - 1,
                      1,
                    );
                    const last = new Date(now.getFullYear(), now.getMonth(), 0);
                    from = first;
                    to = last;
                  } else if (v === "month") {
                    const first = new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      1,
                    );
                    const last = new Date(
                      now.getFullYear(),
                      now.getMonth() + 1,
                      0,
                    );
                    from = first;
                    to = last;
                  } else if (v === "last30") {
                    const last = new Date();
                    const first = new Date();
                    first.setDate(last.getDate() - 29);
                    from = first;
                    to = last;
                  }
                  if (from && to) {
                    setFromFilter(dateKeyFromDate(from));
                    setToFilter(dateKeyFromDate(to));
                    setPageSize("all");
                    setPageIndex(0);
                  }
                }}
              >
                <option value="">Filtro de fecha</option>
                <option value="today">Hoy</option>
                <option value="yesterday">Ayer</option>
                <option value="thisweek">Esta semana</option>
                <option value="lastweek">Semana anterior</option>
                <option value="lastmonth">Mes anterior</option>
                <option value="last30">Últimos 30 días</option>
                <option value="month">Mes actual</option>
              </select>
            </div>
            {accountKey === "FondoGeneral" && (
              <div className="relative group flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setDailyClosingHistoryRange("today");
                    setDailyClosingHistoryOpen(true);
                  }}
                  disabled={closingsAreLoading}
                  className="inline-flex h-11 w-full items-center justify-center rounded border border-cyan-700/35 bg-cyan-950/25 text-cyan-100/80 transition-colors hover:border-cyan-500/45 hover:bg-cyan-900/25 hover:text-[var(--foreground)] disabled:opacity-60 sm:w-11"
                  title="Cierres anteriores"
                  aria-label="Cierres anteriores"
                >
                  <Clock className="h-4 w-4" />
                </button>
                <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--card-bg)] border border-[var(--input-border)] text-[var(--foreground)] text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  Cierres anteriores
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--input-border)]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[348px]">
            {accountKey === "FondoGeneral" && (
              <div className="relative group min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenDailyClosing}
                    disabled={!pendingCierreDeCaja}
                    className={`flex h-11 flex-1 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold shadow-sm transition-all duration-150 ${
                      !pendingCierreDeCaja
                        ? "cursor-not-allowed border-[var(--input-border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)] opacity-70"
                        : "border-yellow-600/40 bg-yellow-500/10 text-yellow-400/80 hover:-translate-y-0.5 hover:border-yellow-500/60 hover:bg-yellow-500/20 hover:shadow-md hover:shadow-yellow-950/20 active:translate-y-0 active:scale-[0.99]"
                    }`}
                  >
                    <Banknote className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Registrar cierre</span>
                  </button>
                </div>
                {!pendingCierreDeCaja && (
                  <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-yellow-500 text-black text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    ?? Debe agregar un movimiento de &quot;CIERRE FONDO
                    VENTAS&quot; primero
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500"></div>
                  </div>
                )}
              </div>
            )}
            <div className="relative group min-w-0">
              <button
                type="button"
                onClick={handleOpenCreateMovement}
                disabled={
                  (accountKey === "FondoGeneral" && pendingCierreDeCaja) ||
                  !entriesHydrated
                }
                className={`flex h-11 w-full items-center justify-center gap-2 rounded border px-3 text-sm font-semibold shadow-sm transition-all duration-150 ${
                  (accountKey === "FondoGeneral" && pendingCierreDeCaja) ||
                  !entriesHydrated
                    ? "cursor-not-allowed border-[var(--input-border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)] opacity-70"
                    : "border-cyan-500/50 bg-transparent text-cyan-300 hover:-translate-y-0.5 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-md hover:shadow-cyan-950/25 active:translate-y-0 active:scale-[0.99]"
                }`}
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Agregar movimiento</span>
              </button>
              {accountKey === "FondoGeneral" &&
                pendingCierreDeCaja &&
                entriesHydrated && (
                  <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-yellow-500 text-black text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    Debe realizar el &quot;Registrar cierre&quot; para seguir
                    agregando movimientos
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500"></div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </section>

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

      <Drawer
        anchor="right"
        open={movementModalOpen}
        onClose={closeMovementModal}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 520 },
            maxWidth: "100vw",
            bgcolor: "#0d1117",
            color: "#ffffff",
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 3,
              py: 2,
              position: "relative",
            }}
          >
            <Typography
              variant="h6"
              component="h3"
              sx={{ fontWeight: 600, textAlign: "center", width: "100%" }}
            >
              {editingEntry
                ? `Editar movimiento #${editingEntry.invoiceNumber}`
                : "Registrar movimiento"}
            </Typography>
            <Box
              sx={{
                position: "absolute",
                right: 12,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <IconButton
                aria-label={
                  movementAutoCloseLocked
                    ? "Desbloquear cierre automatico"
                    : "Bloquear cierre automatico"
                }
                onClick={() => setMovementAutoCloseLocked((prev) => !prev)}
                sx={{ color: "var(--foreground)" }}
              >
                {movementAutoCloseLocked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <LockOpen className="w-4 h-4" />
                )}
              </IconButton>
              <IconButton
                aria-label="Cerrar registro de movimiento"
                onClick={closeMovementModal}
                sx={{ color: "var(--foreground)" }}
              >
                <X className="w-4 h-4" />
              </IconButton>
            </Box>
          </Box>
          <Divider sx={{ borderColor: "var(--input-border)" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
            {editingEntry && (
              <Typography
                variant="caption"
                component="p"
                sx={{ color: "var(--muted-foreground)", mb: 2 }}
              >
                Editando movimiento #{editingEntry.invoiceNumber}. Actualiza los
                datos y presiona &quot;Actualizar&quot; o cancela para volver al
                modo de registro.
              </Typography>
            )}
            {/* Incluir borrador de NC manual en la lista de NC pendientes */}
            {(() => {
              const movementPendingCreditNotes =
                invoiceDocType === "FCO"
                  ? manualCreditNoteDraft
                    ? [
                        {
                          id: "manual-nc-draft",
                          invoiceNumber: manualCreditNoteDraft.invoiceNumber,
                          amount: manualCreditNoteDraft.amount,
                          balanceDue: manualCreditNoteDraft.amount,
                          currency: movementCurrency as "CRC" | "USD",
                        },
                        ...selectedProviderPendingCreditNotes,
                      ]
                    : selectedProviderPendingCreditNotes
                  : [];

              const selectedProviderType = selectedProvider ? (providerTypesMap.get(selectedProvider) ?? "") : "";
              const isCompraInventarioProvider = selectedProviderType.trim().toUpperCase() === "COMPRA INVENTARIO";

              return (
                <AgregarMovimiento
                  selectedProvider={selectedProvider}
                  onProviderChange={handleProviderChange}
                  providers={movementProviders}
                  providersLoading={movementProvidersLoading}
                  isProviderSelectDisabled={
                    isProviderSelectDisabled || isEditingCierreFondoVentas
                  }
                  providerDisabledTooltip={
                    isEditingCierreFondoVentas
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
                  invoiceDisabled={invoiceDisabled}
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
                  showManager2={isEditingPaidFcrMovement}
                  managerSelectDisabled={
                    managerSelectDisabled || isEditingPaidFcrMovement
                  }
                  manager2SelectDisabled={
                    !company ||
                    managerOptionsLoading ||
                    employeeOptions.length === 0
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
                  currencyEnabled={currencyEnabled}
                  providerError={providerError}
                  invoiceError={invoiceError}
                  amountError={amountError}
                  managerError={managerError}
                  manager2Error={manager2Error}
                  pendingCreditNotesCount={selectedProviderPendingNcCount}
                  pendingCreditInvoicesCount={
                    selectedProviderPendingPaymentAlert?.count ?? 0
                  }
                  pendingCreditInvoicesBalanceLabel={
                    selectedProviderPendingPaymentAlert
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
                  pendingCreditInvoices={selectedProviderPendingCreditInvoices}
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
              );
            })()}
          </Box>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={manualCreditNoteOpen}
        onClose={closeManualCreditNoteModal}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 460 },
            maxWidth: "100vw",
            bgcolor: "#0d1117",
            color: "#ffffff",
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 3,
              py: 2,
            }}
          >
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
              Agregar nota de Crédito
            </Typography>
            <IconButton
              aria-label="Cerrar"
              onClick={closeManualCreditNoteModal}
              sx={{ color: "var(--foreground)" }}
              disabled={manualCreditNoteSaving}
            >
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: "var(--input-border)" }} />

          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
            {manualCreditNoteError && (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {manualCreditNoteError}
              </div>
            )}

            {manualCreditNoteTarget && (
              <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-sm text-[var(--foreground)]">
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-[var(--muted-foreground)]">
                      Proveedor:
                    </span>{" "}
                    <span className="font-medium">
                      {providersMap.get(manualCreditNoteTarget.providerCode) ||
                        manualCreditNoteTarget.providerCode}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">
                      Encargado:
                    </span>{" "}
                    <span className="font-medium">
                      {manualCreditNoteTarget.manager || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">
                      Factura origen:
                    </span>{" "}
                    <span className="font-medium">
                      #{manualCreditNoteTarget.invoiceNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">
                      Moneda:
                    </span>{" "}
                    <span className="font-medium">
                      {manualCreditNoteTarget.currency || "CRC"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[var(--muted-foreground)]">
                      Saldo disponible:
                    </span>{" "}
                    <span className="font-semibold text-sky-100">
                      {formatByCurrency(
                        (manualCreditNoteTarget.currency as "CRC" | "USD") ||
                          "CRC",
                        Math.max(
                          0,
                          Math.trunc(
                            Number(
                              manualCreditNoteTarget.amountEgreso ||
                                manualCreditNoteTarget.amountIngreso ||
                                0,
                            ) || 0,
                          ),
                        ),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveManualCreditNote();
              }}
            >
              <input
                value={manualCreditNoteInvoiceNumber}
                onChange={(event) =>
                  setManualCreditNoteInvoiceNumber(
                    event.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                placeholder="Numero de factura de la NC"
                disabled={manualCreditNoteSaving}
                maxLength={4}
                inputMode="numeric"
                className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              />

              <input
                type="text"
                inputMode="numeric"
                value={manualCreditNoteAmount}
                onChange={(event) =>
                  setManualCreditNoteAmount(
                    event.target.value.replace(/\D/g, ""),
                  )
                }
                placeholder="Monto"
                disabled={manualCreditNoteSaving}
                className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              />

              <textarea
                value={manualCreditNoteObservation}
                onChange={(event) =>
                  setManualCreditNoteObservation(event.target.value)
                }
                placeholder="Observacion"
                disabled={manualCreditNoteSaving}
                rows={4}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeManualCreditNoteModal}
                  disabled={manualCreditNoteSaving}
                  className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/25 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={manualCreditNoteSaving}
                  className="rounded bg-sky-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
                >
                  {manualCreditNoteSaving ? "Guardando..." : "Guardar NC"}
                </button>
              </div>
            </form>
          </Box>
        </Box>
      </Drawer>

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
                    {showPendingClosingCreditInvoices &&
                      pendingClosingCreditInvoices.length > 0 && (
                        <tbody>
                          <tr className="bg-amber-500/10 [&>td]:border-b [&>td]:border-cyan-900/35">
                            <td
                              colSpan={7}
                              className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100"
                            >
                               Facturas crédito pendientes
                            </td>
                          </tr>
                          {pendingClosingCreditInvoices.map((invoice) => {
                            const providerName =
                              providersMap.get(invoice.providerCode) ??
                              invoice.providerCode;
                            const totalAmount = Math.max(
                              0,
                              Math.trunc(
                                Number(
                                  invoice.originalAmount ?? invoice.amount,
                                ) || 0,
                              ),
                            );
                            const paidAmount = Math.max(
                              0,
                              Math.trunc(Number(invoice.paidAmount) || 0),
                            );
                            const balanceAmount = Math.max(
                              0,
                              Math.trunc(
                                Number(
                                  invoice.balanceDue ??
                                    totalAmount - paidAmount,
                                ) || 0,
                              ),
                            );
                            const recordedAt = new Date(invoice.createdAt);
                            const formattedInvoiceDate = Number.isNaN(
                              recordedAt.getTime(),
                            )
                              ? "Sin fecha"
                              : dateTimeFormatter.format(recordedAt);

                            return (
                              <tr
                                key={invoice.id}
                                className="transition-colors hover:bg-amber-500/10 [&>td]:border-b [&>td]:border-cyan-900/35 bg-amber-500/5"
                              >
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  {formattedInvoiceDate}
                                </td>
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  <div className="font-semibold text-[var(--foreground)]">
                                    {providerName}
                                  </div>
                                  <div className="text-xs text-amber-100/80">
                                    {invoice.providerCode}
                                  </div>
                                  {invoice.notes && (
                                    <div className="mt-1 flex w-full items-start gap-2 rounded border border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1.5">
                                      <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                                      <span className="text-xs text-[var(--muted-foreground)] break-words">{invoice.notes}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex max-w-full items-center rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100">
                                      FCR
                                    </span>
                                    <span className="text-xs text-amber-100/80">
                                      {String(
                                        invoice.paymentStatus || "PENDIENTE",
                                      )}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  <span className="font-medium text-[var(--foreground)]">
                                    #{invoice.invoiceNumber}
                                  </span>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <div className="flex flex-col gap-1 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="rounded px-2 py-1 text-xs font-semibold bg-amber-500/10 text-yellow-300">
                                        {formatByCurrency(
                                          invoice.currency,
                                          totalAmount,
                                        )}
                                      </span>
                                    </div>
                                    {balanceAmount > 0 ? (
                                      <span className="inline-flex items-center justify-end gap-1 rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100">
                                        <Banknote className="h-3.5 w-3.5" />
                                        Saldo:{" "}
                                        {formatByCurrency(
                                          invoice.currency,
                                          balanceAmount,
                                        )}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-end gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Saldado
                                      </span>
                                    )}
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                      Pagado:{" "}
                                      {formatByCurrency(
                                        invoice.currency,
                                        paidAmount,
                                      )}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  <div className="text-[var(--foreground)]">
                                    {invoice.manager || "-"}
                                  </div>
                                  {invoice.manager2 && (
                                    <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                                      Extra: {invoice.manager2}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openClosingInvoicePaymentModal(invoice);
                                    }}
                                    title="Gestionar esta factura desde Facturas de crédito y notas de crédito"
                                    className="inline-flex items-center gap-1.5 rounded border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-500/20"
                                  >
                                    <FileText className="w-4 h-4" />
                                    Gestionar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      )}
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
                                    {fe.notes && (
                                      <div className="mt-1 flex w-full items-start gap-2 rounded border border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1.5">
                                        <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                                        <div className="text-xs text-[var(--muted-foreground)] break-words min-w-0 [&>div]:w-full">
                                          {(() => {
                                            if (
                                              fe.notes.includes("[ALERT_ICON]")
                                            ) {
                                              const parts = fe.notes.split("\n");
                                              const headerText =
                                                parts.find(
                                                  (p) =>
                                                    !p.includes("[ALERT_ICON]"),
                                                ) || "";
                                              const alertLine =
                                                parts.find((p) =>
                                                  p.includes("[ALERT_ICON]"),
                                                ) || "";
                                              const noteText = alertLine.replace(
                                                "[ALERT_ICON]",
                                                "",
                                              );
                                              return (
                                                <div className="flex flex-col gap-1">
                                                  {headerText && (
                                                    <div className="text-[10px] font-semibold text-[var(--foreground)] uppercase tracking-wide">
                                                      {headerText}
                                                    </div>
                                                  )}
                                                  <div className="flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                                                    {(() => {
                                                      const isPositive = /:\s*\+/.test(noteText);
                                                      const isNegative = /:\s*\-/.test(noteText);
                                                      if (isPositive || isNegative) {
                                                        const bgClass = isPositive
                                                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                          : "border-red-500/30 bg-red-500/10 text-red-300";
                                                        return (
                                                          <span className={`rounded border ${bgClass} px-1.5 py-0.5 text-[11px] font-semibold`}>
                                                            {noteText}
                                                          </span>
                                                        );
                                                      }
                                                      return <span>{noteText}</span>;
                                                    })()}
                                                  </div>
                                                </div>
                                              );
                                            }
                                            if (
                                              fe.notes.startsWith("[CHECK_ICON]")
                                            ) {
                                              const noteText = fe.notes.replace(
                                                "[CHECK_ICON]",
                                                "",
                                              );
                                              return (
                                                <div className="flex items-center gap-1.5">
                                                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                                  <span>{noteText}</span>
                                                </div>
                                              );
                                            }
                                            return <span>{fe.notes}</span>;
                                          })()}
                                        </div>
                                      </div>
                                    )}
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
                                    {isAutoAdjustment ? (
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
                                                  0 && (
                                                  <div className="flex w-full items-center gap-0 rounded border border-orange-500/15 bg-orange-500/10 px-2 py-1">
                                                    <span className="flex items-center justify-center gap-1 text-xs text-orange-200">
                                                      <RotateCcw className="h-3 w-3 shrink-0" />
                                                      Ajuste
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
                                  <td className="px-3 py-2 align-top">
                                    {(!isLockedMovement || isPaidFcrEntry) && (
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const isCierreVentasRow =
                                            isCierreFondoVentasMovement(fe);
                                          const isLatestCierreVentas =
                                            isCierreVentasRow &&
                                            Boolean(
                                              latestCierreFondoVentasMovementId,
                                            ) &&
                                            fe.id ===
                                              latestCierreFondoVentasMovementId;
                                          const canDelete =
                                            !isLockedMovement &&
                                            !isAutoAdjustment &&
                                            (isPrincipalAdmin ||
                                              (isSuperAdminUser &&
                                                isCierreVentasRow)) &&
                                            (!isCierreVentasRow ||
                                              isLatestCierreVentas);
                                          const canEdit =
                                            !isLockedMovement &&
                                            !isAutoAdjustment &&
                                            (!isSuperAdminUser ||
                                              !isCierreVentasRow);

                                          return (
                                            <>
                                              {canEdit && (
                                                <>
                                                  <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1.5 rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--muted)] disabled:translate-y-0 disabled:opacity-50"
                                                    onClick={() =>
                                                      handleEditMovement(fe)
                                                    }
                                                    disabled={
                                                      editingEntryId === fe.id
                                                    }
                                                    title={
                                                      isAutoAdjustment
                                                        ? "Los ajustes automáticos no se pueden editar"
                                                        : "Editar movimiento"
                                                    }
                                                  >
                                                    <Pencil className="w-4 h-4" />
                                                    {editingEntryId === fe.id
                                                      ? "Editando"
                                                      : "Editar"}
                                                  </button>
                                                </>
                                              )}

                                              {canDelete && (
                                                <button
                                                  type="button"
                                                  className="inline-flex items-center gap-1.5 rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-all duration-150 hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-500/20"
                                                  onClick={() =>
                                                    handleDeleteMovement(fe)
                                                  }
                                                  title={
                                                    isCierreVentasRow &&
                                                    isSuperAdminUser
                                                      ? 'Eliminar "CIERRE FONDO VENTAS" (superadmin)'
                                                      : isCierreVentasRow
                                                         ? "Eliminar último cierre de Fondo Ventas"
                                                        : "Eliminar movimiento"
                                                  }
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                  Eliminar
                                                </button>
                                              )}
                                              {isPaidFcrEntry && (
                                                <button
                                                  type="button"
                                                  className="inline-flex items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-400 transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/20"
                                                  onClick={() => {
                                                    setExpandedFcrInfoRows(
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
                                                  title="Ver información de pago FCR"
                                                  aria-label="Ver información de pago FCR"
                                                  aria-expanded={
                                                    isFcrInfoExpanded
                                                  }
                                                >
                                                  <Info className="w-4 h-4" />
                                                </button>
                                              )}
                                              {hasAppliedCreditNotes &&
                                                !isPaidFcrEntry && (
                                                <button
                                                  type="button"
                                                  className={`inline-flex items-center justify-center rounded border border-sky-500/40 p-1.5 text-sky-300 transition-all duration-150 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-500/20 ${
                                                    isAppliedCreditNotesExpanded
                                                      ? "bg-sky-500/20"
                                                      : "bg-sky-500/10"
                                                  }`}
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
                                                   title="Ver notas de crédito aplicadas"
                                                   aria-label="Ver notas de crédito aplicadas"
                                                  aria-expanded={
                                                    isAppliedCreditNotesExpanded
                                                  }
                                                >
                                                  <Info className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </td>
                                </tr>

                                {hasAppliedCreditNotes &&
                                  isAppliedCreditNotesExpanded &&
                                  !isPaidFcrEntry && (
                                    <tr className="bg-sky-500/5 [&>td]:border-b [&>td]:border-cyan-900/35">
                                      <td colSpan={7} className="px-3 py-2">
                                        <div className="rounded-lg border border-sky-500/25 border-l-2 border-l-sky-400/60 bg-sky-500/10 p-3 text-xs text-[var(--foreground)]">
                                          <div className="mb-2 flex items-center gap-2 border-b border-sky-500/20 pb-2">
                                            <Info className="w-4 h-4 text-sky-300" />
                                            <span className="font-medium">
                                               Notas de crédito aplicadas
                                            </span>
                                          </div>
                                          <div className="divide-y divide-sky-500/15">
                                            {fe.appliedCreditNotes?.map(
                                              (note) => {
                                                const noteAmount = Math.max(
                                                  0,
                                                  Math.trunc(
                                                    Number(note.amount) || 0,
                                                  ),
                                                );
                                                const appliedAmount = Math.max(
                                                  0,
                                                  Math.trunc(
                                                    Number(
                                                      note.appliedAmount,
                                                    ) || 0,
                                                  ),
                                                );
                                                const noteLabel =
                                                  note.invoiceNumber
                                                    ? `NC #${note.invoiceNumber}`
                                                    : `NC ${note.id}`;

                                                return (
                                                  <div
                                                    key={note.id}
                                                    className="py-2"
                                                  >
                                                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                                      <div>
                                                        <div className="font-semibold text-[var(--foreground)]">
                                                          {noteLabel}
                                                        </div>
                                                        <div className="text-xs text-[var(--muted-foreground)]">
                                                          Moneda:{" "}
                                                          {note.currency}
                                                        </div>
                                                      </div>
                                                      <div className="text-right">
                                                        <div className="text-[var(--muted-foreground)]">
                                                          Monto NC:{" "}
                                                          <span className="font-medium text-[var(--foreground)]">
                                                            {formatByCurrency(
                                                              note.currency,
                                                              noteAmount,
                                                            )}
                                                          </span>
                                                        </div>
                                                        <div className="flex items-center justify-end gap-1.5">
                                                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                          <span className="text-[var(--muted-foreground)]">
                                                            Aplicado:
                                                          </span>
                                                          <span className="font-medium text-emerald-400">
                                                            {formatByCurrency(
                                                              note.currency,
                                                              appliedAmount,
                                                            )}
                                                          </span>
                                                        </div>
                                                        {note.observation && (
                                                          <div className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
                                                            Obs:{" "}
                                                            {note.observation}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>
                                          <div className="mt-2 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-2 text-right">
                                            <span className="font-semibold text-[var(--foreground)]">
                                              Total aplicado:{" "}
                                            </span>
                                            <span className="text-base font-semibold text-emerald-400">
                                              {formatByCurrency(
                                                entryCurrency,
                                                appliedCreditNotesTotal,
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}

                                {isPaidFcrEntry && isFcrInfoExpanded && (
                                  <tr className="bg-emerald-500/5 [&>td]:border-b [&>td]:border-cyan-900/35">
                                    <td colSpan={7} className="px-3 py-2">
                                      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-[var(--foreground)]">
                                        <div className="mb-2 flex items-center gap-2 text-emerald-300">
                                          <Info className="w-4 h-4" />
                                          <span className="font-semibold">
                                            Detalle de Factura Credito pagada
                                          </span>
                                        </div>
                                        <div className="grid gap-1.5 sm:grid-cols-2">
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Encargado de pago:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {primaryManager || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Fecha de pago:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {formattedDate}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Registró factura:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {fe.manager || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Fecha registro factura:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {formattedOriginalRegisteredAt}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Monto factura original:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {originalFcrAmount === null
                                                ? "-"
                                                : formatByCurrency(
                                                    entryCurrency,
                                                    originalFcrAmount,
                                                  )}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Monto adeudado:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {owedFcrAmount === null
                                                ? "-"
                                                : formatByCurrency(
                                                    entryCurrency,
                                                    owedFcrAmount,
                                                  )}
                                            </span>
                                          </div>
                                        </div>
                                        {hasAppliedCreditNotes && (
                                          <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                                            <div className="mb-2 flex items-center gap-2 border-b border-emerald-500/15 pb-2 text-emerald-200">
                                              <Info className="w-4 h-4" />
                                              <span className="font-semibold">
                                                Notas de credito aplicadas
                                              </span>
                                            </div>
                                            <div className="divide-y divide-emerald-500/10">
                                              {fe.appliedCreditNotes?.map(
                                                (note) => {
                                                  const noteAmount = Math.max(
                                                    0,
                                                    Math.trunc(
                                                      Number(note.amount) ||
                                                        0,
                                                    ),
                                                  );
                                                  const appliedAmount = Math.max(
                                                    0,
                                                    Math.trunc(
                                                      Number(
                                                        note.appliedAmount,
                                                      ) || 0,
                                                    ),
                                                  );
                                                  const noteLabel =
                                                    note.invoiceNumber
                                                      ? `NC #${note.invoiceNumber}`
                                                      : `NC ${note.id}`;

                                                  return (
                                                    <div
                                                      key={note.id}
                                                      className="py-2"
                                                    >
                                                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                                        <div>
                                                          <div className="font-semibold text-[var(--foreground)]">
                                                            {noteLabel}
                                                          </div>
                                                          <div className="text-xs text-[var(--muted-foreground)]">
                                                            Moneda: {note.currency}
                                                          </div>
                                                        </div>
                                                        <div className="text-right">
                                                          <div className="text-[var(--muted-foreground)]">
                                                            Monto NC:{" "}
                                                            <span className="font-medium text-[var(--foreground)]">
                                                              {formatByCurrency(
                                                                note.currency,
                                                                noteAmount,
                                                              )}
                                                            </span>
                                                          </div>
                                                          <div className="flex items-center justify-end gap-1.5">
                                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span className="text-[var(--muted-foreground)]">
                                                              Aplicado:
                                                            </span>
                                                            <span className="font-medium text-emerald-400">
                                                              {formatByCurrency(
                                                                note.currency,
                                                                appliedAmount,
                                                              )}
                                                            </span>
                                                          </div>
                                                          {note.observation && (
                                                            <div className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
                                                              Obs: {note.observation}
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                },
                                              )}
                                            </div>
                                            <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-right">
                                              <span className="font-semibold text-[var(--foreground)]">
                                                Total aplicado:{" "}
                                              </span>
                                              <span className="text-base font-semibold text-emerald-300">
                                                {formatByCurrency(
                                                  entryCurrency,
                                                  appliedCreditNotesTotal,
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
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
              <div className="mt-4">
                <div className="flex justify-center">
                  <div className="w-full max-w-2xl">
                    <div className="px-4 py-3 rounded min-w-[220px] fg-balance-card">
                      {isSuperAdminUser ? (
                        <button
                          type="button"
                          onClick={() => setSuperAdminTotalsOpen((p) => !p)}
                          className="w-full flex items-center justify-between gap-3"
                          aria-expanded={superAdminTotalsOpen}
                        >
                          <div className="text-center font-semibold text-sm text-[var(--muted-foreground)] flex-1">
                            Total del día
                          </div>
                          {superAdminTotalsOpen ? (
                            <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
                          )}
                        </button>
                      ) : (
                        <div className="mb-2 text-center font-semibold text-sm text-[var(--muted-foreground)]">
                          Total del día
                        </div>
                      )}

                      {(!isSuperAdminUser || superAdminTotalsOpen) && (
                        <div className={isSuperAdminUser ? "mt-3" : ""}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(["CRC", "USD"] as ("CRC" | "USD")[]).map(
                              (currency) => {
                                const ingreso =
                                  totalsByCurrency[currency].ingreso;
                                const egreso =
                                  totalsByCurrency[currency].egreso;
                                const neto = ingreso - egreso;
                                return (
                                  <div
                                    key={currency}
                                    className="rounded border border-[var(--input-border)] bg-[var(--card-bg)] p-3"
                                  >
                                    <div className="text-xs uppercase tracking-wide">
                                      {currency === "CRC"
                                        ? "Colones"
                                        : "Dólares"}
                                    </div>
                                    <div className="mt-2 text-[var(--foreground)]">
                                      <div className="flex items-center gap-2">
                                        <ArrowDownRight className="w-4 h-4 text-green-500" />
                                        <div>
                                          Entradas:{" "}
                                          <span className="font-semibold text-green-500">
                                            {formatByCurrency(
                                              currency,
                                              ingreso,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                                        <div>
                                          Salidas:{" "}
                                          <span className="font-semibold text-red-500">
                                            {formatByCurrency(currency, egreso)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="pt-2">
                                        <div>
                                          Neto:{" "}
                                          <span
                                            className={`font-semibold ${
                                              neto > 0
                                                ? "text-green-500"
                                                : neto < 0
                                                  ? "text-red-500"
                                                  : ""
                                            }`}
                                          >
                                            {formatByCurrency(currency, neto)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>

        {enabledBalanceCurrencies.length > 0 && (
          <aside className="min-w-0 xl:w-[300px]">
            <div className="xl:sticky xl:top-20">
              <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/20 to-teal-500/15 shadow-[0_10px_35px_rgba(6,182,212,0.12)]">
                  <Banknote className="h-7 w-7 text-cyan-400" />
                </div>
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
                  Saldo Actual
                </p>
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  {enabledBalanceCurrencies.map((currency) => {
                    const label = currency === "CRC" ? "Colones" : "Dólares";
                    const value =
                      currency === "CRC"
                        ? currentBalanceCRC
                        : currentBalanceUSD;
                    return (
                      <div
                        key={currency}
                        className="rounded-xl border border-white/10 bg-[#050816] px-4 py-4 text-center"
                      >
                        <div className="text-xs uppercase tracking-wide text-white/45">
                          {label}
                        </div>
                        <div className="mt-2 text-2xl font-semibold leading-none tracking-tight text-white">
                          {formatByCurrency(currency, value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Registrar cierre moved next to 'Agregar movimiento' per UI changes */}
              </div>
            </div>
          </aside>
        )}
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
        key={`${dailyClosingModalOpen ? "open" : "closed"}-${editingDailyClosingId ?? dailyClosingInitialValues?.closingDate ?? "new"}`}
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
        allowPartialPayment={false}
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
        open={confirmPhysicalCountOpen}
        title="Confirmar conteo físico"
        message={
          <div className="text-left space-y-3">
            <div className="text-sm text-[var(--muted-foreground)]">
              Antes de registrar el primer movimiento después del último cierre,
              confirma que el fondo fue contado físicamente.
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 cursor-pointer"
                checked={physicalCountWasDone}
                onChange={(e) => setPhysicalCountWasDone(e.target.checked)}
                aria-label="Confirmar que el fondo fue contado físicamente"
              />
              <span className="text-sm">
                Sí, el fondo fue contado físicamente
              </span>
            </label>
          </div>
        }
        confirmText="Continuar"
        cancelText="Cancelar"
        actionType="change"
        confirmDisabled={!physicalCountWasDone}
        onConfirm={handleConfirmPhysicalCount}
        onCancel={handleCancelPhysicalCount}
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

      <ConfirmModal
        open={pendingCierreModalOpen}
        title="Cierre pendiente"
        message={
          "Existe un cierre pendiente. No se pueden procesar pagos hasta que el cierre sea confirmado o eliminado desde el historial de cierres."
        }
        singleButton
        singleButtonText="Entendido"
        onCancel={closePendingCierreModal}
        onConfirm={() => {}}
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

      <ConfirmModal
        open={confirmDeleteEntry.open}
        title="Eliminar movimiento"
        message={`¿Está seguro que desea eliminar el movimiento #${confirmDeleteEntry.entry?.invoiceNumber || ""}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={confirmDeleteMovement}
        onCancel={cancelDeleteMovement}
        actionType="delete"
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

