"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActorOwnership } from "@/hooks/useActorOwnership";
import { getDefaultPermissions } from "@/utils/permissions";
import { EmpresasService } from "@/services/empresas";
import type {
  MovementAccountKey,
  MovementCurrencyKey,
} from "@/services/movimientos-fondos";
import { ReportesMovimientosService } from "@/services/reportes-movimientos";
import { ProvidersService } from "@/services/providers";
import ReportMovementsDetailModal, {
  type ReportMovementDetail,
} from "@/components/modals/ReportMovementsDetailModal";

type FondoMovementType = string;

// Formatea en Titulo Caso cada palabra (versión local para evitar depender de `fondo.tsx`).
const formatMovementType = (type: FondoMovementType | string) => {
  if (type === "INFORMATIVO") return "";

  return String(type)
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
};

type Classification = "ingreso" | "gasto" | "egreso";

type CurrencyBucket = {
  ingreso: number;
  gasto: number;
  egreso: number;
};

type SummaryRow = {
  paymentType: FondoMovementType;
  label: string;
  classification: Classification;
  totals: Record<MovementCurrencyKey, CurrencyBucket>;
};

type ReportBucketEntry = {
  paymentType: FondoMovementType;
  currency: MovementCurrencyKey;
  amountIngreso: number;
  amountGasto: number;
  amountEgreso: number;
  companyName: string;
  accountId?: MovementAccountKey;
};

const ACCOUNT_LABELS: Record<MovementAccountKey, string> = {
  FondoGeneral: "Fondo General",
  BCR: "Cuenta BCR",
  BN: "Cuenta BN",
  BAC: "Cuenta BAC",
};

const ACCOUNT_ORDER: MovementAccountKey[] = [
  "FondoGeneral",
  "BCR",
  "BN",
  "BAC",
];
const MOVEMENT_ACCOUNT_SET = new Set<MovementAccountKey>(ACCOUNT_ORDER);
const ALL_COMPANIES_VALUE = "__all_companies__";
const ALL_ACCOUNTS_VALUE = "all";

// Clave compartida para sincronizar la selección de empresa entre todas las secciones del Fondo General
const SHARED_COMPANY_STORAGE_KEY = "fg_selected_company_shared";
type AccountSelectValue = MovementAccountKey | typeof ALL_ACCOUNTS_VALUE;

const isMovementAccountKey = (value: unknown): value is MovementAccountKey =>
  typeof value === "string" &&
  MOVEMENT_ACCOUNT_SET.has(value as MovementAccountKey);

const formatClassification = (classification: Classification) => {
  if (classification === "ingreso") return "Ingreso";
  if (classification === "gasto") return "Gasto";
  return "Egreso";
};

const buildDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildLocalDayIsoRange = (isoDateKey: string) => {
  const [yStr, mStr, dStr] = String(isoDateKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      startIso: start.toISOString(),
      endIsoExclusive: end.toISOString(),
    };
  }

  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIsoExclusive: end.toISOString() };
};

const normalizeProviderCode = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(Math.trunc(value)).padStart(4, "0");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = Number.parseInt(trimmed, 10);
    if (
      !Number.isNaN(parsed) &&
      String(parsed) === trimmed.replace(/^0+/, "") &&
      parsed >= 0
    ) {
      return String(parsed).padStart(4, "0");
    }
    // If it's already a 4+ digit code, keep as is; if it's not numeric (e.g. "CIERRE ..."), keep as is.
    if (/^\d+$/.test(trimmed)) return trimmed.padStart(4, "0");
    return trimmed;
  }
  return String(value ?? "").trim();
};

export default function ReporteMovimientosPage() {
  const { user, loading: authLoading } = useAuth();
  const { ownerIds: actorOwnerIds } = useActorOwnership(user);
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const hasGeneralAccess = Boolean(permissions.fondogeneral);
  const assignedCompany = user?.ownercompanie?.trim() ?? "";
  const isSuperAdmin = user?.role === "superadmin";
  const isAdminUser = user?.role === "admin" || isSuperAdmin;

  const allowedOwnerIds = useMemo(() => {
    const set = new Set<string>();
    actorOwnerIds.forEach((id) => {
      if (id === undefined || id === null) return;
      const normalized = String(id).trim();
      if (normalized) set.add(normalized);
    });
    if (user?.ownerId !== undefined && user?.ownerId !== null) {
      const normalized = String(user.ownerId).trim();
      if (normalized) set.add(normalized);
    }
    return set;
  }, [actorOwnerIds, user?.ownerId]);

  const accessibleAccountKeys = useMemo<MovementAccountKey[]>(() => {
    const list: MovementAccountKey[] = [];
    if (permissions.fondogeneral) list.push("FondoGeneral");
    if (permissions.fondogeneralBCR) list.push("BCR");
    if (permissions.fondogeneralBN) list.push("BN");
    if (permissions.fondogeneralBAC) list.push("BAC");
    return list;
  }, [permissions]);

  const accountSelectOptions = useMemo<AccountSelectValue[]>(() => {
    if (accessibleAccountKeys.length > 1) {
      return [ALL_ACCOUNTS_VALUE, ...accessibleAccountKeys];
    }
    return accessibleAccountKeys;
  }, [accessibleAccountKeys]);

  const [companies, setCompanies] = useState<string[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(SHARED_COMPANY_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [selectedAccount, setSelectedAccount] = useState<
    AccountSelectValue | ""
  >("");
  const [entries, setEntries] = useState<ReportBucketEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const isMountedRef = useRef(true);
  const loadingRequestIdRef = useRef(0);
  const loadingWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // In dev StrictMode, effects run setup->cleanup->setup.
    // Ensure the mounted flag is restored on setup.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [providerNameLookup, setProviderNameLookup] = useState<
    Record<string, string>
  >({});
  const loadedProviderCompaniesRef = useRef<Set<string>>(new Set());
  const [classificationFilter, setClassificationFilter] = useState<
    "all" | "gasto" | "egreso" | "ingreso"
  >(() => {
    try {
      const stored = localStorage.getItem("mostrartipos");
      if (stored && ["all", "gasto", "egreso", "ingreso"].includes(stored)) {
        return stored as "all" | "gasto" | "egreso" | "ingreso";
      }
    } catch (error) {
      console.error(
        "Error reading classificationFilter from localStorage:",
        error,
      );
    }
    return "all";
  });

  const [selectedMovementTypes, setSelectedMovementTypes] = useState<
    FondoMovementType[]
  >([]);
  const [movementTypeSelectorOpen, setMovementTypeSelectorOpen] =
    useState(false);
  const movementTypeSelectorRef = useRef<HTMLDivElement | null>(null);

  const [showUSD, setShowUSD] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("showUSD") === "true";
    } catch {
      return false;
    }
  });

  // Escuchar cambios de empresa desde otras secciones (sincronización bidireccional)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SHARED_COMPANY_STORAGE_KEY && event.newValue) {
        setSelectedCompany((prev) => {
          if (
            event.newValue &&
            event.newValue !== prev &&
            companies.includes(event.newValue)
          ) {
            return event.newValue;
          }
          return prev;
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [companies]);

  const handleClassificationToggle = useCallback(
    (target: "gasto" | "egreso" | "ingreso") => {
      setClassificationFilter((prev) => (prev === target ? "all" : target));
    },
    [],
  );

  const movementTypeMetadata = useMemo(() => {
    const registry = new Map<FondoMovementType, string>();
    entries.forEach((entry) => {
      registry.set(entry.paymentType, formatMovementType(entry.paymentType));
    });
    const sorted = Array.from(registry.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "es", { sensitivity: "base" }),
    );
    return {
      options: sorted,
      labelMap: Object.fromEntries(sorted) as Partial<
        Record<FondoMovementType, string>
      >,
    };
  }, [entries]);

  const movementTypeOptions = movementTypeMetadata.options;
  const movementTypeLabelMap = movementTypeMetadata.labelMap;

  const toggleMovementType = useCallback((movementType: FondoMovementType) => {
    setSelectedMovementTypes((prev) =>
      prev.includes(movementType)
        ? prev.filter((candidate) => candidate !== movementType)
        : [...prev, movementType],
    );
  }, []);

  const clearMovementTypeFilters = useCallback(() => {
    setSelectedMovementTypes([]);
    setMovementTypeSelectorOpen(false);
  }, []);

  const movementTypeSummaryLabel = useMemo(() => {
    if (selectedMovementTypes.length === 0) return "Todos los tipos";
    if (selectedMovementTypes.length === 1) {
      const type = selectedMovementTypes[0];
      return movementTypeLabelMap[type] ?? formatMovementType(type);
    }
    return `${selectedMovementTypes.length} tipos seleccionados`;
  }, [selectedMovementTypes, movementTypeLabelMap]);

  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return buildDateString(start);
  }, [today]);
  const initialTo = useMemo(() => buildDateString(today), [today]);

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [quickRange, setQuickRange] = useState<string>("");

  const dateRangeInvalid = useMemo(() => {
    if (!fromDate || !toDate) return false;
    const from = Date.parse(`${fromDate}T00:00:00`);
    const to = Date.parse(`${toDate}T23:59:59`);
    if (Number.isNaN(from) || Number.isNaN(to)) return false;
    return from > to;
  }, [fromDate, toDate]);

  const currencyFormatters = useMemo(
    () => ({
      CRC: new Intl.NumberFormat("es-CR", {
        style: "currency",
        currency: "CRC",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
      USD: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    }),
    [],
  );

  const formatAmount = useCallback(
    (currency: MovementCurrencyKey, amount: number) => {
      const normalized = Math.trunc(Number.isFinite(amount) ? amount : 0);
      if (normalized === 0) return "—";
      return currencyFormatters[currency].format(normalized);
    },
    [currencyFormatters],
  );

  useEffect(() => {
    if (!hasGeneralAccess || authLoading) return;

    if (!isAdminUser) {
      setCompaniesError(null);
      setCompaniesLoading(false);
      if (assignedCompany) {
        setCompanies([assignedCompany]);
        setSelectedCompany(assignedCompany);
      } else {
        setCompanies([]);
        setSelectedCompany("");
      }
      return;
    }

    if (!isSuperAdmin && allowedOwnerIds.size === 0) {
      setCompanies([]);
      setSelectedCompany("");
      setCompaniesError(
        "No se encontraron empresas disponibles para tu usuario.",
      );
      setCompaniesLoading(false);
      return;
    }

    let cancelled = false;
    setCompaniesLoading(true);
    setCompaniesError(null);

    const loadCompanies = async () => {
      try {
        const list = await EmpresasService.getAllEmpresas();
        if (cancelled) return;
        const filtered = isSuperAdmin
          ? list
          : list.filter((emp) =>
              allowedOwnerIds.has((emp.ownerId || "").trim()),
            );
        const getCompanyKey = (emp: any) =>
          String(emp?.name || emp?.ubicacion || emp?.id || "").trim();
        const names = Array.from(
          new Set(
            filtered
              .map((emp) => getCompanyKey(emp))
              .filter((name) => name.length > 0),
          ),
        ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
        setCompanies(names);
        setSelectedCompany((prev) => {
          if (prev === ALL_COMPANIES_VALUE) {
            return names.length > 1 ? ALL_COMPANIES_VALUE : (names[0] ?? "");
          }
          if (prev && names.includes(prev)) return prev;
          if (assignedCompany && names.includes(assignedCompany))
            return assignedCompany;
          if (names.length > 1) return ALL_COMPANIES_VALUE;
          return names[0] ?? "";
        });
      } catch (err) {
        console.error("Error loading empresas for summary report:", err);
        if (!cancelled) {
          setCompanies([]);
          setSelectedCompany("");
          setCompaniesError(
            "No se pudieron cargar las empresas. Inténtalo más tarde.",
          );
        }
      } finally {
        if (!cancelled) {
          setCompaniesLoading(false);
        }
      }
    };

    void loadCompanies();

    return () => {
      cancelled = true;
    };
  }, [
    hasGeneralAccess,
    authLoading,
    isAdminUser,
    isSuperAdmin,
    assignedCompany,
    allowedOwnerIds,
  ]);

  useEffect(() => {
    if (isAdminUser) return;
    if (!assignedCompany) return;
    setSelectedCompany(assignedCompany);
  }, [assignedCompany, isAdminUser]);

  useEffect(() => {
    if (accessibleAccountKeys.length === 0) {
      setSelectedAccount("");
      return;
    }
    setSelectedAccount((prev) => {
      if (prev === ALL_ACCOUNTS_VALUE) {
        return accessibleAccountKeys.length > 1
          ? ALL_ACCOUNTS_VALUE
          : accessibleAccountKeys[0];
      }
      if (
        prev &&
        isMovementAccountKey(prev) &&
        accessibleAccountKeys.includes(prev)
      ) {
        return prev;
      }
      if (accessibleAccountKeys.length > 1) return ALL_ACCOUNTS_VALUE;
      return accessibleAccountKeys[0];
    });
  }, [accessibleAccountKeys]);

  useEffect(() => {
    // No consultamos automáticamente al entrar o al cambiar filtros.
    // Para evitar resultados desactualizados, limpiamos los datos al cambiar empresa/cuenta.
    // También invalidamos cualquier búsqueda en curso.
    loadingRequestIdRef.current = 0;
    setEntries([]);
    setDataError(null);
    setDataLoading(false);
    setHasSearched(false);
  }, [selectedCompany, selectedAccount, fromDate, toDate]);

  useEffect(() => {
    if (!hasGeneralAccess) {
      setEntries([]);
      setDataLoading(false);
      return;
    }
  }, [hasGeneralAccess]);

  // Watchdog: evita spinner infinito por promesas colgadas/reintentos cruzados.
  useEffect(() => {
    if (!dataLoading) {
      if (loadingWatchdogRef.current) {
        clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
      return;
    }

    if (loadingWatchdogRef.current) {
      clearTimeout(loadingWatchdogRef.current);
    }

    const currentRequestId = loadingRequestIdRef.current;
    loadingWatchdogRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      if (loadingRequestIdRef.current !== currentRequestId) return;
      setDataLoading(false);
      setDataError(
        "La búsqueda tardó demasiado y se detuvo. Intenta con un rango más corto o verifica la empresa/cuenta.",
      );
    }, 25000);

    return () => {
      if (loadingWatchdogRef.current) {
        clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
    };
  }, [dataLoading]);

  const runSearch = useCallback(async () => {
    if (!hasGeneralAccess) {
      setEntries([]);
      setDataLoading(false);
      setHasSearched(true);
      return;
    }

    const targetAccounts: MovementAccountKey[] =
      selectedAccount === ALL_ACCOUNTS_VALUE
        ? accessibleAccountKeys
        : selectedAccount
          ? [selectedAccount as MovementAccountKey]
          : [];

    setHasSearched(true);

    const allowedCompanies =
      selectedCompany === ALL_COMPANIES_VALUE
        ? companies
        : selectedCompany
          ? [selectedCompany]
          : [];

    if (allowedCompanies.length === 0 || targetAccounts.length === 0) {
      setEntries([]);
      setDataLoading(false);
      return;
    }

    const fromKey = (fromDate || "").trim();
    const toKey = (toDate || "").trim();
    const startKey = fromKey && toKey && fromKey > toKey ? toKey : fromKey;
    const endKey = fromKey && toKey && fromKey > toKey ? fromKey : toKey;

    const requestId = loadingRequestIdRef.current + 1;
    loadingRequestIdRef.current = requestId;
    setDataLoading(true);
    setDataError(null);

    try {
      const effectiveFrom = startKey || fromKey || "";
      const effectiveTo = endKey || toKey || "";

      console.log("[REPORT-OLAP] query", {
        collection: "reportes_movimientos",
        fromDate: effectiveFrom,
        toDate: effectiveTo,
        companies: allowedCompanies,
        accountIds: targetAccounts,
      });

      const chunks: string[][] = [];
      for (let i = 0; i < allowedCompanies.length; i += 30) {
        chunks.push(allowedCompanies.slice(i, i + 30));
      }

      const queries: Array<Promise<any[]>> = [];
      if (allowedCompanies.length === 1) {
        queries.push(
          ReportesMovimientosService.listDailyReports({
            fromDate: effectiveFrom,
            toDate: effectiveTo,
            empresa: allowedCompanies[0],
            accountIds: targetAccounts,
          }) as any,
        );
      } else if (targetAccounts.length > 1) {
        // Avoid combining empresa in + accountId in
        targetAccounts.forEach((accountId) => {
          chunks.forEach((chunk) => {
            queries.push(
              ReportesMovimientosService.listDailyReports({
                fromDate: effectiveFrom,
                toDate: effectiveTo,
                empresas: chunk,
                accountIds: [accountId],
              }) as any,
            );
          });
        });
      } else {
        chunks.forEach((chunk) => {
          queries.push(
            ReportesMovimientosService.listDailyReports({
              fromDate: effectiveFrom,
              toDate: effectiveTo,
              empresas: chunk,
              accountIds: targetAccounts,
            }) as any,
          );
        });
      }

      if (queries.length === 0) {
        setEntries([]);
        return;
      }

      const timeoutMs = 20_000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), timeoutMs);
      });

      const results = await Promise.race([
        Promise.all(queries),
        timeoutPromise,
      ]);
      const dedup = new Map<string, any>();
      results.flat().forEach((doc) => {
        if (!doc?.id) return;
        dedup.set(String(doc.id), doc);
      });
      const reports = Array.from(dedup.values());

      console.log("[REPORT-OLAP] result", {
        reportsCount: reports.length,
        reportIds: reports.slice(0, 10).map((r: any) => r?.id),
      });

      if (!isMountedRef.current) {
        return;
      }

      const nextEntries: ReportBucketEntry[] = [];
      reports.forEach((doc) => {
        const companyName = String((doc as any)?.empresa || "").trim();
        const byType = ((doc as any)?.byType || {}) as Record<
          string,
          Record<string, { ingreso?: number; gasto?: number; egreso?: number }>
        >;

        Object.entries(byType).forEach(([paymentType, byCurrency]) => {
          (Object.keys(byCurrency || {}) as string[]).forEach((cur) => {
            const currency: MovementCurrencyKey = cur === "USD" ? "USD" : "CRC";
            const bucket = (byCurrency as any)?.[currency];
            if (!bucket) return;
            const ingreso = Math.trunc(Number(bucket.ingreso ?? 0)) || 0;
            const gasto = Math.trunc(Number(bucket.gasto ?? 0)) || 0;
            const egreso = Math.trunc(Number(bucket.egreso ?? 0)) || 0;
            const amountIngreso = ingreso;
            const amountGasto = gasto;
            const amountEgreso = egreso;
            if (
              Math.trunc(amountIngreso) === 0 &&
              Math.trunc(amountGasto) === 0 &&
              Math.trunc(amountEgreso) === 0
            )
              return;
            nextEntries.push({
              paymentType,
              currency,
              amountIngreso,
              amountGasto,
              amountEgreso,
              companyName,
              accountId: isMovementAccountKey((doc as any)?.accountId)
                ? ((doc as any).accountId as MovementAccountKey)
                : undefined,
            });
          });
        });
      });

      setEntries(nextEntries);
      console.log("[REPORT-OLAP] entries", {
        entriesCount: nextEntries.length,
      });
    } catch (err) {
      console.error("Error loading Fondo General OLAP report data:", err);
      if (!isMountedRef.current) {
        return;
      }
      setEntries([]);
      const message =
        err instanceof Error && err.message === "timeout"
          ? "La consulta está tardando demasiado. Prueba reducir el rango de fechas o filtrar por una sola empresa/cuenta."
          : "No se pudo cargar el reporte.";
      setDataError(message);
    } finally {
      if (!isMountedRef.current) return;
      if (loadingRequestIdRef.current === requestId) {
        loadingRequestIdRef.current = 0;
      }
      setDataLoading(false);
    }
  }, [
    hasGeneralAccess,
    selectedCompany,
    selectedAccount,
    companies,
    accessibleAccountKeys,
    fromDate,
    toDate,
  ]);

  const [detailRequest, setDetailRequest] = useState<null | {
    paymentType?: FondoMovementType;
    label: string;
    classification: Classification;
    currency: MovementCurrencyKey;
  }>(null);

  const closeDetailModal = useCallback(() => {
    setDetailRequest(null);
  }, []);

  const openDetailModal = useCallback(
    (
      row: SummaryRow,
      classification: Classification,
      currency: MovementCurrencyKey,
    ) => {
      const amount = row.totals[currency][classification];
      if (!Number.isFinite(amount) || Math.trunc(amount) === 0) return;
      setDetailRequest({
        paymentType: row.paymentType,
        label: row.label,
        classification,
        currency,
      });
    },
    [],
  );

  const [detailItems, setDetailItems] = useState<ReportMovementDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  // Token to avoid race conditions when loading detail items
  const detailLoadTokenRef = useRef<number>(0);
  // Trigger to force reloading detail after a failed attempt
  const [detailReloadTrigger, setDetailReloadTrigger] = useState(0);

  useEffect(() => {
    if (!detailRequest) {
      setDetailItems([]);
      setDetailLoading(false);
      return;
    }
    if (dateRangeInvalid) return;

    const allowedCompanies =
      selectedCompany === ALL_COMPANIES_VALUE
        ? companies
        : selectedCompany
          ? [selectedCompany]
          : [];

    const accountIds: MovementAccountKey[] =
      selectedAccount === ALL_ACCOUNTS_VALUE
        ? accessibleAccountKeys
        : selectedAccount
          ? [selectedAccount as MovementAccountKey]
          : [];

    const fromKey = (fromDate || "").trim();
    const toKey = (toDate || "").trim();
    const startKey = fromKey && toKey && fromKey > toKey ? toKey : fromKey;
    const endKey = fromKey && toKey && fromKey > toKey ? fromKey : toKey;
    const startRange = startKey ? buildLocalDayIsoRange(startKey) : null;
    const endRange = endKey ? buildLocalDayIsoRange(endKey) : null;
    const fromIso = startRange?.startIso ?? "";
    const toExclusiveIso = endRange?.endIsoExclusive ?? "";

    let cancelled = false;
    let loadTimeout: any = null;
    setDetailLoading(true);

    const load = async () => {
      const token = ++detailLoadTokenRef.current;
      // Guard: timeout the load if it takes too long
      loadTimeout = setTimeout(() => {
        if (cancelled) return;
        cancelled = true;
        setDetailLoading(false);
        setDataError("Tiempo de respuesta agotado. Intenta buscar de nuevo.");
      }, 20000);
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < allowedCompanies.length; i += 30) {
          chunks.push(allowedCompanies.slice(i, i + 30));
        }

        const queries: Array<Promise<any[]>> = [];
        if (allowedCompanies.length === 1) {
          queries.push(
            ReportesMovimientosService.listDetailItems({
              fromIso,
              toExclusiveIso,
              empresa: allowedCompanies[0],
              accountIds,
              currency: detailRequest.currency,
              classification: detailRequest.classification,
              paymentType: detailRequest.paymentType,
            }) as any,
          );
        } else if (accountIds.length > 1) {
          accountIds.forEach((accountId) => {
            chunks.forEach((chunk) => {
              queries.push(
                ReportesMovimientosService.listDetailItems({
                  fromIso,
                  toExclusiveIso,
                  empresas: chunk,
                  accountIds: [accountId],
                  currency: detailRequest.currency,
                  classification: detailRequest.classification,
                  paymentType: detailRequest.paymentType,
                }) as any,
              );
            });
          });
        } else {
          chunks.forEach((chunk) => {
            queries.push(
              ReportesMovimientosService.listDetailItems({
                fromIso,
                toExclusiveIso,
                empresas: chunk,
                accountIds,
                currency: detailRequest.currency,
                classification: detailRequest.classification,
                paymentType: detailRequest.paymentType,
              }) as any,
            );
          });
        }

        // If there are no queries to run, reset quickly if this is the current load
        if (queries.length === 0) {
          if (detailLoadTokenRef.current === token) {
            setDetailItems([]);
            setDetailLoading(false);
          }
          return;
        }
        // Execute queries sequentially to avoid overwhelming the network when many chunks exist
        const allItems: any[] = [];
        for (const promise of queries) {
          if (cancelled || detailLoadTokenRef.current !== token) break;
          const partial = await promise;
          if (Array.isArray(partial)) {
            allItems.push(...partial);
          } else if (partial) {
            allItems.push(partial);
          }
        }
        const dedup = new Map<string, any>();
        allItems.forEach((it) => {
          const key = String(it?.movementId || it?.id || "");
          if (!key) return;
          dedup.set(key, it);
        });
        const items = Array.from(dedup.values());

        const filtered =
          selectedMovementTypes.length > 0 && !detailRequest.paymentType
            ? items.filter((i) =>
                selectedMovementTypes.includes(i.paymentType as any),
              )
            : items;

        // Ensure this is still the latest load
        if (cancelled || detailLoadTokenRef.current !== token) return;
        const mapped: ReportMovementDetail[] = filtered.map((i) => ({
          id: i.movementId || i.id,
          createdAt: i.createdAt,
          providerCode: String(i.providerCode || ""),
          invoiceNumber: String(i.invoiceNumber || ""),
          manager: String((i as any).manager || ""),
          notes: String(i.notes || ""),
          paymentType: i.paymentType,
          accountId: i.accountId,
          currency: i.currency,
          amountIngreso: i.amountIngreso,
          amountEgreso: i.amountEgreso,
          companyName: i.empresa,
        }));

        if (cancelled || detailLoadTokenRef.current !== token) return;
        setDetailItems(mapped);
      } catch (err) {
        console.error("Error loading report detail items:", err);
        if (cancelled) return;
        // Provide user feedback when the detail load fails
        try {
          // @ts-ignore
          setDataError(
            "Error al cargar el detalle de movimientos. Verifica filtros o intenta de nuevo.",
          );
        } catch {
          // ignore
        }
        setDetailItems([]);
      } finally {
        if (loadTimeout) clearTimeout(loadTimeout);
        if (cancelled) return;
        setDetailLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (loadTimeout) clearTimeout(loadTimeout);
    };
  }, [
    detailRequest,
    dateRangeInvalid,
    selectedCompany,
    selectedAccount,
    accessibleAccountKeys,
    companies,
    fromDate,
    toDate,
    selectedMovementTypes,
    detailReloadTrigger,
  ]);

  useEffect(() => {
    if (!detailRequest) return;
    const companySet = new Set(
      detailItems
        .map((e) => e.companyName?.trim())
        .filter((v): v is string => Boolean(v)),
    );
    const companiesToLoad = Array.from(companySet).filter(
      (companyName) => !loadedProviderCompaniesRef.current.has(companyName),
    );
    if (companiesToLoad.length === 0) return;

    let cancelled = false;

    const loadProviders = async () => {
      try {
        const results = await Promise.all(
          companiesToLoad.map(async (companyName) => {
            const providers = await ProvidersService.getProviders(companyName);
            return { companyName, providers };
          }),
        );

        const next: Record<string, string> = {};
        results.forEach(({ companyName, providers }) => {
          providers.forEach((provider) => {
            const code = normalizeProviderCode((provider as any)?.code);
            const name = String((provider as any)?.name || "").trim();
            if (!code || !name) return;
            next[`${companyName}::${code}`] = name;
          });
        });

        if (!cancelled) {
          companiesToLoad.forEach((companyName) =>
            loadedProviderCompaniesRef.current.add(companyName),
          );
          setProviderNameLookup((prev) => ({ ...prev, ...next }));
        }
      } catch (err) {
        console.error("Error loading providers for report detail modal:", err);
      }
    };

    void loadProviders();
    return () => {
      cancelled = true;
    };
  }, [detailRequest, detailItems]);

  const detailMovements = useMemo<ReportMovementDetail[]>(() => {
    if (!detailRequest) return [];
    return detailItems.map((entry) => {
      const normalizedCode = normalizeProviderCode(entry.providerCode);
      const key = `${entry.companyName}::${normalizedCode}`;
      const providerName = providerNameLookup[key];
      return {
        ...entry,
        providerCode: providerName || entry.providerCode,
      };
    });
  }, [detailRequest, detailItems, providerNameLookup]);

  const detailSubtitle = useMemo(() => {
    if (!detailRequest) return "";
    const companyLabel =
      selectedCompany === ALL_COMPANIES_VALUE
        ? "Todas las empresas"
        : selectedCompany || "(Sin empresa)";

    const accountLabel =
      selectedAccount === ALL_ACCOUNTS_VALUE
        ? "Todas las cuentas"
        : selectedAccount
          ? ACCOUNT_LABELS[selectedAccount as MovementAccountKey]
          : "(Sin cuenta)";

    const dateLabel = fromDate && toDate ? `${fromDate} → ${toDate}` : "";
    return [companyLabel, accountLabel, dateLabel].filter(Boolean).join(" · ");
  }, [detailRequest, selectedCompany, selectedAccount, fromDate, toDate]);

  useEffect(() => {
    setSelectedMovementTypes((prev) => {
      if (prev.length === 0) return prev;
      const allowed = new Set(movementTypeOptions.map(([value]) => value));
      const filtered = prev.filter((type) => allowed.has(type));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [movementTypeOptions]);

  useEffect(() => {
    if (!movementTypeSelectorOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const container = movementTypeSelectorRef.current;
      if (!container) return;
      if (container.contains(event.target as Node)) return;
      setMovementTypeSelectorOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMovementTypeSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [movementTypeSelectorOpen]);

  useEffect(() => {
    if (movementTypeOptions.length === 0) {
      setMovementTypeSelectorOpen(false);
    }
  }, [movementTypeOptions]);

  useEffect(() => {
    try {
      localStorage.setItem("mostrartipos", classificationFilter);
    } catch (error) {
      console.error(
        "Error saving classificationFilter to localStorage:",
        error,
      );
    }
  }, [classificationFilter]);

  useEffect(() => {
    try {
      localStorage.setItem("showUSD", showUSD.toString());
    } catch (error) {
      console.error("Error saving showUSD to localStorage:", error);
    }
  }, [showUSD]);

  const summaryRows = useMemo<SummaryRow[]>(() => {
    if (dateRangeInvalid) return [];
    if (!entries.length) return [];

    const buckets = new Map<FondoMovementType, SummaryRow>();

    entries.forEach((entry) => {
      if (
        selectedMovementTypes.length > 0 &&
        !selectedMovementTypes.includes(entry.paymentType)
      )
        return;

      const currency: MovementCurrencyKey =
        entry.currency === "USD" ? "USD" : "CRC";

      if (!buckets.has(entry.paymentType)) {
        buckets.set(entry.paymentType, {
          paymentType: entry.paymentType,
          label: formatMovementType(entry.paymentType),
          classification: "gasto",
          totals: {
            CRC: { ingreso: 0, gasto: 0, egreso: 0 },
            USD: { ingreso: 0, gasto: 0, egreso: 0 },
          },
        });
      }

      const bucket = buckets.get(entry.paymentType)!;
      const currencyTotals = bucket.totals[currency];
      currencyTotals.ingreso += entry.amountIngreso || 0;
      currencyTotals.gasto += entry.amountGasto || 0;
      currencyTotals.egreso += entry.amountEgreso || 0;
    });

    const classifyBucket = (row: SummaryRow): Classification => {
      const ingreso = row.totals.CRC.ingreso + row.totals.USD.ingreso;
      const gasto = row.totals.CRC.gasto + row.totals.USD.gasto;
      const egreso = row.totals.CRC.egreso + row.totals.USD.egreso;
      if (Math.trunc(ingreso) !== 0) return "ingreso";
      if (Math.trunc(gasto) !== 0) return "gasto";
      return "egreso";
    };

    const orderMap: Record<Classification, number> = {
      ingreso: 0,
      gasto: 1,
      egreso: 2,
    };

    return Array.from(buckets.values())
      .map((row) => {
        const classification = classifyBucket(row);
        return { ...row, classification };
      })
      .filter((row) => {
        if (classificationFilter === "all") return true;
        return row.classification === classificationFilter;
      })
      .sort((a, b) => {
        const byGroup = orderMap[a.classification] - orderMap[b.classification];
        if (byGroup !== 0) return byGroup;
        return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
      });
  }, [entries, dateRangeInvalid, classificationFilter, selectedMovementTypes]);

  const totals = useMemo(() => {
    return summaryRows.reduce<Record<MovementCurrencyKey, CurrencyBucket>>(
      (acc, row) => {
        (["CRC", "USD"] as MovementCurrencyKey[]).forEach((currency) => {
          acc[currency].ingreso += row.totals[currency].ingreso;
          acc[currency].gasto += row.totals[currency].gasto;
          acc[currency].egreso += row.totals[currency].egreso;
        });
        return acc;
      },
      {
        CRC: { ingreso: 0, gasto: 0, egreso: 0 },
        USD: { ingreso: 0, gasto: 0, egreso: 0 },
      },
    );
  }, [summaryRows]);

  const openTotalsDetailModal = useCallback(
    (classification: Classification, currency: MovementCurrencyKey) => {
      const amount = totals[currency][classification];
      if (!Number.isFinite(amount) || Math.trunc(amount) === 0) return;
      setDetailRequest({
        label: "Totales",
        classification,
        currency,
      });
    },
    [totals],
  );

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
          <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!hasGeneralAccess) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
          <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al reporte del Fondo General.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador si crees que es un error.
          </p>
        </div>
      </div>
    );
  }

  const noCompanyAvailable =
    !companiesLoading && !isAdminUser && !assignedCompany;
  const accountUnavailable = accessibleAccountKeys.length === 0;
  const searchDisabled =
    companiesLoading ||
    dataLoading ||
    dateRangeInvalid ||
    noCompanyAvailable ||
    accountUnavailable ||
    (isAdminUser ? !selectedCompany : !assignedCompany) ||
    !selectedAccount;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Resumen por tipo de movimiento
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Consulta los movimientos agrupados por categoría dentro del rango de
            fechas seleccionado. Usa la casilla &quot;Solo gastos&quot; si
            deseas ocultar egresos bancarios u otros movimientos que no sean
            gastos operativos.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
              Empresa
            </label>
            {isAdminUser ? (
              <select
                value={selectedCompany}
                onChange={(event) => setSelectedCompany(event.target.value)}
                className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
                disabled={companiesLoading || companies.length === 0}
              >
                {companies.length > 1 && (
                  <option
                    value={ALL_COMPANIES_VALUE}
                    className="text-[var(--foreground)] bg-[var(--card-bg)]"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                  >
                    Todas las empresas
                  </option>
                )}
                {companies.map((name) => (
                  <option
                    key={name}
                    value={name}
                    className="text-[var(--foreground)] bg-[var(--card-bg)]"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                  >
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--muted)]/10">
                {assignedCompany || "Sin empresa asignada"}
              </div>
            )}
            {companiesError && (
              <p className="mt-2 text-xs text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{companiesError}</span>
              </p>
            )}
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
              Cuenta
            </label>
            {accountUnavailable ? (
              <div className="rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--muted)]/10">
                Sin cuentas disponibles
              </div>
            ) : accessibleAccountKeys.length === 1 ? (
              <div className="rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--muted)]/10">
                {ACCOUNT_LABELS[accessibleAccountKeys[0]]}
              </div>
            ) : (
              <select
                value={selectedAccount}
                onChange={(event) =>
                  setSelectedAccount(event.target.value as AccountSelectValue)
                }
                className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
              >
                {accountSelectOptions.map((option) => (
                  <option
                    key={option}
                    value={option}
                    className="text-[var(--foreground)] bg-[var(--card-bg)]"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                  >
                    {option === ALL_ACCOUNTS_VALUE
                      ? "Todas las cuentas"
                      : ACCOUNT_LABELS[option]}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                  Desde
                </label>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setQuickRange("");
                  }}
                  className="w-full rounded-md border border-[var(--input-border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                  Hasta
                </label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setQuickRange("");
                  }}
                  className="w-full rounded-md border border-[var(--input-border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                  Filtro de fecha
                </label>
                <select
                  className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                  value={quickRange}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuickRange(v);
                    if (!v) return;

                    const now = new Date();
                    let from: Date | null = null;
                    let to: Date | null = null;

                    if (v === "today") {
                      const t = new Date(now);
                      from = t;
                      to = t;
                    } else if (v === "yesterday") {
                      const y = new Date(now);
                      y.setDate(y.getDate() - 1);
                      from = y;
                      to = y;
                    } else if (v === "thisweek") {
                      const d = new Date(now);
                      const day = d.getDay();
                      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                      const start = new Date(d);
                      start.setDate(diff);
                      from = start;
                      to = new Date(now);
                    } else if (v === "lastweek") {
                      const d = new Date(now);
                      const day = d.getDay();
                      const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
                      const start = new Date(d);
                      start.setDate(diff);
                      const end = new Date(start);
                      end.setDate(start.getDate() + 6);
                      from = start;
                      to = end;
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
                      const end = new Date(now);
                      const start = new Date(now);
                      start.setDate(start.getDate() - 29);
                      from = start;
                      to = end;
                    }

                    if (from && to) {
                      setFromDate(buildDateString(from));
                      setToDate(buildDateString(to));
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
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] sm:col-span-2 lg:col-span-4 bg-[var(--muted)]/5">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={classificationFilter === "gasto"}
                  onChange={() => handleClassificationToggle("gasto")}
                  className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
                <span>Solo mostrar gastos</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={classificationFilter === "egreso"}
                  onChange={() => handleClassificationToggle("egreso")}
                  className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
                <span>Solo mostrar egresos</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={classificationFilter === "ingreso"}
                  onChange={() => handleClassificationToggle("ingreso")}
                  className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
                <span>Solo mostrar ingresos</span>
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showUSD}
                onChange={(event) => setShowUSD(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              />
              <span>Mostrar dólares</span>
            </label>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="button"
              onClick={runSearch}
              disabled={searchDisabled}
              className="px-4 py-2 rounded-md bg-[var(--success)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
            >
              {dataLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Buscar
            </button>
          </div>
          {hasSearched && entries.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  Tipos de movimiento
                </label>
                {selectedMovementTypes.length > 0 && (
                  <button
                    type="button"
                    onClick={clearMovementTypeFilters}
                    className="text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card-bg)]"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
              {movementTypeOptions.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  No hay tipos de movimiento disponibles con los filtros
                  seleccionados.
                </p>
              ) : (
                <div ref={movementTypeSelectorRef} className="relative mt-2">
                  <button
                    type="button"
                    onClick={() => setMovementTypeSelectorOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <span className="truncate pr-3">
                      {movementTypeSummaryLabel}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform ${
                        movementTypeSelectorOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {movementTypeSelectorOpen && (
                    <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-lg">
                      <div className="flex flex-col gap-2">
                        {movementTypeOptions.map(([movementType, label]) => (
                          <label
                            key={movementType}
                            className="flex items-center gap-2 text-sm text-[var(--foreground)]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedMovementTypes.includes(
                                movementType,
                              )}
                              onChange={() => toggleMovementType(movementType)}
                              className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Usa el selector desplegable para filtrar la tabla por tipos
                específicos.
              </p>
            </div>
          )}
        </div>

        {dateRangeInvalid && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            <span>
              El rango de fechas es inválido. Ajusta las fechas para continuar.
            </span>
          </div>
        )}

        {noCompanyAvailable && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            Tu usuario no tiene una empresa asignada. Solicita a un
            administrador que te asigne una antes de consultar el reporte.
          </div>
        )}

        {accountUnavailable && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            No tienes permisos para ninguna cuenta del Fondo General. Pide
            acceso a un administrador.
          </div>
        )}

        {dataError && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            <span>{dataError}</span>
            <button
              type="button"
              onClick={() => {
                setDataError(null);
                setDetailReloadTrigger((n) => n + 1);
              }}
              className="ml-2 rounded px-2 py-1 bg-[var(--card-bg)] border border-[var(--input-border)] text-sm text-[var(--foreground)] hover:bg-[var(--muted-foreground)]"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="mt-6">
          {dataLoading ? (
            <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
              <Loader2 className="h-5 w-5 animate-spin mr-3" />
              Cargando reportes OLAP...
            </div>
          ) : summaryRows.length === 0 ? (
            <div className="rounded-md border border-[var(--input-border)] bg-[var(--muted)]/10 px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
              {dateRangeInvalid
                ? "Ajusta el rango de fechas para ver resultados."
                : !hasSearched
                  ? 'Presiona "Buscar" para consultar con los filtros seleccionados.'
                  : "No hay movimientos que coincidan con los filtros seleccionados."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--input-border)]">
              <table className="min-w-full divide-y divide-[var(--input-border)]">
                <thead className="bg-[var(--muted)]/10">
                  <tr className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-4 py-3 text-left font-semibold">
                      Tipo de movimiento
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Clasificación
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Ingresos ₡
                    </th>
                    {showUSD && (
                      <th className="px-4 py-3 text-right font-semibold">
                        Ingresos $
                      </th>
                    )}
                    <th className="px-4 py-3 text-right font-semibold">
                      Gastos ₡
                    </th>
                    {showUSD && (
                      <th className="px-4 py-3 text-right font-semibold">
                        Gastos $
                      </th>
                    )}
                    <th className="px-4 py-3 text-right font-semibold">
                      Egresos ₡
                    </th>
                    {showUSD && (
                      <th className="px-4 py-3 text-right font-semibold">
                        Egresos $
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--input-border)] bg-[var(--card-bg)]">
                  {summaryRows.map((row) => (
                    <tr
                      key={row.paymentType}
                      className="text-sm text-[var(--foreground)]"
                    >
                      <td className="px-4 py-3 font-medium">{row.label}</td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">
                        {formatClassification(row.classification)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right ${
                          row.totals.CRC.ingreso ? "cursor-pointer" : ""
                        }`}
                        onClick={() => openDetailModal(row, "ingreso", "CRC")}
                        title={
                          row.totals.CRC.ingreso
                            ? "Doble click para ver movimientos"
                            : undefined
                        }
                      >
                        {formatAmount("CRC", row.totals.CRC.ingreso)}
                      </td>
                      {showUSD && (
                        <td
                          className={`px-4 py-3 text-right ${
                            row.totals.USD.ingreso ? "cursor-pointer" : ""
                          }`}
                          onClick={() => openDetailModal(row, "ingreso", "USD")}
                          title={
                            row.totals.USD.ingreso
                              ? "Doble click para ver movimientos"
                              : undefined
                          }
                        >
                          {formatAmount("USD", row.totals.USD.ingreso)}
                        </td>
                      )}
                      <td
                        className={`px-4 py-3 text-right ${
                          row.totals.CRC.gasto ? "cursor-pointer" : ""
                        }`}
                        onClick={() => openDetailModal(row, "gasto", "CRC")}
                        title={
                          row.totals.CRC.gasto
                            ? "Doble click para ver movimientos"
                            : undefined
                        }
                      >
                        {formatAmount("CRC", row.totals.CRC.gasto)}
                      </td>
                      {showUSD && (
                        <td
                          className={`px-4 py-3 text-right ${
                            row.totals.USD.gasto ? "cursor-pointer" : ""
                          }`}
                          onClick={() => openDetailModal(row, "gasto", "USD")}
                          title={
                            row.totals.USD.gasto
                              ? "Doble click para ver movimientos"
                              : undefined
                          }
                        >
                          {formatAmount("USD", row.totals.USD.gasto)}
                        </td>
                      )}
                      <td
                        className={`px-4 py-3 text-right ${
                          row.totals.CRC.egreso ? "cursor-pointer" : ""
                        }`}
                        onClick={() => openDetailModal(row, "egreso", "CRC")}
                        title={
                          row.totals.CRC.egreso
                            ? "Doble click para ver movimientos"
                            : undefined
                        }
                      >
                        {formatAmount("CRC", row.totals.CRC.egreso)}
                      </td>
                      {showUSD && (
                        <td
                          className={`px-4 py-3 text-right ${
                            row.totals.USD.egreso ? "cursor-pointer" : ""
                          }`}
                          onClick={() => openDetailModal(row, "egreso", "USD")}
                          title={
                            row.totals.USD.egreso
                              ? "Doble click para ver movimientos"
                              : undefined
                          }
                        >
                          {formatAmount("USD", row.totals.USD.egreso)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-white/10 border-t border-white/20">
                  <tr className="text-sm font-semibold text-[var(--foreground)]">
                    <td className="px-4 py-3" colSpan={2}>
                      Totales
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        totals.CRC.ingreso ? "cursor-pointer" : ""
                      }`}
                      onClick={() => openTotalsDetailModal("ingreso", "CRC")}
                      title={
                        totals.CRC.ingreso
                          ? "Doble click para ver movimientos"
                          : undefined
                      }
                    >
                      {formatAmount("CRC", totals.CRC.ingreso)}
                    </td>
                    {showUSD && (
                      <td
                        className={`px-4 py-3 text-right ${
                          totals.USD.ingreso ? "cursor-pointer" : ""
                        }`}
                        onClick={() => openTotalsDetailModal("ingreso", "USD")}
                        title={
                          totals.USD.ingreso
                            ? "Doble click para ver movimientos"
                            : undefined
                        }
                      >
                        {formatAmount("USD", totals.USD.ingreso)}
                      </td>
                    )}
                    <td
                      className={`px-4 py-3 text-right ${
                        totals.CRC.gasto ? "cursor-pointer" : ""
                      }`}
                      onClick={() => openTotalsDetailModal("gasto", "CRC")}
                      title={
                        totals.CRC.gasto
                          ? "Doble click para ver movimientos"
                          : undefined
                      }
                    >
                      {formatAmount("CRC", totals.CRC.gasto)}
                    </td>
                    {showUSD && (
                      <td
                        className={`px-4 py-3 text-right ${
                          totals.USD.gasto ? "cursor-pointer" : ""
                        }`}
                        onClick={() => openTotalsDetailModal("gasto", "USD")}
                        title={
                          totals.USD.gasto
                            ? "Doble click para ver movimientos"
                            : undefined
                        }
                      >
                        {formatAmount("USD", totals.USD.gasto)}
                      </td>
                    )}
                    <td
                      className={`px-4 py-3 text-right ${
                        totals.CRC.egreso ? "cursor-pointer" : ""
                      }`}
                      onClick={() => openTotalsDetailModal("egreso", "CRC")}
                      title={
                        totals.CRC.egreso
                          ? "Doble click para ver movimientos"
                          : undefined
                      }
                    >
                      {formatAmount("CRC", totals.CRC.egreso)}
                    </td>
                    {showUSD && (
                      <td
                        className={`px-4 py-3 text-right ${
                          totals.USD.egreso ? "cursor-pointer" : ""
                        }`}
                        onClick={() => openTotalsDetailModal("egreso", "USD")}
                        title={
                          totals.USD.egreso
                            ? "Doble click para ver movimientos"
                            : undefined
                        }
                      >
                        {formatAmount("USD", totals.USD.egreso)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      <ReportMovementsDetailModal
        isOpen={Boolean(detailRequest)}
        onClose={closeDetailModal}
        title={
          detailRequest
            ? `${detailRequest.label} · ${formatClassification(
                detailRequest.classification,
              )} · ${detailRequest.currency}`
            : "Detalle"
        }
        subtitle={detailSubtitle}
        currency={detailRequest?.currency ?? "CRC"}
        formatAmount={formatAmount}
        movements={detailMovements}
        loading={detailLoading}
        amountSelector={(movement) =>
          detailRequest?.classification === "ingreso"
            ? movement.amountIngreso
            : movement.amountEgreso
        }
        splitByCompany={selectedCompany === ALL_COMPANIES_VALUE}
      />
    </div>
  );
}
