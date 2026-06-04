"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  CreditCard,
  ShoppingCart,
  Clock,
  CheckCircle,
  Eye,
  FileText,
  Pencil,
  ClipboardList,
  BadgeCheck,
  Save,
  X,
} from "lucide-react";
import { writeBatch, doc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useProviders } from "@/hooks/useProviders";
import { useAuth } from "@/hooks/useAuth";
import { useActorOwnership } from "@/hooks/useActorOwnership";
import useToast from "@/hooks/useToast";
import { FacturasService, type FacturaMovement } from "@/services/facturas";
import {
  MovimientosFondosService,
  type MovementCurrencyKey,
} from "@/services/movimientos-fondos";
import { DailyClosingsService } from "@/services/daily-closings";
import { EmpresasService } from "@/services/empresas";
import { SchedulesService } from "@/services/schedules";
import CreateInvoiceDrawer from "./CreateInvoiceDrawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  resolveManagerFromControlHorario,
  type ShiftCode,
} from "@/utils/controlHorarioManager";

import type { Empresas } from "../../../types/firestore";

const formatMovementType = (type: string) => {
  const trimmed = String(type || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/_/g, " ");
};

const formatInvoiceDocTypeLabel = (value: string) => {
  const docType = String(value || "")
    .trim()
    .toUpperCase();
  if (docType === "FCR") return "Factura a Credito";
  if (docType === "NC") return "Nota de Credito";
  if (docType === "FCO") return "Factura a Contado";
  return formatMovementType(docType);
};

// Deep remove undefined (Firestore doesn't accept undefined)
const stripUndefinedDeep = <T,>(value: T): T => {
  if (value === undefined) return value;
  if (Array.isArray(value)) {
    return value
      .map((v) => stripUndefinedDeep(v))
      .filter((v) => v !== undefined) as any as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      const cleaned = stripUndefinedDeep(v as any);
      if (cleaned !== undefined) out[k] = cleaned;
    });
    return out as T;
  }
  return value;
};

const buildFacturaMovementId = (): string =>
  `FAC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const dateKeyFromDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const dateKeyInCostaRica = (iso: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const yyyy = parts.find((p) => p.type === "year")?.value;
    const mm = parts.find((p) => p.type === "month")?.value;
    const dd = parts.find((p) => p.type === "day")?.value;
    if (!yyyy || !mm || !dd) return "";
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
};

const dateKeyFromIso = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatKeyToDisplay = (key: string): string => {
  const parts = String(key || "").split("-");
  if (parts.length !== 3) return key;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
};

const resolveFacturaPaidAmount = (movement: FacturaMovement): number => {
  const amount = Math.max(0, Math.trunc(Number(movement.amount) || 0));
  if (
    String(movement.invoiceDocType || "")
      .trim()
      .toUpperCase() === "FCO"
  ) {
    return amount;
  }
  const paidAmount = Math.max(0, Math.trunc(Number(movement.paidAmount) || 0));
  return Math.min(amount, paidAmount);
};

const resolveFacturaBalance = (movement: FacturaMovement): number => {
  const amount = Math.max(0, Math.trunc(Number(movement.amount) || 0));
  if (
    String(movement.invoiceDocType || "")
      .trim()
      .toUpperCase() === "FCO"
  ) {
    return 0;
  }
  const paidAmount = resolveFacturaPaidAmount(movement);
  const balanceDue = Math.max(0, Math.trunc(Number(movement.balanceDue) || 0));
  if (balanceDue > 0) return Math.min(amount, balanceDue);
  return Math.max(0, amount - paidAmount);
};

const resolveFacturaStatus = (
  movement: FacturaMovement,
): "PENDIENTE" | "PARCIAL" | "PAGADA" => {
  if (
    String(movement.invoiceDocType || "")
      .trim()
      .toUpperCase() === "NC" &&
    Math.max(0, Math.trunc(Number(movement.amount) || 0)) === 0 &&
    !["PAGADA", "REBAJADA"].includes(
      String(movement.paymentStatus || "PENDIENTE").toUpperCase(),
    )
  ) {
    return "PENDIENTE";
  }
  if (
    String(movement.invoiceDocType || "")
      .trim()
      .toUpperCase() === "FCO"
  ) {
    return "PAGADA";
  }
  if (movement.paymentStatus === "PAGADA") return "PAGADA";
  if (movement.paymentStatus === "PARCIAL") return "PARCIAL";
  return resolveFacturaBalance(movement) > 0 &&
    resolveFacturaPaidAmount(movement) > 0
    ? "PARCIAL"
    : resolveFacturaBalance(movement) === 0
      ? "PAGADA"
      : "PENDIENTE";
};

const resolveFacturaStatusLabel = (movement: FacturaMovement): string => {
  const status = resolveFacturaStatus(movement);
  if (
    status === "PAGADA" &&
    String(movement.invoiceDocType || "")
      .trim()
      .toUpperCase() === "NC"
  ) {
    return "REBAJADA";
  }
  return status;
};

const SHARED_COMPANY_STORAGE_KEY = "fg_selected_company_shared";

const CIERRE_FONDO_VENTAS_PROVIDER_NAME = "CIERRE FONDO VENTAS";

const isFacturaPaymentRecord = (movement: FacturaMovement): boolean =>
  String(movement.id || "").startsWith("fcr-pago-");

export default function FacturasCreditoPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { ownerIds: actorOwnerIds } = useActorOwnership(user);
  const company = useMemo(
    () => String(user?.ownercompanie || "").trim(),
    [user?.ownercompanie],
  );

  const isAdminOrSuperAdmin =
    user?.role === "admin" || user?.role === "superadmin";
  const [selectedCompany, setSelectedCompany] = useState(() => {
    if (!isAdminOrSuperAdmin) return company;
    try {
      const stored = localStorage.getItem(SHARED_COMPANY_STORAGE_KEY);
      return stored || company;
    } catch {
      return company;
    }
  });

  useEffect(() => {
    if (!isAdminOrSuperAdmin) {
      setSelectedCompany(company);
    }
  }, [company, isAdminOrSuperAdmin]);

  const { providers, loading: providersLoading } =
    useProviders(selectedCompany);

  const [movements, setMovements] = useState<FacturaMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<FacturaMovement | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentManager2, setPaymentManager2] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createProviderCode, setCreateProviderCode] = useState("");
  const [createProviderFilter, setCreateProviderFilter] = useState("");
  const [createOnlyInventoryProviders, setCreateOnlyInventoryProviders] =
    useState(true);
  const [isCreateProviderDropdownOpen, setIsCreateProviderDropdownOpen] =
    useState(false);
  const [createInvoiceNumber, setCreateInvoiceNumber] = useState("");
  const [createInvoiceDocType, setCreateInvoiceDocType] = useState<
    "FCR" | "NC"
  >("FCR");
  const [createAmount, setCreateAmount] = useState("");
  const [createCurrency, setCreateCurrency] =
    useState<MovementCurrencyKey>("CRC");
  const [createNotes, setCreateNotes] = useState("");
  const [createManager, setCreateManager] = useState("");
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [confirmZeroNCOpen, setConfirmZeroNCOpen] = useState(false);
  const [editZeroNCTarget, setEditZeroNCTarget] =
    useState<FacturaMovement | null>(null);
  const [editZeroNCAmount, setEditZeroNCAmount] = useState("");
  const [editZeroNCError, setEditZeroNCError] = useState<string | null>(null);
  const [editZeroNCSubmitting, setEditZeroNCSubmitting] = useState(false);

  // Filter state (mirrors Fondo toolbar names)
  const [providerFilter, setProviderFilter] = useState("");
  const [filterProviderCode, setFilterProviderCode] = useState<string>("all");
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState("");
  const [filterPaymentType, setFilterPaymentType] = useState<string>("all");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const [docTypeFilter, setDocTypeFilter] = useState<
    "all" | "FCR" | "NC" | "FCO"
  >("all");
  const [docTypeFilterLabel, setDocTypeFilterLabel] = useState("");
  const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState(false);
  const [providerDropdownQuery, setProviderDropdownQuery] = useState("");
  const [typeDropdownQuery, setTypeDropdownQuery] = useState("");
  const [docTypeDropdownQuery, setDocTypeDropdownQuery] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterEditedOnly, setFilterEditedOnly] = useState(false);
  const [filterPendingCredit, setFilterPendingCredit] = useState(false);
  const [filterNCPending, setFilterNCPending] = useState(false);
  const [filterPagada, setFilterPagada] = useState(false);
  const [filterPartial, setFilterPartial] = useState(false);
  const [filterRebajadas, setFilterRebajadas] = useState(false);
  const hasActiveStatusFilter =
    filterPendingCredit ||
    filterNCPending ||
    filterPagada ||
    filterPartial ||
    filterRebajadas;
  const [rememberFilters, setRememberFilters] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fg_rememberFilters") === "true";
    }
    return false;
  });

  const [fromFilter, setFromFilter] = useState<string | null>(null);
  const [toFilter, setToFilter] = useState<string | null>(null);
  const [quickRange, setQuickRange] = useState<string | null>(null);

  const [calendarFromOpen, setCalendarFromOpen] = useState(false);
  const [calendarToOpen, setCalendarToOpen] = useState(false);
  const [calendarFromMonth, setCalendarFromMonth] = useState<Date>(() => {
    const m = new Date();
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    return m;
  });
  const [calendarToMonth, setCalendarToMonth] = useState<Date>(() => {
    const m = new Date();
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    return m;
  });

  const [pageIndex, setPageIndex] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState<"daily" | number>("daily");
  const [currentDailyKey, setCurrentDailyKey] = useState(() =>
    dateKeyFromDate(new Date()),
  );

  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState(false);

  const fromButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const toButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const fromCalendarRef = React.useRef<HTMLDivElement | null>(null);
  const toCalendarRef = React.useRef<HTMLDivElement | null>(null);
  const providerDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const typeDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const docTypeDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const filtersDropdownRef = React.useRef<HTMLDivElement | null>(null);

  // Column widths for resizable columns (px based) with persistence
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>(
    () => {
      const defaults: Record<string, string> = {
        fecha: "80px",
        proveedor: "250px",
        factura: "120px",
        tipo: "160px",
        monto: "170px",
        estado: "240px",
        accion: "170px",
      };
      try {
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem("facturas-columnWidths");
          if (raw) {
            const parsed = JSON.parse(raw || "{}");
            return { ...defaults, ...parsed };
          }
        }
      } catch {
        // ignore and use defaults
      }
      return defaults;
    },
  );
  const resizingRef = React.useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const startResizing = (event: React.MouseEvent, key: string) => {
    event.preventDefault();
    const startWidth = parseInt(columnWidths[key] || "100", 10) || 100;
    resizingRef.current = { key, startX: event.clientX, startWidth };
  };

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

  // Persist column widths when changed
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "facturas-columnWidths",
          JSON.stringify(columnWidths),
        );
      }
    } catch {
      // ignore storage errors
    }
  }, [columnWidths]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  // Recalcular todayKey cada minuto para sesiones largas
  useEffect(() => {
    const id = window.setInterval(() => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setComputedTodayKey(dateKeyFromDate(new Date()));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [computedTodayKey, setComputedTodayKey] = useState(() => dateKeyFromDate(new Date()));
  const effectiveTodayKey = computedTodayKey || todayKey;
  const companySelectId = "facturas-company-select";
  const [availableCompanies, setAvailableCompanies] = useState<Empresas[]>([]);
  const [pendingCierreDeCaja, setPendingCierreDeCaja] = useState(false);
  const [pendingCierreModalOpen, setPendingCierreModalOpen] = useState(false);
  const [availableCompaniesLoading, setAvailableCompaniesLoading] =
    useState(false);
  const [availableCompaniesError, setAvailableCompaniesError] = useState<
    string | null
  >(null);
  const [companyEmployees, setCompanyEmployees] = useState<string[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [createManagerLockedByShift, setCreateManagerLockedByShift] =
    useState(false);

  const [missingShiftModalOpen, setMissingShiftModalOpen] = useState(false);
  const [missingShiftExpectedShift, setMissingShiftExpectedShift] =
    useState<ShiftCode>("D");
  const [missingShiftDateKey, setMissingShiftDateKey] = useState("");

  const schedulesMonthCacheRef = React.useRef<
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
  const SCHEDULES_CACHE_TTL_MS = 5 * 60 * 1000;
  const getMonthlySchedulesCached = useCallback(
    async (locationValue: string, year: number, month0: number) => {
      const key = `${locationValue}__${year}__${month0}`;
      const now = Date.now();
      const cached = schedulesMonthCacheRef.current.get(key);
      if (cached && now - cached.at < SCHEDULES_CACHE_TTL_MS) return cached.promise;
      const promise = SchedulesService.getSchedulesByLocationYearMonth(
        locationValue,
        year,
        month0,
      );
      schedulesMonthCacheRef.current.set(key, { at: now, promise });
      return promise;
    },
    [],
  );

  const getCompanyKey = useCallback(
    (emp: Empresas) =>
      String(emp?.name || emp?.ubicacion || emp?.id || "").trim(),
    [],
  );

  const selectedEmpresaMeta = useMemo(() => {
    const normalize = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const normalizedSelected = normalize(selectedCompany);
    if (!normalizedSelected) return null;
    return (
      availableCompanies.find((emp) => {
        const candidates = [emp?.name, emp?.ubicacion, emp?.id]
          .map(normalize)
          .filter(Boolean);
        return candidates.includes(normalizedSelected);
      }) ?? null
    );
  }, [availableCompanies, selectedCompany]);

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

  const getFetchDateRange = useCallback(() => {
    const nowKey = dateKeyFromDate(new Date());

    if (fromFilter && toFilter) {
      let from = fromFilter;
      let to = toFilter;
      if (from > to) to = from;
      const startDate = new Date(from + "T06:00:00.000Z");
      const endDate = new Date(to + "T06:00:00.000Z");
      endDate.setDate(endDate.getDate() + 1);
      return {
        startIso: startDate.toISOString(),
        endIso: endDate.toISOString(),
      };
    }

    if (fromFilter && !toFilter) {
      const startDate = new Date(fromFilter + "T06:00:00.000Z");
      const endDate = new Date(nowKey + "T06:00:00.000Z");
      endDate.setDate(endDate.getDate() + 1);
      return {
        startIso: startDate.toISOString(),
        endIso: endDate.toISOString(),
      };
    }

    if (!fromFilter && toFilter) {
      const endDate = new Date(toFilter + "T06:00:00.000Z");
      endDate.setDate(endDate.getDate() + 1);
      return {
        startIso: "1970-01-01T06:00:00.000Z",
        endIso: endDate.toISOString(),
      };
    }

    const day = currentDailyKey || dateKeyFromDate(new Date());
    const startOfDay = new Date(day + "T06:00:00.000Z");
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    return {
      startIso: startOfDay.toISOString(),
      endIso: endOfDay.toISOString(),
    };
  }, [fromFilter, toFilter, currentDailyKey]);

  const loadMovements = useCallback(
    async (companyName: string) => {
      if (!companyName) {
        setMovements([]);
        return;
      }

      setMovementsLoading(true);
      try {
        const data = hasActiveStatusFilter
          ? await FacturasService.listMovementsByEmpresa(companyName, {
              limit: 800,
            })
          : await (async () => {
              const range = getFetchDateRange();
              return FacturasService.listMovementsByDateRange(companyName, {
                startIso: range.startIso,
                endIso: range.endIso,
                limit: 800,
              });
            })();
        setMovements(
          data.filter((movement) => !isFacturaPaymentRecord(movement)),
        );
      } finally {
        setMovementsLoading(false);
      }
    },
    [getFetchDateRange, hasActiveStatusFilter],
  );

  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      const minimums: Record<string, number> = {
        monto: 170,
        estado: 240,
        accion: 170,
      };
      let changed = false;

      Object.entries(minimums).forEach(([key, minimum]) => {
        const current = parseInt(String(prev[key] || "0"), 10) || 0;
        if (current < minimum) {
          next[key] = `${minimum}px`;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, []);

  const actorOwnerIdSet = useMemo(
    () => new Set(actorOwnerIds.map((id) => String(id).trim()).filter(Boolean)),
    [actorOwnerIds],
  );

  const visibleCompanies = useMemo(() => {
    if (user?.role === "superadmin") return availableCompanies;
    if (actorOwnerIdSet.size === 0) return [];

    return availableCompanies.filter((emp) => {
      const ownerId = String(emp?.ownerId || "").trim();
      return ownerId ? actorOwnerIdSet.has(ownerId) : false;
    });
  }, [availableCompanies, actorOwnerIdSet, user?.role]);

  const paymentEmployeeOptions = useMemo(() => {
    const unique = new Set<string>();
    const add = (value: unknown) => {
      const name = String(value || "").trim();
      if (name) unique.add(name);
    };

    companyEmployees.forEach((name) => add(name));

    if (user?.role === "admin" || user?.role === "superadmin") {
      add(user?.name);
      add(user?.email);
    }

    add(paymentManager2);

    return Array.from(unique).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" }),
    );
  }, [companyEmployees, paymentManager2, user?.email, user?.name, user?.role]);

  const createSelectedProvider = useMemo(
    () =>
      providers.find((provider) => provider.code === createProviderCode) ??
      null,
    [createProviderCode, providers],
  );

  const createPaymentType = useMemo(
    () => String(createSelectedProvider?.type || "").trim(),
    [createSelectedProvider],
  );

  const filteredCreateProviders = useMemo(
    () =>
      providers
        .filter((provider) => {
          if (createOnlyInventoryProviders) {
            const providerType = String(provider.type || "")
              .trim()
              .toUpperCase();
            if (providerType !== "COMPRA INVENTARIO") return false;
          }

          const byName = String(provider.name || "")
            .toLowerCase()
            .includes(createProviderFilter.toLowerCase());
          const byCode = String(provider.code || "")
            .toLowerCase()
            .includes(createProviderFilter.toLowerCase());
          return byName || byCode;
        })
        .sort((a, b) =>
          String(a.name || a.code).localeCompare(
            String(b.name || b.code),
            "es",
            {
              sensitivity: "base",
            },
          ),
        ),
    [createOnlyInventoryProviders, createProviderFilter, providers],
  );

  useEffect(() => {
    if (!createProviderCode) {
      setCreateProviderFilter("");
      return;
    }

    const selected = providers.find(
      (provider) => provider.code === createProviderCode,
    );

    setCreateProviderFilter(
      selected ? `${selected.name} (${selected.code})` : createProviderCode,
    );
  }, [createProviderCode, providers]);

  const resetCreateForm = useCallback(() => {
    setCreateProviderCode("");
    setCreateProviderFilter("");
    setCreateOnlyInventoryProviders(true);
    setIsCreateProviderDropdownOpen(false);
    setCreateInvoiceNumber("");
    setCreateInvoiceDocType("FCR");
    setCreateAmount("");
    setCreateCurrency("CRC");
    setCreateNotes("");
    setCreateManager(String(user?.name || user?.email || "").trim());
    setCreateFormError(null);
  }, [user?.email, user?.name]);

  const handleCloseCreateDrawer = useCallback(() => {
    setCreateDrawerOpen(false);
    setIsCreateProviderDropdownOpen(false);
    setCreateFormError(null);
  }, []);

  const resolveShiftManagerForNow = useCallback(
    async (nowISO: string) => {
      const empresa = selectedEmpresaMeta;
      const normalizedCompany = String(selectedCompany || "").trim();
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
        companyKeysToTry.map((key) => getMonthlySchedulesCached(key, year, month0)),
      );
      const monthSchedules = schedulesLists.flat();
      return resolveManagerFromControlHorario({ nowISO, empresa, monthSchedules });
    },
    [getMonthlySchedulesCached, selectedCompany, selectedEmpresaMeta],
  );

  useEffect(() => {
    const shouldAuto = user?.role === "user" && createDrawerOpen;

    if (!shouldAuto) {
      setCreateManagerLockedByShift(false);
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const nowISO = new Date().toISOString();
        const resolution = await resolveShiftManagerForNow(nowISO);
        if (cancelled || !resolution) return;

        if (resolution.mode === "manual") {
          setCreateManagerLockedByShift(false);
          return;
        }

        if (resolution.mode === "missing") {
          setCreateManagerLockedByShift(false);
          return;
        }

        setCreateManagerLockedByShift(true);
        if (resolution.mode === "auto") {
          setCreateManager(resolution.manager);
        }
      } catch (err) {
        console.error("[FACTURAS] Error auto-locking manager by shift:", err);
      }
    };

    void tick();
    const interval = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [createDrawerOpen, resolveShiftManagerForNow, user?.role]);

  const submitCreateMovement = useCallback(async (confirmedZeroNC = false) => {
    const empresa = String(selectedCompany || "").trim();
    if (!empresa) {
      setCreateFormError("Selecciona una empresa antes de guardar la factura.");
      return;
    }

    const providerCode = String(createProviderCode || "").trim();
    if (!providerCode) {
      setCreateFormError("Selecciona un proveedor.");
      return;
    }

    const invoiceNumber = String(createInvoiceNumber || "")
      .trim()
      .toUpperCase();
    if (!invoiceNumber) {
      setCreateFormError("Ingresa el numero de factura.");
      return;
    }

    const amount = Math.max(0, Math.trunc(Number(createAmount) || 0));
    if (amount <= 0 && createInvoiceDocType !== "NC") {
      setCreateFormError("Ingresa un monto mayor a cero.");
      return;
    }

    if (amount <= 0 && createInvoiceDocType === "NC" && !confirmedZeroNC) {
      setCreateFormError(null);
      setConfirmZeroNCOpen(true);
      return;
    }

    const nowISO = new Date().toISOString();
    let effectiveManager = String(createManager || "").trim();

    if (user?.role === "user") {
      try {
        const resolution = await resolveShiftManagerForNow(nowISO);
        if (resolution) {
          if (resolution.mode === "missing") {
            setMissingShiftExpectedShift(resolution.expectedShift);
            setMissingShiftDateKey(resolution.dateKey);
            setMissingShiftModalOpen(true);
            return;
          }
          if (resolution.mode === "auto") {
            effectiveManager = resolution.manager;
            setCreateManager(resolution.manager);
          }
        }
      } catch (err) {
        console.error("[FACTURAS] Error resolving manager from control horario:", err);
      }
    }

    if (!effectiveManager) {
      setCreateFormError("Selecciona un encargado.");
      return;
    }

    const isCreditNote = createInvoiceDocType === "NC";

    const movement: FacturaMovement = {
      id: buildFacturaMovementId(),
      empresa,
      accountId: "FondoGeneral",
      amount,
      originalAmount: amount,
      amountDue: amount,
      amountEgreso: isCreditNote ? 0 : amount,
      amountIngreso: isCreditNote ? amount : 0,
      createdAt: nowISO,
      currency: createCurrency,
      invoiceNumber,
      manager: effectiveManager,
      notes: String(createNotes || "").trim(),
      invoiceDocType: createInvoiceDocType,
      paymentType: createPaymentType || "FACTURA A CREDITO",
      providerCode,
      paidAmount: undefined,
      balanceDue: amount,
      paymentStatus: "PENDIENTE",
      zeroAmountEditCount: isCreditNote && amount === 0 ? 0 : undefined,
    };

    setCreateSubmitting(true);
    setCreateFormError(null);
    try {
      await FacturasService.upsertMovement(empresa, movement);
      await loadMovements(empresa);
      showToast(
        isCreditNote
          ? "Nota de credito guardada."
          : "Factura a credito guardada.",
        "success",
        3500,
      );
      setCreateDrawerOpen(false);
      resetCreateForm();
    } catch (error) {
      console.error("[FACTURAS] Error creating movement:", error);
      setCreateFormError("No se pudo guardar la factura.");
    } finally {
      setCreateSubmitting(false);
    }
  }, [
    createAmount,
    createCurrency,
    createInvoiceDocType,
    createInvoiceNumber,
    createManager,
    createNotes,
    createPaymentType,
    createProviderCode,
    loadMovements,
    resetCreateForm,
    resolveShiftManagerForNow,
    selectedCompany,
    showToast,
    user?.role,
  ]);

  const openEditZeroNCModal = useCallback((movement: FacturaMovement) => {
    setEditZeroNCTarget(movement);
    setEditZeroNCAmount("");
    setEditZeroNCError(null);
  }, []);

  const closeEditZeroNCModal = useCallback(() => {
    if (editZeroNCSubmitting) return;
    setEditZeroNCTarget(null);
    setEditZeroNCAmount("");
    setEditZeroNCError(null);
  }, [editZeroNCSubmitting]);

  const submitEditZeroNCAmount = useCallback(async () => {
    if (!editZeroNCTarget) return;
    const amount = Math.max(0, Math.trunc(Number(editZeroNCAmount) || 0));
    if (amount <= 0) {
      setEditZeroNCError("Ingresa un monto mayor a cero.");
      return;
    }
    if (Math.max(0, Math.trunc(Number(editZeroNCTarget.amount) || 0)) !== 0) {
      setEditZeroNCError("Esta nota de credito ya tiene monto.");
      return;
    }
    if (Math.max(0, Math.trunc(Number(editZeroNCTarget.zeroAmountEditCount) || 0)) > 0) {
      setEditZeroNCError("Esta nota de credito ya fue editada una vez.");
      return;
    }

    const nowISO = new Date().toISOString();
    const updatedMovement: FacturaMovement = {
      ...editZeroNCTarget,
      amount,
      originalAmount: amount,
      amountDue: amount,
      amountEgreso: 0,
      amountIngreso: amount,
      paidAmount: undefined,
      balanceDue: amount,
      paymentStatus: "PENDIENTE",
      updateAt: nowISO,
      zeroAmountEditCount: 1,
      zeroAmountEditedAt: nowISO,
    };

    setEditZeroNCSubmitting(true);
    setEditZeroNCError(null);
    try {
      await FacturasService.upsertMovement(selectedCompany, updatedMovement);
      await loadMovements(selectedCompany);
      showToast("Monto de nota de credito actualizado.", "success", 3500);
      setEditZeroNCTarget(null);
      setEditZeroNCAmount("");
    } catch (error) {
      console.error("[FACTURAS] Error updating zero NC amount:", error);
      setEditZeroNCError("No se pudo actualizar el monto.");
    } finally {
      setEditZeroNCSubmitting(false);
    }
  }, [
    editZeroNCAmount,
    editZeroNCTarget,
    loadMovements,
    selectedCompany,
    showToast,
  ]);

  useEffect(() => {
    if (visibleCompanies.length === 0) {
      if (selectedCompany) setSelectedCompany("");
      return;
    }

    const selected = String(selectedCompany || "").trim();

    const exists = visibleCompanies.some(
      (emp) => getCompanyKey(emp) === selected,
    );

    if (selected && exists) return;

    // Try to prefer localStorage shared value
    let preferred: Empresas | undefined;
    if (isAdminOrSuperAdmin) {
      try {
        const stored = localStorage.getItem(SHARED_COMPANY_STORAGE_KEY);
        if (stored) {
          preferred = visibleCompanies.find(
            (emp) => getCompanyKey(emp) === stored,
          );
        }
      } catch {
        // ignore
      }
    }

    if (!preferred) {
      const userCompanyKey = String(user?.ownercompanie || "").trim();
      if (userCompanyKey) {
        preferred = visibleCompanies.find(
          (emp) =>
            getCompanyKey(emp) === userCompanyKey ||
            String(emp?.id || "").trim() === userCompanyKey,
        );
      }
    }

    if (!preferred) {
      const userOwnerId = String(user?.ownerId || "").trim();
      if (userOwnerId) {
        preferred = visibleCompanies.find(
          (emp) => String(emp?.ownerId || "").trim() === userOwnerId,
        );
      }
    }

    setSelectedCompany(
      preferred ? getCompanyKey(preferred) : getCompanyKey(visibleCompanies[0]),
    );
  }, [
    getCompanyKey,
    selectedCompany,
    visibleCompanies,
    user?.ownercompanie,
    user?.ownerId,
  ]);

  const selectedPaymentBalance = useMemo(() => {
    if (!paymentTarget) return 0;
    const total = Math.max(
      0,
      Math.trunc(
        Number(paymentTarget.originalAmount ?? paymentTarget.amount) || 0,
      ),
    );
    const paid = resolveFacturaPaidAmount(paymentTarget);
    return Math.max(0, Math.min(total, total - paid));
  }, [paymentTarget]);

  const selectedPaymentPaid = useMemo(() => {
    if (!paymentTarget) return 0;
    return resolveFacturaPaidAmount(paymentTarget);
  }, [paymentTarget]);

  const selectedPaymentStatus = useMemo(() => {
    if (!paymentTarget) return "PENDIENTE" as const;
    return resolveFacturaStatusLabel(paymentTarget);
  }, [paymentTarget]);

  const enteredPaymentAmount = useMemo(
    () => Math.max(0, Math.trunc(Number(paymentAmount) || 0)),
    [paymentAmount],
  );

  const canSubmitFullPayment = useMemo(
    () =>
      selectedPaymentBalance > 0 &&
      enteredPaymentAmount === selectedPaymentBalance,
    [enteredPaymentAmount, selectedPaymentBalance],
  );

  const closePaymentModal = useCallback(() => {
    setPaymentModalOpen(false);
    setPaymentTarget(null);
    setPaymentAmount("");
    setPaymentNotes("");
    setPaymentManager2("");
  }, []);

  const openPaymentModal = useCallback(
    (movement: FacturaMovement) => {
      if (pendingCierreDeCaja) {
        setPendingCierreModalOpen(true);
        return;
      }
      const total = Math.max(
        0,
        Math.trunc(Number(movement.originalAmount ?? movement.amount) || 0),
      );
      const paid = resolveFacturaPaidAmount(movement);
      const balance = Math.max(0, Math.min(total, total - paid));
      setPaymentTarget(movement);
      setPaymentAmount(String(balance));
      setPaymentNotes(String(movement.notes || ""));
      setPaymentManager2(String(movement.manager2 || ""));
      setPaymentModalOpen(true);
    },
    [pendingCierreDeCaja],
  );

  const submitPayment = useCallback(
    async (mode: "partial" | "full") => {
      if (pendingCierreDeCaja) {
        setPendingCierreModalOpen(true);
        return;
      }
      if (!selectedCompany) {
        showToast(
          "Selecciona una empresa antes de registrar el pago.",
          "error",
          4000,
        );
        return;
      }
      if (!paymentTarget) return;

      const parentInvoiceAmount = Math.max(
        0,
        Math.trunc(
          Number(
            paymentTarget.originalAmount ??
              paymentTarget.amount ??
              selectedPaymentPaid +
                Math.max(
                  0,
                  Math.trunc(Number(resolveFacturaBalance(paymentTarget)) || 0),
                ),
          ) || 0,
        ),
      );
      const totalAmount = parentInvoiceAmount;
      const balance = Math.max(
        0,
        Math.min(totalAmount, totalAmount - selectedPaymentPaid),
      );
      const enteredAmount = enteredPaymentAmount;
      const paymentAmountToApply = mode === "full" ? balance : enteredAmount;

      if (mode === "full" && enteredAmount !== balance) {
        showToast(
          "Para pagar completo, el monto debe coincidir con el saldo pendiente.",
          "error",
          4000,
        );
        return;
      }

      if (paymentAmountToApply <= 0) {
        showToast("Ingrese un monto válido para el pago.", "error", 4000);
        return;
      }

      if (paymentAmountToApply > balance) {
        showToast(
          "El monto no puede superar el saldo pendiente.",
          "error",
          4000,
        );
        return;
      }

      const nowISO = new Date().toISOString();
      const nextPaidAmount = Math.min(
        totalAmount,
        selectedPaymentPaid + paymentAmountToApply,
      );
      const nextBalanceDue = Math.max(0, totalAmount - nextPaidAmount);
      const nextStatus =
        nextBalanceDue === 0
          ? "PAGADA"
          : nextPaidAmount > 0
            ? "PARCIAL"
            : "PENDIENTE";
      const cleanedNotes = paymentNotes.trim();
      const cleanedManager2 = paymentManager2.trim();
      const paymentAppliedCreditNotes = Array.isArray(
        paymentTarget.appliedCreditNotes,
      )
        ? paymentTarget.appliedCreditNotes
        : [];

      const paymentManager2Value = cleanedManager2 || null;

      const updatedMovement: FacturaMovement = {
        id: paymentTarget.id,
        empresa: paymentTarget.empresa,
        accountId: paymentTarget.accountId,
        amount: parentInvoiceAmount,
        originalAmount: parentInvoiceAmount,
        amountDue: nextBalanceDue,
        amountPayment: paymentAmountToApply,
        paidAmount: nextPaidAmount,
        balanceDue: nextBalanceDue,
        paymentStatus: nextStatus,
        createdAt: paymentTarget.createdAt,
        currency: paymentTarget.currency,
        invoiceNumber: paymentTarget.invoiceNumber,
        manager: paymentTarget.manager,
        notes: cleanedNotes,
        invoiceDocType: paymentTarget.invoiceDocType,
        paymentType: paymentTarget.paymentType,
        providerCode: paymentTarget.providerCode,
        amountEgreso: paymentTarget.amountEgreso,
        amountIngreso: paymentTarget.amountIngreso,
        appliedCreditNotes: paymentAppliedCreditNotes,
        updateAt: nowISO,
        ...(paymentManager2Value ? { manager2: paymentManager2Value } : {}),
      };

      const movementDocId =
        MovimientosFondosService.buildCompanyMovementsKey(selectedCompany);
      const paymentMovement =
        MovimientosFondosService.buildInvoicePaymentMovement({
          company: selectedCompany,
          invoice: updatedMovement,
          paymentAmount: paymentAmountToApply,
          updateAt: nowISO,
          manager2: paymentManager2Value || undefined,
        });
      const paymentMovementId = String((paymentMovement as any).id || "");
      const targetAccountKey = updatedMovement.accountId;
      if (targetAccountKey === "CajaNegra") {
        showToast(
          "Desde Caja Negra no se debe gestionar facturas a crédito.",
          "error",
          4500,
        );
        return;
      }

      setPaymentSubmitting(true);
      try {
        const docId = movementDocId; // MovimientosFondos document id

        // Load existing ledger (if any)
        let baseStorage = null;
        try {
          baseStorage = await MovimientosFondosService.getDocument(docId);
        } catch {
          baseStorage = null;
        }
        const ledger =
          baseStorage ??
          MovimientosFondosService.createEmptyMovementStorage(selectedCompany);
        ledger.company = selectedCompany;
        // Do not persist operations array to main doc; movements are in subcollection
        ledger.operations = { movements: [] };

        // Adjust balances: subtract payment from currentBalance for the account/currency
        const state =
          ledger.state ??
          MovimientosFondosService.createEmptyMovementStorage(selectedCompany)
            .state;
        const acctKey = targetAccountKey;
        const currency = paymentMovement.currency as MovementCurrencyKey;
        const amountToApply = Math.trunc(paymentAmountToApply || 0);
        let found = false;
        state.balancesByAccount = state.balancesByAccount.map((b) => {
          if (b.accountId === acctKey && b.currency === currency) {
            const current =
              typeof b.currentBalance === "number"
                ? b.currentBalance
                : b.initialBalance || 0;
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
        state.updatedAt = new Date().toISOString();
        ledger.state = state;

        const batch = writeBatch(db);
        // Persist Facturas updated invoice
        batch.set(
          FacturasService.buildMovementRef(selectedCompany, paymentTarget.id),
          stripUndefinedDeep(updatedMovement),
          { merge: true },
        );
        // Persist ledger main doc
        const mainRef = doc(
          db,
          MovimientosFondosService.COLLECTION_NAME,
          docId,
        );
        batch.set(mainRef, stripUndefinedDeep(ledger) as any);
        // Persist movement in MovimientosFondos subcollection
        const movRef = MovimientosFondosService.buildMovementRef(
          docId,
          paymentMovementId,
          targetAccountKey,
        );
        batch.set(movRef, stripUndefinedDeep(paymentMovement));

        await batch.commit();

        await loadMovements(selectedCompany);
        showToast(
          nextStatus === "PAGADA"
            ? "Factura pagada y movimiento generado."
            : "Abono registrado.",
          "success",
          3500,
        );
        closePaymentModal();
      } catch (error) {
        console.error("[FACTURAS] Error saving payment:", error);
        showToast("No se pudo registrar el pago.", "error", 5000);
      } finally {
        setPaymentSubmitting(false);
      }
    },
    [
      closePaymentModal,
      loadMovements,
      enteredPaymentAmount,
      paymentManager2,
      paymentNotes,
      paymentTarget,
      pendingCierreDeCaja,
      selectedCompany,
      selectedPaymentPaid,
      showToast,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    const checkPending = async () => {
      setPendingCierreDeCaja(false);
      if (!selectedCompany || providersLoading) return;
      try {
        const docId =
          MovimientosFondosService.buildCompanyMovementsKey(selectedCompany);
        if (!docId) return;
        const page = await MovimientosFondosService.listMovementsPage(docId, {
          pageSize: 400,
        });
        if (cancelled) return;

        // Find the most recent 'CIERRE FONDO VENTAS' movement timestamp
        let cierreEntryTs = 0;
        for (const m of page.items) {
          const provCode = (m as any).providerCode;
          if (!provCode) continue;
          const provider = providers.find((p) => p.code === provCode);
          if (
            provider?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME
          ) {
            const created = String(
              (m as any).createdAt || (m as any).updateAt || "",
            );
            const parsed = Date.parse(created);
            if (!Number.isNaN(parsed) && parsed > cierreEntryTs)
              cierreEntryTs = parsed;
          }
        }

        if (cancelled) return;

        if (cierreEntryTs > 0) {
          // Load daily closings document and get latest closing timestamp
          try {
            const doc = await DailyClosingsService.getDocument(selectedCompany);
            let latestDailyClosingTs = 0;
            if (doc) {
              const records = DailyClosingsService.extractAllClosings(doc);
              for (const r of records) {
                const ts = Date.parse(r.createdAt || r.closingDate || "");
                if (!Number.isNaN(ts) && ts > latestDailyClosingTs)
                  latestDailyClosingTs = ts;
              }
            }
            if (!cancelled) {
              setPendingCierreDeCaja(cierreEntryTs > latestDailyClosingTs);
              console.log(
                "[CIERRE-DEBUG][FACTURAS] cierreEntryTs, latestDailyClosingTs:",
                cierreEntryTs,
                latestDailyClosingTs,
              );
            }
          } catch (err) {
            if (!cancelled) {
              setPendingCierreDeCaja(false);
              console.log(
                "[CIERRE-DEBUG][FACTURAS] no se bloquea pago por error al leer cierres",
              );
            }
          }
        } else {
          if (!cancelled) setPendingCierreDeCaja(false);
        }
      } catch (err) {
        // ignore errors; default to not blocking
      }
    };
    void checkPending();
    return () => {
      cancelled = true;
    };
  }, [selectedCompany, providers, providersLoading]);

  const closePendingCierreModal = useCallback(() => {
    setPendingCierreModalOpen(false);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!selectedCompany) {
      setMovements([]);
      return;
    }

    setMovementsLoading(true);
    const loadPromise = hasActiveStatusFilter
      ? FacturasService.listMovementsByEmpresa(selectedCompany, { limit: 800 })
      : (() => {
          const range = getFetchDateRange();
          return FacturasService.listMovementsByDateRange(selectedCompany, {
            startIso: range.startIso,
            endIso: range.endIso,
            limit: 800,
          });
        })();
    loadPromise
      .then((data) => {
        if (cancelled) return;
        setMovements(
          data.filter((movement) => !isFacturaPaymentRecord(movement)),
        );
      })
      .catch((err) => {
        console.error("[FACTURAS] Error loading movements:", err);
        if (!cancelled) {
          showToast(
            "No se pudieron cargar las facturas. Intente de nuevo.",
            "error",
            5000,
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMovementsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCompany, getFetchDateRange, showToast, hasActiveStatusFilter]);

  useEffect(() => {
    let cancelled = false;

    setAvailableCompaniesLoading(true);
    setAvailableCompaniesError(null);

    EmpresasService.getAllEmpresas()
      .then((data) => {
        if (cancelled) return;
        setAvailableCompanies(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setAvailableCompanies([]);
        setAvailableCompaniesError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las empresas disponibles.",
        );
      })
      .finally(() => {
        if (!cancelled) setAvailableCompaniesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setAvailableCompanies]);

  useEffect(() => {
    if (!selectedCompany) {
      setCompanyEmployees([]);
      setEmployeesLoading(false);
      return;
    }

    setEmployeesLoading(true);
    const match = availableCompanies.find(
      (emp) => getCompanyKey(emp) === selectedCompany,
    );
    const names =
      match?.empleados?.map((emp) => emp.Empleado).filter(Boolean) ?? [];
    setCompanyEmployees(names as string[]);
    setEmployeesLoading(false);
  }, [availableCompanies, getCompanyKey, selectedCompany]);

  useEffect(() => {
    if (!isAdminOrSuperAdmin) return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === SHARED_COMPANY_STORAGE_KEY && e.newValue !== null) {
        setSelectedCompany(e.newValue);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isAdminOrSuperAdmin]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        isProviderDropdownOpen &&
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(target)
      ) {
        setIsProviderDropdownOpen(false);
      }
      if (
        isTypeDropdownOpen &&
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(target)
      ) {
        setIsTypeDropdownOpen(false);
      }
      if (
        isDocTypeDropdownOpen &&
        docTypeDropdownRef.current &&
        !docTypeDropdownRef.current.contains(target)
      ) {
        setIsDocTypeDropdownOpen(false);
      }

      if (
        filtersDropdownOpen &&
        filtersDropdownRef.current &&
        !filtersDropdownRef.current.contains(target)
      ) {
        setFiltersDropdownOpen(false);
      }

      if (
        calendarFromOpen &&
        fromCalendarRef.current &&
        fromButtonRef.current &&
        !fromCalendarRef.current.contains(target) &&
        !fromButtonRef.current.contains(target)
      ) {
        setCalendarFromOpen(false);
      }

      if (
        calendarToOpen &&
        toCalendarRef.current &&
        toButtonRef.current &&
        !toCalendarRef.current.contains(target) &&
        !toButtonRef.current.contains(target)
      ) {
        setCalendarToOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [
    calendarFromOpen,
    calendarToOpen,
    isProviderDropdownOpen,
    isTypeDropdownOpen,
    isDocTypeDropdownOpen,
    filtersDropdownOpen,
  ]);

  useEffect(() => {
    const saved = localStorage.getItem("fg_filters");
    if (saved && rememberFilters) {
      try {
        const parsed = JSON.parse(saved);
        setFilterPendingCredit(!!parsed.filterPendingCredit);
        setFilterNCPending(!!parsed.filterNCPending);
        setFilterPagada(!!parsed.filterPagada);
        setFilterPartial(!!parsed.filterPartial);
        setFilterRebajadas(!!parsed.filterRebajadas);
        setFilterEditedOnly(!!parsed.filterEditedOnly);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (rememberFilters) {
      localStorage.setItem(
        "fg_filters",
        JSON.stringify({
          filterPendingCredit,
          filterNCPending,
          filterPagada,
          filterPartial,
          filterRebajadas,
          filterEditedOnly,
        }),
      );
    }
  }, [
    rememberFilters,
    filterPendingCredit,
    filterNCPending,
    filterPagada,
    filterPartial,
    filterRebajadas,
    filterEditedOnly,
  ]);

  const providerNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) map.set(p.code, p.name || p.code);
    return map;
  }, [providers]);

  const movementTypes = useMemo(() => {
    const set = new Set<string>();
    for (const m of movements) {
      const t = String(m.paymentType || "").trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [movements]);

  // Keep the toolbar JSX structure intact.
  const FONDO_INGRESO_TYPES = movementTypes;
  const FONDO_GASTO_TYPES: string[] = [];
  const FONDO_EGRESO_TYPES: string[] = [];

  const pendingSupplierAlerts = useMemo(() => {
    const map = new Map<
      string,
      {
        providerCode: string;
        providerName: string;
        count: number;
        crc: number;
        usd: number;
      }
    >();

    for (const movement of movements) {
      if (
        String(movement.invoiceDocType || "")
          .trim()
          .toUpperCase() !== "FCR"
      ) {
        continue;
      }
      const balance = resolveFacturaBalance(movement);
      if (balance <= 0 || resolveFacturaStatus(movement) === "PAGADA") {
        continue;
      }
      const providerCode = movement.providerCode;
      const current = map.get(providerCode) ?? {
        providerCode,
        providerName: providerNameByCode.get(providerCode) || providerCode,
        count: 0,
        crc: 0,
        usd: 0,
      };
      current.count += 1;
      if (movement.currency === "USD") current.usd += balance;
      else current.crc += balance;
      map.set(providerCode, current);
    }

    return Array.from(map.values()).sort((a, b) => {
      const balanceA = a.crc + a.usd;
      const balanceB = b.crc + b.usd;
      if (balanceB !== balanceA) return balanceB - balanceA;
      return a.providerName.localeCompare(b.providerName, "es");
    });
  }, [movements, providerNameByCode]);

  const selectedProviderPendingAlert = useMemo(
    () =>
      filterProviderCode !== "all"
        ? (pendingSupplierAlerts.find(
            (item) => item.providerCode === filterProviderCode,
          ) ?? null)
        : null,
    [filterProviderCode, pendingSupplierAlerts],
  );

  const formatAlertAmount = (currency: MovementCurrencyKey, value: number) =>
    value.toLocaleString("es-CR", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const providerQuery = providerDropdownQuery.trim().toLowerCase();
    const typeQuery = typeDropdownQuery.trim().toLowerCase();
    const docTypeQuery = docTypeDropdownQuery.trim().toLowerCase();

    return movements.filter((m) => {
      if (
        filterProviderCode !== "all" &&
        m.providerCode !== filterProviderCode
      ) {
        return false;
      }
      if (filterProviderCode === "all" && providerQuery) {
        const providerHaystack = [
          m.providerCode,
          providerNameByCode.get(m.providerCode) || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!providerHaystack.includes(providerQuery)) return false;
      }

      if (filterPaymentType !== "all" && m.paymentType !== filterPaymentType) {
        return false;
      }
      if (filterPaymentType === "all" && typeQuery) {
        const typeHaystack = formatMovementType(m.paymentType).toLowerCase();
        if (!typeHaystack.includes(typeQuery)) return false;
      }

      if (docTypeFilter !== "all" && m.invoiceDocType !== docTypeFilter) {
        return false;
      }
      if (docTypeFilter === "all" && docTypeQuery) {
        const docHaystack = formatInvoiceDocTypeLabel(
          m.invoiceDocType,
        ).toLowerCase();
        if (!docHaystack.includes(docTypeQuery)) return false;
      }

      if (!hasActiveStatusFilter) {
        if (fromFilter || toFilter) {
          const key = dateKeyInCostaRica(m.createdAt);
          if (fromFilter && key && key < fromFilter) return false;
          if (toFilter && key && key > toFilter) return false;
        } else {
          const key = dateKeyInCostaRica(m.createdAt);
          if (key && key !== currentDailyKey) return false;
        }
      }

      if (filterEditedOnly) {
        const anyAudit = Boolean((m as any).isAudit);
        if (!anyAudit) return false;
      }

      if (filterPendingCredit) {
        const status = resolveFacturaStatus(m);
        if (status !== "PENDIENTE") return false;
        if (
          String(m.invoiceDocType || "")
            .trim()
            .toUpperCase() !== "FCR"
        )
          return false;
      }

      if (filterNCPending) {
        const status = resolveFacturaStatus(m);
        if (status !== "PENDIENTE") return false;
        if (
          String(m.invoiceDocType || "")
            .trim()
            .toUpperCase() !== "NC"
        )
          return false;
      }

      if (filterPagada) {
        const status = resolveFacturaStatus(m);
        if (status !== "PAGADA") return false;
        const dt = String(m.invoiceDocType || "")
          .trim()
          .toUpperCase();
        if (dt !== "FCR" && dt !== "FCO") return false;
      }

      if (filterPartial) {
        const status = resolveFacturaStatus(m);
        if (status !== "PARCIAL") return false;
      }

      if (filterRebajadas) {
        if (resolveFacturaStatusLabel(m) !== "REBAJADA") return false;
      }

      if (q) {
        const haystack = [
          m.invoiceNumber,
          m.providerCode,
          providerNameByCode.get(m.providerCode) || "",
          m.notes,
          m.manager,
          m.paymentType,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    movements,
    filterProviderCode,
    filterPaymentType,
    docTypeFilter,
    fromFilter,
    toFilter,
    currentDailyKey,
    filterEditedOnly,
    filterPendingCredit,
    filterNCPending,
    filterPagada,
    filterPartial,
    filterRebajadas,
    hasActiveStatusFilter,
    searchQuery,
    providerDropdownQuery,
    typeDropdownQuery,
    docTypeDropdownQuery,
    providerNameByCode,
  ]);

  const handleOpenCreateMovement = async () => {
    if (!selectedCompany) {
      showToast(
        "Selecciona una empresa antes de agregar una factura.",
        "error",
        4000,
      );
      return;
    }

    if (user?.role === "user") {
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
          "[FACTURAS] Error checking control horario before opening drawer:",
          err,
        );
      }
    }
    resetCreateForm();
    setCreateDrawerOpen(true);
  };

  const hasDateRangeFilter =
    Boolean(fromFilter || toFilter) || hasActiveStatusFilter;
  const effectiveRowsPerPage = hasDateRangeFilter
    ? typeof rowsPerPage === "number"
      ? rowsPerPage
      : 10
    : rowsPerPage;
  const isDailyView = effectiveRowsPerPage === "daily";

  const totalPages = useMemo(() => {
    if (effectiveRowsPerPage === "daily") return 1;
    const total = Math.ceil(filteredMovements.length / effectiveRowsPerPage);
    return Math.max(1, total);
  }, [filteredMovements.length, effectiveRowsPerPage]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  useEffect(() => {
    setPageIndex(0);
    setCurrentDailyKey(dateKeyFromDate(new Date()));
  }, [
    filterProviderCode,
    filterPaymentType,
    docTypeFilter,
    searchQuery,
    fromFilter,
    toFilter,
    filterEditedOnly,
    selectedCompany,
    rowsPerPage,
  ]);

  const pagedMovements = useMemo(() => {
    if (isDailyView) {
      return filteredMovements.filter(
        (m) => dateKeyInCostaRica(m.createdAt) === currentDailyKey,
      );
    }
    const start = pageIndex * effectiveRowsPerPage;
    return filteredMovements.slice(start, start + effectiveRowsPerPage);
  }, [
    filteredMovements,
    pageIndex,
    effectiveRowsPerPage,
    currentDailyKey,
    isDailyView,
  ]);

  const pageRange = useMemo(() => {
    if (filteredMovements.length === 0) {
      return { from: 0, to: 0 };
    }
    if (isDailyView) {
      return { from: 1, to: filteredMovements.length };
    }
    const from = pageIndex * effectiveRowsPerPage + 1;
    const to = Math.min(
      filteredMovements.length,
      (pageIndex + 1) * effectiveRowsPerPage,
    );
    return { from, to };
  }, [filteredMovements.length, pageIndex, effectiveRowsPerPage, isDailyView]);
  /*-------------------Cambio de empresa-----------------------------------*/

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
    visibleCompanies.forEach((emp) => {
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
  }, [visibleCompanies]);

  const currentCompanyLabel = useMemo(() => {
    const selected = String(selectedCompany || "").trim();
    if (!selected) return "Sin empresa seleccionada";

    const match = sortedOwnerCompanies.find(
      (emp) => getCompanyKey(emp) === selected,
    );
    return match ? getCompanyLabel(match).split(" - ")[0] : selected;
  }, [selectedCompany, sortedOwnerCompanies, getCompanyKey, getCompanyLabel]);

  const handleAdminCompanyChange = useCallback((nextCompany: string) => {
    const value = String(nextCompany || "").trim();
    setSelectedCompany(value);
    try {
      const prev = localStorage.getItem(SHARED_COMPANY_STORAGE_KEY);
      localStorage.setItem(SHARED_COMPANY_STORAGE_KEY, value);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SHARED_COMPANY_STORAGE_KEY,
          newValue: value,
          oldValue: prev,
          storageArea: localStorage,
        }),
      );
    } catch (error) {
      console.error("Error saving selected company to localStorage:", error);
    }
  }, []);

  const formatMovementDateTime = useCallback((value: string) => {
    try {
      const d = new Date(String(value || ""));
      if (Number.isNaN(d.getTime())) return { date: "--/--/--", time: "--:--" };

      const date = new Intl.DateTimeFormat("es-CR", {
        dateStyle: "short",
      }).format(d);
      const time = new Intl.DateTimeFormat("es-CR", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(d);

      return { date, time };
    } catch {
      return { date: "--/--/--", time: "--:--" };
    }
  }, []);

  const providerInitials = useCallback((value: string) => {
    const clean = String(value || "").trim();
    if (!clean) return "?";
    const pieces = clean.split(/\s+/).filter(Boolean);
    if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase();
    return `${pieces[0]?.[0] ?? ""}${pieces[1]?.[0] ?? ""}`.toUpperCase();
  }, []);

  const providerTone = useCallback((value: string) => {
    const key = String(value || "")
      .trim()
      .toLowerCase();
    const palette = [
      "from-slate-600 to-slate-800 text-slate-50",
      "from-cyan-600 to-sky-700 text-slate-50",
      "from-emerald-600 to-teal-700 text-slate-50",
      "from-amber-600 to-orange-700 text-slate-50",
      "from-violet-600 to-fuchsia-700 text-slate-50",
    ];
    let sum = 0;
    for (let index = 0; index < key.length; index += 1) {
      sum += key.charCodeAt(index);
    }
    return palette[sum % palette.length];
  }, []);

  const statusTone = useCallback((status: string) => {
    switch (status) {
      case "PAGADA":
        return "border-emerald-400/55 bg-emerald-500/22 text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]";
      case "REBAJADA":
        return "border-cyan-400/50 bg-cyan-500/18 text-cyan-50 shadow-[0_0_0_1px_rgba(6,182,212,0.10)]";
      case "PARCIAL":
        return "border-amber-400/55 bg-amber-500/20 text-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.10)]";
      case "PENDIENTE":
        return "border-amber-400/55 bg-amber-500/18 text-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.10)]";
      default:
        return "border-slate-400/45 bg-slate-500/18 text-slate-100";
    }
  }, []);

  const registerPaymentTone = pendingCierreDeCaja
    ? "border-red-500/35 bg-red-500/12 text-red-100 hover:border-red-400/45 hover:bg-red-500/18"
    : "border-amber-500/45 bg-amber-500/14 text-amber-100 hover:border-amber-300/55 hover:bg-amber-500/22";

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.05),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.03),_transparent_26%),linear-gradient(180deg,_#0b0f16_0%,_#0d1117_42%,_#10151d_100%)] px-3 py-4 text-[var(--foreground)] sm:px-4 lg:px-6 lg:py-6">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        <section className="relative z-30 overflow-visible rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)]/82 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="space-y-4 border-b border-[var(--input-border)] p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.1fr_0.95fr_0.95fr_1.15fr_auto_auto]">
              <div className="relative min-w-0" ref={providerDropdownRef}>
                <input
                  type="text"
                  value={providerDropdownQuery}
                  onChange={(event) => {
                    setProviderDropdownQuery(event.target.value);
                    setFilterProviderCode("all");
                    setProviderFilter("");
                    setIsProviderDropdownOpen(true);
                  }}
                  onFocus={() => setIsProviderDropdownOpen(true)}
                  placeholder={
                    providersLoading ? "Cargando proveedores..." : "Proveedor"
                  }
                  className="h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 pr-10 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-cyan-500/45 focus:ring-2 focus:ring-cyan-500/20"
                  aria-label="Proveedor"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/8 text-cyan-300/90">
                  <Search className="h-4 w-4" />
                </span>
                {isProviderDropdownOpen && (
                  <div className="absolute z-[90] mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl shadow-black/50">
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-cyan-500/8"
                      onMouseDown={() => {
                        setFilterProviderCode("all");
                        setProviderFilter("");
                        setProviderDropdownQuery("");
                        setIsProviderDropdownOpen(false);
                      }}
                    >
                      Todos los proveedores
                    </button>
                    {providers
                      .filter((provider) => {
                        const needle = providerDropdownQuery
                          .trim()
                          .toLowerCase();
                        if (!needle) return true;
                        return `${provider.name} ${provider.code}`
                          .toLowerCase()
                          .includes(needle);
                      })
                      .slice(0, 24)
                      .map((provider) => (
                        <button
                          key={provider.code}
                          type="button"
                          className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-cyan-500/8 ${
                            filterProviderCode === provider.code
                              ? "bg-cyan-500/10 text-[var(--foreground)]"
                              : "text-[var(--foreground)]/90"
                          }`}
                          onMouseDown={() => {
                            setFilterProviderCode(provider.code);
                            setProviderFilter(
                              `${provider.name} (${provider.code})`,
                            );
                            setProviderDropdownQuery(
                              `${provider.name} (${provider.code})`,
                            );
                            setIsProviderDropdownOpen(false);
                          }}
                        >
                          {provider.name} ({provider.code})
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="relative min-w-0" ref={typeDropdownRef}>
                <input
                  type="text"
                  value={typeDropdownQuery}
                  onChange={(event) => {
                    setTypeDropdownQuery(event.target.value);
                    setFilterPaymentType("all");
                    setTypeFilter("");
                    setIsTypeDropdownOpen(true);
                  }}
                  onFocus={() => setIsTypeDropdownOpen(true)}
                  placeholder="Tipo movimiento"
                  className="h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 pr-10 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-cyan-500/45 focus:ring-2 focus:ring-cyan-500/20"
                  aria-label="Tipo movimiento"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/8 text-cyan-300/90">
                  <Search className="h-4 w-4" />
                </span>
                {isTypeDropdownOpen && (
                  <div className="absolute z-[90] mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl shadow-black/50">
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-cyan-500/8"
                      onMouseDown={() => {
                        setFilterPaymentType("all");
                        setTypeFilter("");
                        setTypeDropdownQuery("");
                        setIsTypeDropdownOpen(false);
                      }}
                    >
                      Todos los tipos
                    </button>
                    {movementTypes
                      .filter((type) => {
                        const needle = typeDropdownQuery.trim().toLowerCase();
                        if (!needle) return true;
                        return formatMovementType(type)
                          .toLowerCase()
                          .includes(needle);
                      })
                      .slice(0, 30)
                      .map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-cyan-500/8 ${
                            filterPaymentType === type
                              ? "bg-cyan-500/10 text-[var(--foreground)]"
                              : "text-[var(--foreground)]/90"
                          }`}
                          onMouseDown={() => {
                            setFilterPaymentType(type);
                            setTypeFilter(formatMovementType(type));
                            setTypeDropdownQuery(formatMovementType(type));
                            setIsTypeDropdownOpen(false);
                          }}
                        >
                          {formatMovementType(type)}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="relative min-w-0" ref={docTypeDropdownRef}>
                <input
                  type="text"
                  value={docTypeDropdownQuery}
                  onChange={(event) => {
                    setDocTypeDropdownQuery(event.target.value);
                    setDocTypeFilter("all");
                    setDocTypeFilterLabel("");
                    setIsDocTypeDropdownOpen(true);
                  }}
                  onFocus={() => setIsDocTypeDropdownOpen(true)}
                  placeholder="Documento"
                  className="h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 pr-10 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-cyan-500/45 focus:ring-2 focus:ring-cyan-500/20"
                  aria-label="Documento"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/8 text-cyan-300/90">
                  <Search className="h-4 w-4" />
                </span>
                {isDocTypeDropdownOpen && (
                  <div className="absolute z-[90] mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl shadow-black/50">
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-cyan-500/8"
                      onMouseDown={() => {
                        setDocTypeFilter("all");
                        setDocTypeFilterLabel("");
                        setDocTypeDropdownQuery("");
                        setIsDocTypeDropdownOpen(false);
                      }}
                    >
                      Todos los documentos
                    </button>
                    {[
                      { value: "FCR", label: "Factura a Credito" },
                      { value: "NC", label: "Nota de Credito" },
                      { value: "FCO", label: "Factura a Contado" },
                    ]
                      .filter((item) => {
                        const needle = docTypeDropdownQuery
                          .trim()
                          .toLowerCase();
                        if (!needle) return true;
                        return `${item.label} ${item.value}`
                          .toLowerCase()
                          .includes(needle);
                      })
                      .map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-cyan-500/8 ${
                            docTypeFilter === item.value
                              ? "bg-cyan-500/10 text-[var(--foreground)]"
                              : "text-[var(--foreground)]/90"
                          }`}
                          onMouseDown={() => {
                            setDocTypeFilter(
                              item.value as "FCR" | "NC" | "FCO",
                            );
                            setDocTypeFilterLabel(item.label);
                            setDocTypeDropdownQuery(item.label);
                            setIsDocTypeDropdownOpen(false);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="relative min-w-0">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar factura, notas..."
                  className="h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 pr-11 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-cyan-500/45 focus:ring-2 focus:ring-cyan-500/20"
                  aria-label="Buscar movimientos"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/8 text-cyan-300/90">
                  <Search className="h-4 w-4" />
                </span>
              </div>

              <div className="relative min-w-0" ref={filtersDropdownRef}>
                <button
                  type="button"
                  onClick={() => setFiltersDropdownOpen((prev) => !prev)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/8 px-4 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-500/45 hover:bg-cyan-500/12"
                  aria-haspopup="menu"
                  aria-expanded={filtersDropdownOpen}
                  title="Vista"
                >
                  <Eye className="h-4 w-4" />
                  <span>Vista</span>
                </button>

                {filtersDropdownOpen && (
                  <div className="absolute left-0 top-full z-[95] mt-2 w-[300px] rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                      <input
                        type="checkbox"
                        checked={filterPendingCredit}
                        onChange={(event) =>
                          setFilterPendingCredit(event.target.checked)
                        }
                        className="h-4 w-4 accent-amber-400"
                      />
                      <FileText className="h-4 w-4 shrink-0 text-amber-300/90" />
                      <span className="leading-tight">
                        Facturas de crédito pendientes
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                      <input
                        type="checkbox"
                        checked={filterNCPending}
                        onChange={(event) =>
                          setFilterNCPending(event.target.checked)
                        }
                        className="h-4 w-4 accent-cyan-400"
                      />
                      <BadgeCheck className="h-4 w-4 shrink-0 text-cyan-300/90" />
                      <span className="leading-tight">
                        Notas de crédito pendientes
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                      <input
                        type="checkbox"
                        checked={filterPagada}
                        onChange={(event) =>
                          setFilterPagada(event.target.checked)
                        }
                        className="h-4 w-4 accent-emerald-400"
                      />
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-300/90" />
                      <span className="leading-tight">Pagadas</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                      <input
                        type="checkbox"
                        checked={filterPartial}
                        onChange={(event) =>
                          setFilterPartial(event.target.checked)
                        }
                        className="h-4 w-4 accent-amber-400"
                      />
                      <Clock className="h-4 w-4 shrink-0 text-amber-300/90" />
                      <span className="leading-tight">Parciales</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                      <input
                        type="checkbox"
                        checked={filterRebajadas}
                        onChange={(event) =>
                          setFilterRebajadas(event.target.checked)
                        }
                        className="h-4 w-4 accent-emerald-400"
                      />
                      <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-300/90" />
                      <span className="leading-tight">Rebajadas</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                      <input
                        type="checkbox"
                        checked={filterEditedOnly}
                        onChange={(event) =>
                          setFilterEditedOnly(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-[var(--input-border)] accent-[var(--accent)]"
                      />
                      <Pencil className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                      <span>Editadas</span>
                    </label>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setFilterProviderCode("all");
                  setProviderFilter("");
                  setProviderDropdownQuery("");
                  setFilterPaymentType("all");
                  setTypeFilter("");
                  setTypeDropdownQuery("");
                  setDocTypeFilter("all");
                  setDocTypeFilterLabel("");
                  setDocTypeDropdownQuery("");
                  setFilterEditedOnly(false);
                  setFilterPendingCredit(false);
                  setFilterNCPending(false);
                  setFilterPagada(false);
                  setFilterPartial(false);
                  setFilterRebajadas(false);
                  setSearchQuery("");
                  setFromFilter(null);
                  setToFilter(null);
                  setQuickRange(null);
                  setCalendarFromOpen(false);
                  setCalendarToOpen(false);
                  setIsProviderDropdownOpen(false);
                  setIsTypeDropdownOpen(false);
                  setIsDocTypeDropdownOpen(false);
                  setFiltersDropdownOpen(false);
                  const month = new Date();
                  month.setDate(1);
                  month.setHours(0, 0, 0, 0);
                  setCalendarFromMonth(new Date(month));
                  setCalendarToMonth(new Date(month));
                  setPageIndex(0);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-cyan-500/45 hover:bg-cyan-500/8"
                title="Limpiar"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Limpiar</span>
              </button>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Desde
                  </label>
                  <button
                    type="button"
                    ref={fromButtonRef}
                    onClick={() => setCalendarFromOpen((prev) => !prev)}
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 text-sm text-[var(--foreground)] transition-colors hover:border-cyan-500/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20"
                  >
                    <span className="text-[var(--foreground)]/90">
                      {fromFilter
                        ? formatKeyToDisplay(fromFilter)
                        : "dd/mm/yyyy"}
                    </span>
                    <CalendarDays className="h-4 w-4 text-cyan-300/85" />
                  </button>
                  {calendarFromOpen && (
                    <div
                      ref={fromCalendarRef}
                      className="absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] sm:w-72"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-2xl shadow-black/50">
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const m = new Date(calendarFromMonth);
                              m.setMonth(m.getMonth() - 1);
                              setCalendarFromMonth(new Date(m));
                            }}
                            className="rounded p-1 hover:bg-[var(--muted)]"
                          >
                            <ChevronLeft className="h-4 w-4" />
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
                            className="rounded p-1 hover:bg-[var(--muted)]"
                          >
                            <ChevronRight className="h-4 w-4" />
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
                               const enabled = key <= effectiveTodayKey;
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
                                      setPageIndex(0);
                                    }}
                                    className={`rounded py-1 ${isSelected ? "bg-cyan-500 text-white" : "hover:bg-[var(--muted)]"}`}
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
                              setQuickRange(null);
                              setFromFilter(null);
                              setCalendarFromOpen(false);
                            }}
                            className="rounded border border-[var(--input-border)] px-2 py-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                          >
                            Limpiar
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarFromOpen(false)}
                            className="rounded border border-[var(--input-border)] px-2 py-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Hasta
                  </label>
                  <button
                    type="button"
                    ref={toButtonRef}
                    onClick={() => setCalendarToOpen((prev) => !prev)}
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 text-sm text-[var(--foreground)] transition-colors hover:border-cyan-500/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20"
                  >
                    <span className="text-[var(--foreground)]/90">
                      {toFilter ? formatKeyToDisplay(toFilter) : "dd/mm/yyyy"}
                    </span>
                    <CalendarDays className="h-4 w-4 text-cyan-300/85" />
                  </button>
                  {calendarToOpen && (
                    <div
                      ref={toCalendarRef}
                      className="absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] sm:w-72"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-2xl shadow-black/50">
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const m = new Date(calendarToMonth);
                              m.setMonth(m.getMonth() - 1);
                              setCalendarToMonth(new Date(m));
                            }}
                            className="rounded p-1 hover:bg-[var(--muted)]"
                          >
                            <ChevronLeft className="h-4 w-4" />
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
                            className="rounded p-1 hover:bg-[var(--muted)]"
                          >
                            <ChevronRight className="h-4 w-4" />
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
                               const enabled = key <= effectiveTodayKey;
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
                                      setPageIndex(0);
                                    }}
                                    className={`rounded py-1 ${isSelected ? "bg-cyan-500 text-white" : "hover:bg-[var(--muted)]"}`}
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
                              setQuickRange(null);
                              setToFilter(null);
                              setCalendarToOpen(false);
                            }}
                            className="rounded border border-[var(--input-border)] px-2 py-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                          >
                            Limpiar
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarToOpen(false)}
                            className="rounded border border-[var(--input-border)] px-2 py-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Filtro
                  </label>
                  <select
                    className="h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-cyan-500/45 focus:border-cyan-500/45"
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
                        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                        from = new Date(now.setDate(diff));
                        to = new Date();
                      } else if (v === "lastweek") {
                        const day = now.getDay();
                        const diff =
                          now.getDate() - day + (day === 0 ? -6 : 1) - 7;
                        from = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          diff,
                        );
                        to = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          diff + 6,
                        );
                      } else if (v === "lastmonth") {
                        from = new Date(
                          now.getFullYear(),
                          now.getMonth() - 1,
                          1,
                        );
                        to = new Date(now.getFullYear(), now.getMonth(), 0);
                      } else if (v === "month") {
                        from = new Date(now.getFullYear(), now.getMonth(), 1);
                        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)]/75 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="shrink-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {user?.role === "user"
                        ? "Empresa asignada"
                        : "Empresa actual"}
                    </p>

                    <p
                      className="text-sm font-semibold text-[var(--foreground)]"
                      title={currentCompanyLabel}
                    >
                      {currentCompanyLabel}
                    </p>
                  </div>

                  {availableCompaniesError && (
                    <p className="text-xs text-red-300">
                      {availableCompaniesError}
                    </p>
                  )}

                  {user?.role !== "user" && (
                    <select
                      id={companySelectId}
                      value={selectedCompany}
                      onChange={(e) => handleAdminCompanyChange(e.target.value)}
                      disabled={
                        availableCompaniesLoading ||
                        sortedOwnerCompanies.length === 0
                      }
                      className="ml-auto h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/45 focus:border-[var(--accent)]/45 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[200px] sm:w-auto lg:min-w-[260px]"
                    >
                      {availableCompaniesLoading && (
                        <option value="">Cargando empresas...</option>
                      )}

                      {!availableCompaniesLoading &&
                        sortedOwnerCompanies.length === 0 && (
                          <option value="">Sin empresas disponibles</option>
                        )}

                      {!availableCompaniesLoading &&
                        sortedOwnerCompanies.length > 0 && (
                          <>
                            <option value="" disabled hidden>
                              Selecciona una empresa
                            </option>

                            {sortedOwnerCompanies.map((emp, index) => (
                              <option
                                key={
                                  emp.id ||
                                  emp.name ||
                                  emp.ubicacion ||
                                  `company-${index}`
                                }
                                value={getCompanyKey(emp)}
                              >
                                {getCompanyLabel(emp)}
                              </option>
                            ))}
                          </>
                        )}
                    </select>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenCreateMovement}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-gradient-to-r from-cyan-600 to-sky-700 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(8,145,178,0.28)] transition-transform hover:translate-y-[-1px] hover:from-cyan-500 hover:to-sky-600 sm:w-auto sm:shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>Agregar FC/NC</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)]/82 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-[var(--input-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                Facturas ({filteredMovements.length})
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Mostrando {pageRange.from}-{pageRange.to} de{" "}
                {filteredMovements.length}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 text-sm text-[var(--foreground)]">
              <span className="self-start rounded-full border border-[var(--input-border)] bg-[var(--muted)]/20 px-3 py-1.5 text-xs font-semibold tracking-wide text-[var(--foreground)]/90">
                {movementsLoading ? "Cargando..." : currentCompanyLabel}
              </span>
              <div className="flex w-full items-center gap-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] px-1.5 py-1 sm:w-auto sm:gap-2 sm:px-2 sm:py-1.5">
                <select
                  value={isDailyView ? "daily" : String(effectiveRowsPerPage)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "daily") {
                      setRowsPerPage("daily");
                      setCurrentDailyKey(dateKeyFromDate(new Date()));
                    } else {
                      setRowsPerPage(Number(v));
                    }
                    setPageIndex(0);
                  }}
                  className="h-7 min-w-0 flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-1.5 text-[10px] text-[var(--foreground)] outline-none transition-colors hover:border-cyan-500/45 sm:h-8 sm:flex-initial sm:px-2 sm:text-xs"
                  aria-label="Filas por pagina"
                >
                  <option value="daily" disabled={hasDateRangeFilter}>
                    Diariamente
                  </option>
                  {[5, 10, 20].map((size) => (
                    <option key={size} value={size}>
                      {size} por pagina
                    </option>
                  ))}
                </select>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isDailyView) {
                        setCurrentDailyKey((prev) => {
                          if (prev <= "1970-01-01") return "1970-01-01";
                          const d = new Date(prev + "T12:00:00");
                          d.setDate(d.getDate() - 1);
                          return dateKeyFromDate(d);
                        });
                      } else {
                        setPageIndex((prev) => Math.max(0, prev - 1));
                      }
                    }}
                    disabled={
                      isDailyView
                        ? currentDailyKey <= "1970-01-01"
                        : pageIndex === 0
                    }
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--input-border)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/45 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                  <span className="min-w-[52px] text-center text-[10px] text-[var(--muted-foreground)] sm:min-w-[96px] sm:text-xs">
                    {isDailyView
                      ? formatKeyToDisplay(currentDailyKey)
                      : `${pageIndex + 1} / ${totalPages}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isDailyView) {
                        setCurrentDailyKey((prev) => {
                           if (prev >= effectiveTodayKey) return effectiveTodayKey;
                          const d = new Date(prev + "T12:00:00");
                          d.setDate(d.getDate() + 1);
                          const next = dateKeyFromDate(d);
                           return next > effectiveTodayKey ? effectiveTodayKey : next;
                        });
                      } else {
                        setPageIndex((prev) =>
                          Math.min(totalPages - 1, prev + 1),
                        );
                      }
                    }}
                    disabled={
                      isDailyView
                        ? currentDailyKey >= effectiveTodayKey
                        : pageIndex >= totalPages - 1
                    }
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--input-border)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/45 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
                  >
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  <th className="border-b border-[var(--input-border)] px-4 py-3 font-semibold">
                    Fecha
                  </th>
                  <th className="border-b border-[var(--input-border)] px-4 py-3 font-semibold">
                    Proveedor
                  </th>
                  <th className="border-b border-[var(--input-border)] px-4 py-3 font-semibold">
                    N° Factura
                  </th>
                  <th className="border-b border-[var(--input-border)] px-4 py-3 font-semibold">
                    Tipo pago
                  </th>
                  <th className="border-b border-[var(--input-border)] px-4 py-3 text-right font-semibold">
                    Monto
                  </th>
                  <th className="border-b border-[var(--input-border)] px-4 py-3 font-semibold">
                    Estado
                  </th>
                  <th className="border-b border-[var(--input-border)] px-4 py-3 text-right font-semibold">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {movementsLoading ? (
                  <>
                    <tr className="bg-cyan-500/5">
                      <td colSpan={7} className="px-4 py-2">
                        <div className="h-4 w-44 animate-pulse rounded bg-cyan-100/10" />
                      </td>
                    </tr>
                    {Array.from({ length: 6 }, (_, i) => i).map((row) => (
                      <tr
                        key={row}
                        className="[&>td]:border-b [&>td]:border-[var(--input-border)]/60"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 animate-pulse rounded-xl bg-cyan-100/10" />
                            <div className="space-y-2">
                              <div className="h-4 w-20 animate-pulse rounded bg-cyan-100/10" />
                              <div className="h-3 w-14 animate-pulse rounded bg-cyan-100/5" />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-2">
                            <div className="h-4 w-36 animate-pulse rounded bg-cyan-100/10" />
                            <div className="h-3 w-48 animate-pulse rounded bg-cyan-100/5" />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-16 animate-pulse rounded bg-cyan-100/10" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-6 w-24 animate-pulse rounded bg-cyan-100/10" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="ml-auto h-6 w-28 animate-pulse rounded bg-cyan-100/10" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-6 w-20 animate-pulse rounded-full bg-cyan-100/10" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="ml-auto h-8 w-28 animate-pulse rounded-xl bg-cyan-100/10" />
                        </td>
                      </tr>
                    ))}
                  </>
                ) : (
                  pagedMovements.map((movement) => {
                    const amount = Math.abs(Number(movement.amount) || 0);
                    const signedAmount =
                      String(movement.invoiceDocType || "")
                        .trim()
                        .toUpperCase() === "NC"
                        ? -amount
                        : amount;
                    const amountLabel = signedAmount.toLocaleString("es-CR", {
                      style: "currency",
                      currency: movement.currency,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    });
                    const paymentStatus = resolveFacturaStatus(movement);
                    const paymentStatusLabel =
                      resolveFacturaStatusLabel(movement);
                    const paymentBalance = resolveFacturaBalance(movement);
                    const isPaid = paymentBalance === 0;
                    const canEditZeroNC =
                      String(movement.invoiceDocType || "")
                        .trim()
                        .toUpperCase() === "NC" &&
                      Math.max(0, Math.trunc(Number(movement.amount) || 0)) ===
                        0 &&
                      paymentStatus === "PENDIENTE" &&
                      Math.max(
                        0,
                        Math.trunc(Number(movement.zeroAmountEditCount) || 0),
                      ) === 0;
                    const providerName =
                      providerNameByCode.get(movement.providerCode) ||
                      movement.providerCode;
                    const dateParts = formatMovementDateTime(
                      movement.createdAt,
                    );

                    return (
                      <tr
                        key={movement.id}
                        className="transition-colors hover:bg-[var(--muted)]/15 [&>td]:border-b [&>td]:border-[var(--input-border)]/60"
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--foreground)]/90">
                              <CalendarDays className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-[var(--foreground)]">
                                {dateParts.date}
                              </div>
                              <div className="text-xs text-[var(--muted-foreground)]">
                                {dateParts.time}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-semibold shadow-sm ${providerTone(providerName)}`}
                            >
                              {providerInitials(providerName)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[var(--foreground)]">
                                {providerName}
                              </div>
                              <div className="truncate text-xs text-[var(--muted-foreground)]">
                                {movement.providerCode}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-[var(--foreground)]">
                          {movement.invoiceNumber}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-[var(--foreground)]">
                          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--input-border)] bg-[var(--muted)]/18 px-3 py-1.5 font-medium">
                            <ShoppingCart className="h-3.5 w-3.5 text-cyan-300/90" />
                            {formatMovementType(movement.paymentType)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-right text-sm font-semibold tabular-nums text-[var(--foreground)]">
                          {amountLabel} {movement.currency}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            <span className="inline-flex w-fit items-center rounded-full border border-[var(--input-border)] bg-[var(--muted)]/20 px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                              {formatInvoiceDocTypeLabel(
                                movement.invoiceDocType,
                              )}
                            </span>
                            <span
                              className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(paymentStatus)}`}
                            >
                              {paymentStatus === "PAGADA" && (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              {paymentStatus === "PARCIAL" && (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                              {paymentStatus === "PENDIENTE" && (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                              <span>{paymentStatusLabel}</span>
                            </span>
                            {movement.invoiceDocType === "FCR" &&
                              paymentBalance > 0 && (
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--input-border)] bg-[var(--muted)]/20 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Saldo:{" "}
                                  {paymentBalance.toLocaleString("es-CR", {
                                    style: "currency",
                                    currency: movement.currency,
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="border-b border-[var(--input-border)]/60 px-4 py-4 align-top text-right">
                          {movement.invoiceDocType === "FCR" && !isPaid ? (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(movement)}
                              disabled={pendingCierreDeCaja}
                              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${registerPaymentTone}`}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              {pendingCierreDeCaja
                                ? "Bloqueado"
                                : "Registrar Abono"}
                            </button>
                          ) : canEditZeroNC ? (
                            <button
                              type="button"
                              onClick={() => openEditZeroNCModal(movement)}
                              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/45 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/20"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar monto
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--muted-foreground)]">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}

                {!movementsLoading && filteredMovements.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-[var(--muted-foreground)]"
                    >
                      No hay facturas para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {paymentModalOpen && paymentTarget && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 px-3 py-6 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl shadow-black/60">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--input-border)] px-4 py-4 sm:px-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Pago de factura crédito
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                    {paymentTarget.invoiceNumber}
                  </h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {providerNameByCode.get(paymentTarget.providerCode) ||
                      paymentTarget.providerCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="rounded-full border border-[var(--input-border)] p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/20 hover:text-[var(--foreground)]"
                  aria-label="Cerrar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                className="space-y-4 px-4 py-4 sm:px-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitPayment("partial");
                }}
              >
                <div className="grid gap-3 rounded-xl border border-[var(--input-border)] bg-[var(--muted)]/10 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Monto total
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {Math.max(
                        0,
                        Math.trunc(Number(paymentTarget.amount) || 0),
                      ).toLocaleString("es-CR", {
                        style: "currency",
                        currency: paymentTarget.currency,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Pagado
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {selectedPaymentPaid.toLocaleString("es-CR", {
                        style: "currency",
                        currency: paymentTarget.currency,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Saldo
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {selectedPaymentBalance.toLocaleString("es-CR", {
                        style: "currency",
                        currency: paymentTarget.currency,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-[var(--foreground)]">
                    <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Monto a pagar o abonar
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        paymentAmount
                          ? Math.trunc(Number(paymentAmount)).toLocaleString(
                              "es-CR",
                              {
                                style: "currency",
                                currency: paymentTarget.currency,
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              },
                            )
                          : ""
                      }
                      onChange={(event) =>
                        setPaymentAmount(event.target.value.replace(/\D/g, ""))
                      }
                      className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-[var(--foreground)]">
                    <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Encargado
                    </span>
                    <select
                      value={paymentManager2}
                      onChange={(event) =>
                        setPaymentManager2(event.target.value)
                      }
                      disabled={employeesLoading}
                      className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Sin encargado</option>
                      {employeesLoading && (
                        <option value="">Cargando empleados...</option>
                      )}
                      {!employeesLoading &&
                        paymentEmployeeOptions.length === 0 && (
                          <option value="">No hay empleados registrados</option>
                        )}
                      {!employeesLoading &&
                        paymentEmployeeOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <label className="block space-y-1 text-sm text-[var(--foreground)]">
                  <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Observación
                  </span>
                  <textarea
                    rows={4}
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    placeholder="Agregue o edite la observación"
                    className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </label>

                <div className="flex flex-col-reverse gap-2 border-t border-[var(--input-border)] pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="inline-flex items-center justify-center rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitPayment("partial")}
                    disabled={paymentSubmitting || selectedPaymentBalance <= 0}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CreditCard className="h-4 w-4" />
                    {paymentSubmitting ? "Guardando..." : "Registrar Abono"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editZeroNCTarget && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 px-3 py-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl shadow-black/60">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--input-border)] px-4 py-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Nota de credito pendiente
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                    {editZeroNCTarget.invoiceNumber}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeEditZeroNCModal}
                  className="rounded-full border border-[var(--input-border)] p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/20 hover:text-[var(--foreground)]"
                  aria-label="Cerrar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form
                className="space-y-4 px-4 py-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitEditZeroNCAmount();
                }}
              >
                {editZeroNCError && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {editZeroNCError}
                  </div>
                )}
                <label className="block space-y-1 text-sm text-[var(--foreground)]">
                  <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Monto
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editZeroNCAmount}
                    onChange={(event) =>
                      setEditZeroNCAmount(event.target.value.replace(/\D/g, ""))
                    }
                    placeholder="0"
                    disabled={editZeroNCSubmitting}
                    className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </label>
                <div className="flex justify-end gap-2 border-t border-[var(--input-border)] pt-4">
                  <button
                    type="button"
                    onClick={closeEditZeroNCModal}
                    disabled={editZeroNCSubmitting}
                    className="inline-flex items-center justify-center rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editZeroNCSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {editZeroNCSubmitting ? "Guardando..." : "Guardar monto"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {pendingCierreModalOpen && (
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
        )}

        {confirmZeroNCOpen && (
          <ConfirmModal
            open={confirmZeroNCOpen}
            title="Guardar NC en monto 0"
            message="La nota de credito quedara pendiente con monto 0. Luego se podra editar solo el monto una unica vez. ¿Deseas continuar?"
            confirmText="Guardar en 0"
            cancelText="Cancelar"
            onCancel={() => setConfirmZeroNCOpen(false)}
            onConfirm={() => {
              setConfirmZeroNCOpen(false);
              void submitCreateMovement(true);
            }}
          />
        )}

        <ConfirmModal
          open={missingShiftModalOpen}
          title="Turno no asignado"
          message={`No se cuenta con un turno (${missingShiftExpectedShift}) asignado para ${missingShiftDateKey || "hoy"}. Debes asignarlo en Control Horario para continuar.`}
          confirmText="Ir a Control Horario"
          cancelText="Cancelar"
          actionType="change"
          onConfirm={() => {
            setMissingShiftModalOpen(false);
            setCreateDrawerOpen(false);
            window.location.hash = "#controlhorario";
          }}
          onCancel={() => setMissingShiftModalOpen(false)}
        />

        <CreateInvoiceDrawer
          open={createDrawerOpen}
          onClose={handleCloseCreateDrawer}
          currentCompanyLabel={currentCompanyLabel}
          createFormError={createFormError}
          onSubmit={submitCreateMovement}
          createProviderCode={createProviderCode}
          setCreateProviderCode={setCreateProviderCode}
          createProviderFilter={createProviderFilter}
          setCreateProviderFilter={setCreateProviderFilter}
          createOnlyInventoryProviders={createOnlyInventoryProviders}
          setCreateOnlyInventoryProviders={setCreateOnlyInventoryProviders}
          isCreateProviderDropdownOpen={isCreateProviderDropdownOpen}
          setIsCreateProviderDropdownOpen={setIsCreateProviderDropdownOpen}
          createSubmitting={createSubmitting}
          providersLoading={providersLoading}
          filteredCreateProviders={filteredCreateProviders}
          createPaymentType={createPaymentType}
          createInvoiceNumber={createInvoiceNumber}
          setCreateInvoiceNumber={setCreateInvoiceNumber}
          createInvoiceDocType={createInvoiceDocType}
          setCreateInvoiceDocType={setCreateInvoiceDocType}
          createCurrency={createCurrency}
          setCreateCurrency={setCreateCurrency}
          createAmount={createAmount}
          setCreateAmount={setCreateAmount}
          createManager={createManager}
          setCreateManager={setCreateManager}
          managerSelectDisabled={createManagerLockedByShift}
          employeesLoading={employeesLoading}
          paymentEmployeeOptions={paymentEmployeeOptions}
          createNotes={createNotes}
          setCreateNotes={setCreateNotes}
          formatMovementType={formatMovementType}
        />
      </div>
    </div>
  );
}
