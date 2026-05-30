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
import CreateInvoiceDrawer from "./CreateInvoiceDrawer";
import ConfirmModal from "@/components/ui/ConfirmModal";

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
    return (value.map((v) => stripUndefinedDeep(v)).filter((v) => v !== undefined) as any) as T;
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

const dateKeyFromIso = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return dateKeyFromDate(d);
};

const formatKeyToDisplay = (key: string): string => {
  const parts = String(key || "").split("-");
  if (parts.length !== 3) return key;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
};

const resolveFacturaPaidAmount = (movement: FacturaMovement): number => {
  const amount = Math.max(0, Math.trunc(Number(movement.amount) || 0));
  if (String(movement.invoiceDocType || "").trim().toUpperCase() === "FCO") {
    return amount;
  }
  const paidAmount = Math.max(0, Math.trunc(Number(movement.paidAmount) || 0));
  return Math.min(amount, paidAmount);
};

const resolveFacturaBalance = (movement: FacturaMovement): number => {
  const amount = Math.max(0, Math.trunc(Number(movement.amount) || 0));
  if (String(movement.invoiceDocType || "").trim().toUpperCase() === "FCO") {
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
  if (String(movement.invoiceDocType || "").trim().toUpperCase() === "FCO") {
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
    String(movement.invoiceDocType || "").trim().toUpperCase() === "NC"
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

  // Filter state (mirrors Fondo toolbar names)
  const [providerFilter, setProviderFilter] = useState("");
  const [filterProviderCode, setFilterProviderCode] = useState<string>("all");
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState("");
  const [filterPaymentType, setFilterPaymentType] = useState<string>("all");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const [docTypeFilter, setDocTypeFilter] = useState<"all" | "FCR" | "NC" | "FCO">(
    "all",
  );
  const [docTypeFilterLabel, setDocTypeFilterLabel] = useState("");
  const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterEditedOnly, setFilterEditedOnly] = useState(false);
  const [filterPendingCredit, setFilterPendingCredit] = useState(false);
  const [filterNCPending, setFilterNCPending] = useState(false);
  const [filterPagada, setFilterPagada] = useState(false);
  const [filterPartial, setFilterPartial] = useState(false);
  const [filterRebajadas, setFilterRebajadas] = useState(false);
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
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {
      fecha: "80px",
      proveedor: "250px",
      factura: "120px",
      tipo: "160px",
      monto: "140px",
      estado: "200px",
      accion: "140px",
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
  });
  const resizingRef = React.useRef<{ key: string; startX: number; startWidth: number } | null>(null);

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
        localStorage.setItem("facturas-columnWidths", JSON.stringify(columnWidths));
      }
    } catch {
      // ignore storage errors
    }
  }, [columnWidths]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);
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

  const loadMovements = useCallback(async (companyName: string) => {
    if (!companyName) {
      setMovements([]);
      return;
    }

    setMovementsLoading(true);
    try {
      const data = await FacturasService.listMovementsByEmpresa(companyName, {
        limit: 800,
      });
      setMovements(data.filter((movement) => !isFacturaPaymentRecord(movement)));
    } finally {
      setMovementsLoading(false);
    }
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

  const submitCreateMovement = useCallback(async () => {
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
    if (amount <= 0) {
      setCreateFormError("Ingresa un monto mayor a cero.");
      return;
    }

    const manager = String(createManager || "").trim();
    if (!manager) {
      setCreateFormError("Selecciona un encargado.");
      return;
    }

    const nowISO = new Date().toISOString();
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
      manager,
      notes: String(createNotes || "").trim(),
      invoiceDocType: createInvoiceDocType,
      paymentType: createPaymentType || "FACTURA A CREDITO",
      providerCode,
      paidAmount: undefined,
      balanceDue: amount,
      paymentStatus: "PENDIENTE",
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
      preferred
        ? getCompanyKey(preferred)
        : getCompanyKey(visibleCompanies[0]),
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
    () => selectedPaymentBalance > 0 && enteredPaymentAmount === selectedPaymentBalance,
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
      // Update the invoice and register the actual payment only in Fondo General.
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
          baseStorage ?? MovimientosFondosService.createEmptyMovementStorage(selectedCompany);
        ledger.company = selectedCompany;
        // Do not persist operations array to main doc; movements are in subcollection
        ledger.operations = { movements: [] };

        // Adjust balances: subtract payment from currentBalance for the account/currency
        const state = ledger.state ?? MovimientosFondosService.createEmptyMovementStorage(selectedCompany).state;
        const acctKey = "FondoGeneral" as const;
        const currency = paymentMovement.currency as MovementCurrencyKey;
        const amountToApply = Math.trunc(paymentAmountToApply || 0);
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
        const mainRef = doc(db, MovimientosFondosService.COLLECTION_NAME, docId);
        batch.set(mainRef, stripUndefinedDeep(ledger) as any);
        // Persist movement in MovimientosFondos subcollection
        const movRef = MovimientosFondosService.buildMovementRef(
          docId,
          paymentMovementId,
          "FondoGeneral",
        );
        batch.set(movRef, stripUndefinedDeep(paymentMovement));

        await batch.commit();

        await loadMovements(selectedCompany);
        showToast(
          nextStatus === "PAGADA" ? "Factura pagada y movimiento generado." : "Abono registrado.",
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
        const docId = MovimientosFondosService.buildCompanyMovementsKey(
          selectedCompany,
        );
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
          if (provider?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME) {
            const created = String((m as any).createdAt || (m as any).updateAt || "");
            const parsed = Date.parse(created);
            if (!Number.isNaN(parsed) && parsed > cierreEntryTs) cierreEntryTs = parsed;
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
                if (!Number.isNaN(ts) && ts > latestDailyClosingTs) latestDailyClosingTs = ts;
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
    FacturasService.listMovementsByEmpresa(selectedCompany, { limit: 800 })
      .then((data) => {
        if (cancelled) return;
        setMovements(data.filter((movement) => !isFacturaPaymentRecord(movement)));
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
  }, [selectedCompany, showToast]);

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
      } catch { /* ignore */ }
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
      { providerCode: string; providerName: string; count: number; crc: number; usd: number }
    >();

    for (const movement of movements) {
      if (String(movement.invoiceDocType || "").trim().toUpperCase() !== "FCR") {
        continue;
      }
      const balance = resolveFacturaBalance(movement);
      if (balance <= 0 || resolveFacturaStatus(movement) === "PAGADA") {
        continue;
      }
      const providerCode = movement.providerCode;
      const current =
        map.get(providerCode) ??
        {
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
        ? pendingSupplierAlerts.find(
            (item) => item.providerCode === filterProviderCode,
          ) ?? null
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

    return movements.filter((m) => {
      if (filterProviderCode !== "all" && m.providerCode !== filterProviderCode)
        return false;
      if (filterPaymentType !== "all" && m.paymentType !== filterPaymentType)
        return false;
      if (docTypeFilter !== "all" && m.invoiceDocType !== docTypeFilter)
        return false;

      if (fromFilter || toFilter) {
        const key = dateKeyFromIso(m.createdAt);
        if (fromFilter && key && key < fromFilter) return false;
        if (toFilter && key && key > toFilter) return false;
      }

      if (filterEditedOnly) {
        const anyAudit = Boolean((m as any).isAudit);
        if (!anyAudit) return false;
      }

      if (filterPendingCredit) {
        const status = resolveFacturaStatus(m);
        if (status !== "PENDIENTE") return false;
        if (String(m.invoiceDocType || "").trim().toUpperCase() !== "FCR") return false;
      }

      if (filterNCPending) {
        const status = resolveFacturaStatus(m);
        if (status !== "PENDIENTE") return false;
        if (String(m.invoiceDocType || "").trim().toUpperCase() !== "NC") return false;
      }

      if (filterPagada) {
        const status = resolveFacturaStatus(m);
        if (status !== "PAGADA") return false;
        const dt = String(m.invoiceDocType || "").trim().toUpperCase();
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
    filterEditedOnly,
    filterPendingCredit,
    filterNCPending,
    filterPagada,
    filterPartial,
    filterRebajadas,
    searchQuery,
    providerNameByCode,
  ]);

  const handleOpenCreateMovement = () => {
    if (!selectedCompany) {
      showToast(
        "Selecciona una empresa antes de agregar una factura.",
        "error",
        4000,
      );
      return;
    }
    resetCreateForm();
    setCreateDrawerOpen(true);
  };

  const totalPages = useMemo(() => {
    if (rowsPerPage === "daily") return 1;
    const total = Math.ceil(filteredMovements.length / rowsPerPage);
    return Math.max(1, total);
  }, [filteredMovements.length, rowsPerPage]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  useEffect(() => {
    setPageIndex(0);
    setCurrentDailyKey(dateKeyFromDate(new Date()));
    const hasActiveFilter =
      filterProviderCode !== "all" ||
      filterPaymentType !== "all" ||
      docTypeFilter !== "all" ||
      Boolean(searchQuery && String(searchQuery).trim()) ||
      Boolean(fromFilter) ||
      Boolean(toFilter) ||
      filterEditedOnly ||
      filterPendingCredit ||
      filterNCPending ||
      filterPagada ||
      filterPartial ||
      filterRebajadas;

    if (rowsPerPage === "daily" && hasActiveFilter) {
      setRowsPerPage(10);
    }
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
    if (rowsPerPage === "daily") {
      return filteredMovements.filter(
        (m) => dateKeyFromIso(m.createdAt) === currentDailyKey,
      );
    }
    const start = pageIndex * rowsPerPage;
    return filteredMovements.slice(start, start + rowsPerPage);
  }, [filteredMovements, pageIndex, rowsPerPage, currentDailyKey]);

  const pageRange = useMemo(() => {
    if (filteredMovements.length === 0) {
      return { from: 0, to: 0 };
    }
    if (rowsPerPage === "daily") {
      return { from: 1, to: filteredMovements.length };
    }
    const from = pageIndex * rowsPerPage + 1;
    const to = Math.min(filteredMovements.length, (pageIndex + 1) * rowsPerPage);
    return { from, to };
  }, [filteredMovements.length, pageIndex, rowsPerPage]);
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

  const handleAdminCompanyChange = useCallback(
    (nextCompany: string) => {
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
        console.error(
          "Error saving selected company to localStorage:",
          error,
        );
      }
    },
    [],
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 lg:py-8">
      <div className="rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-sm sm:p-4 md:p-5 space-y-4">
        <section className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
            {/* Proveedor */}
            <div className="relative min-w-0" ref={providerDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProviderDropdownOpen((prev) => !prev)}
                className="h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-cyan-500/45 focus:border-[var(--accent)] flex items-center justify-between"
                title="Filtrar por proveedor"
                aria-label="Filtrar por proveedor"
              >
                <span className="flex items-center gap-2 truncate">
                  <Search className="h-4 w-4 text-cyan-100/80" />
                  <span className={providerFilter ? "" : "text-cyan-100/70"}>
                    {providerFilter ||
                      (providersLoading ? "Cargando..." : "Proveedor")}
                  </span>
                </span>
                <span className="text-cyan-100/80">⌄</span>
              </button>
              {isProviderDropdownOpen && (
                <div className="absolute z-[9999] mt-2 w-full max-h-56 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                  <button
                    type="button"
                    className="w-full rounded px-3 py-2 text-left text-sm text-cyan-100/70 transition-colors hover:bg-cyan-950/80"
                    onMouseDown={() => {
                      setFilterProviderCode("all");
                      setProviderFilter("");
                      setIsProviderDropdownOpen(false);
                    }}
                  >
                    Todos los proveedores
                  </button>
                  {providers.map((p) => (
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
                        setIsProviderDropdownOpen(false);
                      }}
                    >
                      {p.name} ({p.code})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tipo */}
            <div className="relative min-w-0" ref={typeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTypeDropdownOpen((prev) => !prev)}
                className="h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-cyan-500/45 focus:border-[var(--accent)] flex items-center justify-between"
                title="Filtrar por tipo"
                aria-label="Filtrar por tipo"
              >
                <span className={typeFilter ? "" : "text-cyan-100/70"}>
                  {typeFilter || "Tipo movimiento"}
                </span>
                <span className="text-cyan-100/80">⌄</span>
              </button>
              {isTypeDropdownOpen && (
                <div className="absolute z-[9999] mt-2 w-full max-h-56 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                  <button
                    type="button"
                    className="w-full rounded px-3 py-2 text-left text-sm text-cyan-100/70 transition-colors hover:bg-cyan-950/80"
                    onMouseDown={() => {
                      setFilterPaymentType("all");
                      setTypeFilter("");
                      setIsTypeDropdownOpen(false);
                    }}
                  >
                    Todos los tipos
                  </button>
                  {[
                    { group: "Ingresos", types: FONDO_INGRESO_TYPES },
                    { group: "Gastos", types: FONDO_GASTO_TYPES },
                    { group: "Egresos", types: FONDO_EGRESO_TYPES },
                  ].map(({ group, types }) => (
                    <React.Fragment key={group}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-cyan-100/50 uppercase">
                        {group}
                      </div>
                      {types.map((t) => (
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
                            setIsTypeDropdownOpen(false);
                          }}
                        >
                          {formatMovementType(t)}
                        </button>
                      ))}
                      {types.length === 0 && (
                        <div className="px-3 pb-2 text-xs text-cyan-100/40">
                          —
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Documento */}
            <div className="relative min-w-0" ref={docTypeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDocTypeDropdownOpen((prev) => !prev)}
                className="h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-cyan-500/45 focus:border-[var(--accent)] flex items-center justify-between"
                title="Filtrar por documento"
                aria-label="Filtrar por documento"
              >
                <span className={docTypeFilterLabel ? "" : "text-cyan-100/70"}>
                  {docTypeFilterLabel || "Documento"}
                </span>
                <span className="text-cyan-100/80">⌄</span>
              </button>
              {isDocTypeDropdownOpen && (
                <div className="absolute z-[9999] mt-2 w-full max-h-56 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                  <button
                    type="button"
                    className="w-full rounded px-3 py-2 text-left text-sm text-cyan-100/70 transition-colors hover:bg-cyan-950/80"
                    onMouseDown={() => {
                      setDocTypeFilter("all");
                      setDocTypeFilterLabel("");
                      setIsDocTypeDropdownOpen(false);
                    }}
                  >
                    Todos los documentos
                  </button>
                  {([
                    { value: "FCR", label: "Factura a Credito" },
                    { value: "NC", label: "Nota de Credito" },
                    { value: "FCO", label: "Factura a Contado" },
                  ] as const).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                        docTypeFilter === item.value
                          ? "bg-cyan-500/20 text-cyan-50"
                          : "text-[var(--foreground)]"
                      }`}
                      onMouseDown={() => {
                        setDocTypeFilter(item.value);
                        setDocTypeFilterLabel(item.label);
                        setIsDocTypeDropdownOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Buscar */}
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

            <div className="flex h-11 min-w-0 flex-col justify-center gap-2 rounded border border-cyan-700/35 bg-cyan-950/25 px-3 py-0 text-sm text-[var(--foreground)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-3 sm:w-full">
                <div className="relative" ref={filtersDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setFiltersDropdownOpen((prev) => !prev)}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--input-border)] bg-transparent px-3 text-xs font-semibold tracking-wide text-[var(--foreground)] transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--muted)]/20 active:scale-[0.98]"
                    aria-haspopup="menu"
                    aria-expanded={filtersDropdownOpen}
                    title="Mostrar facturas en especifico estado o editados"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Vista</span>
                  </button>
                  {filtersDropdownOpen && (
                    <div className="absolute left-0 top-full z-[9999] mt-2 w-[220px] rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl">
                      <div className="flex flex-col py-1">
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                          <input
                            type="checkbox"
                            checked={filterPendingCredit}
                            onChange={(e) => setFilterPendingCredit(e.target.checked)}
                            className="h-4 w-4 accent-amber-400"
                          />
                          <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span className="leading-tight">Facturas de crédito pendientes</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                          <input
                            type="checkbox"
                            checked={filterNCPending}
                            onChange={(e) => setFilterNCPending(e.target.checked)}
                            className="h-4 w-4 accent-amber-400"
                          />
                          <ClipboardList className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span className="leading-tight">Notas de crédito pendientes</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                          <input
                            type="checkbox"
                            checked={filterPagada}
                            onChange={(e) => setFilterPagada(e.target.checked)}
                            className="h-4 w-4 accent-amber-400"
                          />
                          <BadgeCheck className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span className="leading-tight">Pagadas</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                          <input
                            type="checkbox"
                            checked={filterPartial}
                            onChange={(e) => setFilterPartial(e.target.checked)}
                            className="h-4 w-4 accent-amber-400"
                          />
                          <Clock className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span className="leading-tight">Parciales</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                          <input
                            type="checkbox"
                            checked={filterRebajadas}
                            onChange={(e) => setFilterRebajadas(e.target.checked)}
                            className="h-4 w-4 accent-amber-400"
                          />
                          <CheckCircle className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span className="leading-tight">Rebajadas</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                          <input
                            type="checkbox"
                            checked={filterEditedOnly}
                            onChange={(e) => setFilterEditedOnly(e.target.checked)}
                            className="h-4 w-4 rounded border-[var(--input-border)] accent-[var(--accent)]"
                          />
                          <Pencil className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span>Editados</span>
                        </label>
                        <hr className="my-1 border-[var(--input-border)]" />
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/20">
                          <input
                            type="checkbox"
                            checked={rememberFilters}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setRememberFilters(on);
                              if (!on) {
                                localStorage.removeItem("fg_filters");
                              }
                            }}
                            className="h-4 w-4 accent-amber-400"
                          />
                          <Save className="h-4 w-4 shrink-0" />
                          <span className="text-xs">Recordar ajustes</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterProviderCode("all");
                    setFilterPaymentType("all");
                    setDocTypeFilter("all");
                    setDocTypeFilterLabel("");
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
                    const m = new Date();
                    m.setDate(1);
                    m.setHours(0, 0, 0, 0);
                    setCalendarFromMonth(new Date(m));
                    setCalendarToMonth(new Date(m));

                    setPageIndex(0);
                  }}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-[var(--input-border)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--muted)] active:scale-[0.98]"
                  title="Limpiar filtros"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--input-border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-[var(--muted-foreground)]">
              Mostrando {pageRange.from}-{pageRange.to} de {filteredMovements.length}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={rowsPerPage === "daily" ? "daily" : String(rowsPerPage)}
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
                className="h-9 rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-2 text-xs text-[var(--foreground)]"
                aria-label="Filas por pagina"
              >
                <option value="daily">Diariamente</option>
                {[5, 10, 20].map((size) => (
                  <option key={size} value={size}>
                    {size} por pagina
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (rowsPerPage === "daily") {
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
                    rowsPerPage === "daily"
                      ? currentDailyKey <= "1970-01-01"
                      : pageIndex === 0
                  }
                  className="inline-flex h-9 items-center justify-center rounded border border-[var(--input-border)] px-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[64px] text-center text-xs text-[var(--muted-foreground)]">
                  {rowsPerPage === "daily"
                    ? formatKeyToDisplay(currentDailyKey)
                    : `${pageIndex + 1} / ${totalPages}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (rowsPerPage === "daily") {
                      setCurrentDailyKey((prev) => {
                        if (prev >= todayKey) return todayKey;
                        const d = new Date(prev + "T12:00:00");
                        d.setDate(d.getDate() + 1);
                        const next = dateKeyFromDate(d);
                        return next > todayKey ? todayKey : next;
                      });
                    } else {
                      setPageIndex((prev) => Math.min(totalPages - 1, prev + 1));
                    }
                  }}
                  disabled={
                    rowsPerPage === "daily"
                      ? currentDailyKey >= todayKey
                      : pageIndex >= totalPages - 1
                  }
                  className="inline-flex h-9 items-center justify-center rounded border border-[var(--input-border)] px-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-[var(--input-border)] pt-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(150px,180px)_minmax(150px,180px)_minmax(150px,170px)] lg:items-end">
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
                      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes
                      from = new Date(now.setDate(diff));
                      to = new Date();
                    } else if (v === "lastweek") {
                      const day = now.getDay();
                      const diff =
                        now.getDate() - day + (day === 0 ? -6 : 1) - 7;
                      from = new Date(now.getFullYear(), now.getMonth(), diff);
                      to = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        diff + 6,
                      );
                    } else if (v === "lastmonth") {
                      const first = new Date(
                        now.getFullYear(),
                        now.getMonth() - 1,
                        1,
                      );
                      const last = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        0,
                      );
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

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end xl:w-auto xl:min-w-[348px]">
              {/* Bloque empresa actual + select */}
              <div className="flex w-full min-w-0 flex-col gap-1.5 text-sm text-[var(--foreground)] sm:flex-row sm:items-end sm:gap-4">
                {/* Label empresa actual */}
                <div className="min-w-0 sm:flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                    {user?.role === "user"
                      ? "Empresa asignada"
                      : "Empresa actual"}
                  </p>
                  <p
                    className="truncate text-sm font-semibold text-[var(--foreground)]"
                    title={currentCompanyLabel}
                  >
                    {currentCompanyLabel}
                  </p>
                  {availableCompaniesError && (
                    <p className="text-xs text-red-500 mt-1">
                      {availableCompaniesError}
                    </p>
                  )}
                </div>

                {user?.role !== "user" && (
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <select
                      id={companySelectId}
                      value={selectedCompany}
                      onChange={(e) => handleAdminCompanyChange(e.target.value)}
                      disabled={
                        availableCompaniesLoading ||
                        sortedOwnerCompanies.length === 0
                      }
                      className="w-full min-w-0 max-w-full truncate rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus:border-[var(--accent)]"
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
                  </div>
                )}
              </div>

              {/* Botón agregar */}
              <div className="relative group min-w-0 sm:flex-shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCreateMovement}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] hover:shadow-md hover:shadow-sky-950/25 active:translate-y-0 active:scale-[0.99] sm:w-auto sm:px-5"
                >
                  <Plus className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Agregar FC/NC</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {selectedProviderPendingAlert && (
          <section className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-amber-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4" />
                  Proveedores con pagos pendientes
                </div>
                <p className="mt-1 text-xs text-amber-100/80">
                  Hay facturas a crédito con saldo abierto. Registra los abonos desde esta sección para que queden enlazados al Fondo General.
                </p>
              </div>
              <span className="rounded border border-amber-300/35 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold">
                {selectedProviderPendingAlert.count} factura
                {selectedProviderPendingAlert.count === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {[selectedProviderPendingAlert].map((item) => {
                const balances = [
                  item.crc > 0 ? formatAlertAmount("CRC", item.crc) : "",
                  item.usd > 0 ? formatAlertAmount("USD", item.usd) : "",
                ].filter(Boolean);
                return (
                  <div
                    key={item.providerCode}
                    className="rounded border border-amber-400/25 bg-black/10 px-3 py-2"
                  >
                    <div className="truncate text-sm font-semibold">
                      {item.providerName}
                    </div>
                    <div className="mt-1 text-xs text-amber-100/80">
                      {item.count} factura{item.count === 1 ? "" : "s"} sin saldar
                    </div>
                    <div className="mt-1 text-xs font-semibold">
                      {balances.join(" / ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--input-border)]">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              Facturas ({filteredMovements.length})
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {movementsLoading ? "Cargando..." : currentCompanyLabel}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-separate border-spacing-0 text-sm">
              <colgroup>
                <col style={{ width: columnWidths.fecha }} />
                <col style={{ width: columnWidths.proveedor }} />
                <col style={{ width: columnWidths.factura }} />
                <col style={{ width: columnWidths.tipo }} />
                <col style={{ width: columnWidths.monto }} />
                <col style={{ width: columnWidths.estado }} />
                <col style={{ width: columnWidths.accion }} />
              </colgroup>
                <thead className="text-xs uppercase text-[var(--muted-foreground)]">
                  <tr className="[&>th]:border-b [&>th]:border-[var(--input-border)]">
                  <th className="px-3 py-2 text-left font-semibold">
                    <div className="relative pr-2">
                      <div>Fecha</div>
                      <div
                        onMouseDown={(e) => startResizing(e, "fecha")}
                        className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                        style={{ touchAction: "none" }}
                      >
                        <div style={{ width: 2, height: "70%", background: "rgba(0,0,0,0.06)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    <div className="relative pr-2">
                      <div>Proveedor</div>
                      <div
                        onMouseDown={(e) => startResizing(e, "proveedor")}
                        className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                        style={{ touchAction: "none" }}
                      >
                        <div style={{ width: 2, height: "70%", background: "rgba(0,0,0,0.06)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    <div className="relative pr-2">
                      <div>N° Factura</div>
                      <div
                        onMouseDown={(e) => startResizing(e, "factura")}
                        className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                        style={{ touchAction: "none" }}
                      >
                        <div style={{ width: 2, height: "70%", background: "rgba(0,0,0,0.06)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold max-sm:hidden">
                    <div className="relative pr-2">
                      <div>Tipo Pago</div>
                      <div
                        onMouseDown={(e) => startResizing(e, "tipo")}
                        className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                        style={{ touchAction: "none" }}
                      >
                        <div style={{ width: 2, height: "70%", background: "rgba(0,0,0,0.06)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="relative pr-2">
                      <div>Monto</div>
                      <div
                        onMouseDown={(e) => startResizing(e, "monto")}
                        className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                        style={{ touchAction: "none" }}
                      >
                        <div style={{ width: 2, height: "70%", background: "rgba(0,0,0,0.06)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    <div className="relative pr-2">
                      <div>Estado</div>
                      <div
                        onMouseDown={(e) => startResizing(e, "estado")}
                        className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                        style={{ touchAction: "none" }}
                      >
                        <div style={{ width: 2, height: "70%", background: "rgba(0,0,0,0.06)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    <div className="relative pr-2">
                      <div>Acción</div>
                      <div
                        onMouseDown={(e) => startResizing(e, "accion")}
                        className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                        style={{ touchAction: "none" }}
                      >
                        <div style={{ width: 2, height: "70%", background: "rgba(0,0,0,0.06)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* CAMBIAR ACA SI SE QUIERE VER SALDO NEGATIVO */}
                {pagedMovements.map((m) => {
                  const amount = Math.abs(Number(m.amount) || 0);
                  const signedAmount =
                    String(m.invoiceDocType || "").trim().toUpperCase() ===
                    "NC"
                      ? -amount
                      : amount;
                  const amountLabel = signedAmount.toLocaleString("es-CR", {
                    style: "currency",
                    currency: m.currency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  });
                  const paymentStatus = resolveFacturaStatus(m);
                  const paymentStatusLabel = resolveFacturaStatusLabel(m);
                  const paymentBalance = resolveFacturaBalance(m);
                  const isPaid = paymentBalance === 0;
                  return (
                    <tr
                      key={m.id}
                      className="[&>td]:border-b [&>td]:border-[var(--input-border)] hover:bg-[var(--muted)]/10"
                    >
                      <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                        {(() => {
                          try {
                            const d = new Date(String(m.createdAt || ""));
                            if (Number.isNaN(d.getTime())) {
                              return <div>{formatKeyToDisplay(dateKeyFromIso(m.createdAt))}</div>;
                            }
                            const localDateTimeFormatter = new Intl.DateTimeFormat("es-CR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            });
                            const formatted = localDateTimeFormatter.format(d);
                            const parts = String(formatted).split(",");
                            return (
                              <div className="flex flex-col">
                                <span className="font-medium text-[var(--foreground)]">{parts[0]?.trim()}{parts.length>1?",":""}</span>
                                {parts[1] && (
                                  <span className="text-xs text-[var(--muted-foreground)]">{parts.slice(1).join(",").trim()}</span>
                                )}
                              </div>
                            );
                          } catch {
                            return <div>{formatKeyToDisplay(dateKeyFromIso(m.createdAt))}</div>;
                          }
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate max-w-[280px]">
                          {providerNameByCode.get(m.providerCode) ||
                            m.providerCode}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {m.notes || m.providerCode}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {m.invoiceNumber}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap max-sm:hidden">
                        {formatMovementType(m.paymentType)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-xs tabular-nums">
                        {amountLabel} {m.currency}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200">
                            {formatInvoiceDocTypeLabel(m.invoiceDocType)}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                              paymentStatus === "PAGADA"
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                                : paymentStatus === "PARCIAL"
                                  ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
                                  : "border-slate-500/40 bg-slate-500/10 text-slate-200"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {paymentStatus === "PAGADA" && (
                                <CheckCircle className="h-3 w-3 text-emerald-300" />
                              )}
                              <span>{paymentStatusLabel}</span>
                            </span>
                          </span>
                        </div>
                        {m.invoiceDocType === "FCR" && paymentBalance > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-100">
                              <Clock className="h-3 w-3" />
                              Saldo:{" "}
                              {paymentBalance.toLocaleString("es-CR", {
                                style: "currency",
                                currency: m.currency,
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {m.invoiceDocType === "FCR" && !isPaid ? (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(m)}
                            disabled={isPaid || pendingCierreDeCaja}
                            className={`inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isPaid || pendingCierreDeCaja
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100 cursor-not-allowed"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                            }`}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {pendingCierreDeCaja ? "Bloqueado" : "Registrar Abono"}
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!movementsLoading && filteredMovements.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]"
                    >
                      No hay facturas para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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
                          ? Math.trunc(Number(paymentAmount)).toLocaleString("es-CR", {
                              style: "currency",
                              currency: paymentTarget.currency,
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          : ""
                      }
                      onChange={(event) => setPaymentAmount(event.target.value.replace(/\D/g, ""))}
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
