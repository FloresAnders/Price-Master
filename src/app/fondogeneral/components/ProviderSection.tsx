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
  Layers,
  Tag,
  Lock,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquare,
} from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useProviders } from "@/hooks/useProviders";
import { useActorOwnership } from "@/hooks/useActorOwnership";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { Empresas, User } from "@/types/firestore";
import { getDefaultPermissions } from "@/utils/permissions";
import { dateKeyToISODate, dateToKey, isoDateToDateKey } from "@/utils/dateKey";
import { findBestStringMatch } from "@/utils/stringSimilarity";
import { EmpresasService } from "@/services/empresas";
import { UsersService } from "@/services/users";
import { FondoMovementTypesService } from "@/services/fondo-movement-types";
import { SchedulesService } from "@/services/schedules";
import { generateEgresoProviderCreatedEmail } from "@/services/email-templates/proveedor-egreso-creado";
import { getAuthoritativeNowISO } from "@/utils/serverTime";
import type { FondoMovementType } from "../types";
import { formatMovementType, isEgresoType } from "../utils/movementTypes/movementTypes";

const SHARED_COMPANY_STORAGE_KEY = "fg_selected_company_shared";

const includesMovementType = (types: readonly string[], value: unknown): boolean => {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return types.some(
    (type) => String(type ?? "").trim().toUpperCase().replace(/\s+/g, " ") === normalized,
  );
};

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
export function ProviderSection({ id }: { id?: string }) {
  const { user, loading: authLoading } = useAuth();
  const assignedCompany = user?.ownercompanie?.trim() ?? "";
  const { ownerIds: actorOwnerIds } = useActorOwnership(user);
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
  const isAdminUser = user?.role === "admin";
  const isSuperAdminUser = user?.role === "superadmin";
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
    error,
    addProvider,
    removeProvider,
    updateProvider,
  } = useProviders(company);
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const canManageFondoGeneral = Boolean(permissions.fondogeneral);
  const [ownerCompanies, setOwnerCompanies] = useState<Empresas[]>([]);
  const [ownerCompaniesLoading, setOwnerCompaniesLoading] = useState(false);
  const [ownerCompaniesError, setOwnerCompaniesError] = useState<string | null>(
    null,
  );
  const providerTypesOwnerId = useMemo(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    const firstAllowedOwner = Array.from(allowedOwnerIds)[0] || "";
    if (firstAllowedOwner) return String(firstAllowedOwner).trim();

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

      const fallbackOwnerId =
        ownerCompanies
          .find(
            (emp) =>
              typeof emp.ownerId === "string" && emp.ownerId.trim().length > 0,
          )
          ?.ownerId?.trim() || "";
      if (fallbackOwnerId) return fallbackOwnerId;
    }

    const directOwnerId =
      typeof user?.ownerId === "string" ? user.ownerId.trim() : "";
    if (directOwnerId) return directOwnerId;

    return typeof user?.id === "string" ? user.id.trim() : "";
  }, [
    adminCompany,
    allowedOwnerIds,
    canSelectCompany,
    ownerCompanies,
    user?.id,
    user?.ownerId,
  ]);
  const activeOwnerId = providerTypesOwnerId;

  const sortedOwnerCompanies = useMemo(() => {
    const normalize = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    // Dedupe by the same value key used in the <option value>
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

    // If there is a named company for an ubicacion, hide the ubicacion-only entry.
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

  const [providerName, setProviderName] = useState("");
  const [providerType, setProviderType] = useState<FondoMovementType | "">("");
  const [providerAgentName, setProviderAgentName] = useState("");
  const [providerAgentPhone, setProviderAgentPhone] = useState("");
  const [showProviderAgentFields, setShowProviderAgentFields] = useState(false);
  const [editingProviderCode, setEditingProviderCode] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [providerTypeError, setProviderTypeError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [providerDrawerOpen, setProviderDrawerOpen] = useState(false);
  const [addNotification, setAddNotification] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  type ProviderVisitDay = "D" | "L" | "M" | "MI" | "J" | "V" | "S";
  type ProviderVisitFrequency = "SEMANAL" | "QUINCENAL" | "MENSUAL" | "22 DIAS";
  type ProviderAgentConfig = {
    name: string;
    phone: string;
  };
  type ProviderVisitConfig = {
    createOrderDays: ProviderVisitDay[];
    receiveOrderDays: ProviderVisitDay[];
    frequency: ProviderVisitFrequency;
    startDateKey?: number;
  };

  const VISIT_DAY_ORDER = useMemo<ProviderVisitDay[]>(
    () => ["D", "L", "M", "MI", "J", "V", "S"],
    [],
  );
  const VISIT_DAY_TITLES = useMemo<Record<ProviderVisitDay, string>>(
    () => ({
      D: "Domingo",
      L: "Lunes",
      M: "Martes",
      MI: "Miércoles",
      J: "Jueves",
      V: "Viernes",
      S: "Sábado",
    }),
    [],
  );
  const VISIT_FREQUENCY_OPTIONS = useMemo<
    Array<{ value: ProviderVisitFrequency; label: string }>
  >(
    () => [
      { value: "SEMANAL", label: "Semanal" },
      { value: "QUINCENAL", label: "Quincenal" },
      { value: "22 DIAS", label: "22 días" },
      { value: "MENSUAL", label: "Mensual" },
    ],
    [],
  );

  const [addVisit, setAddVisit] = useState(false);
  const [visitCreateDays, setVisitCreateDays] = useState<ProviderVisitDay[]>(
    [],
  );
  const [visitReceiveDays, setVisitReceiveDays] = useState<ProviderVisitDay[]>(
    [],
  );
  const [visitFrequency, setVisitFrequency] = useState<
    ProviderVisitFrequency | ""
  >("");
  const [visitStartDateISO, setVisitStartDateISO] = useState<string>("");

  const formatProviderPhone = useCallback((value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }, []);

  const resetProviderFormState = useCallback(() => {
    setFormError(null);
    setProviderTypeError("");
    setProviderName("");
    setProviderType("");
    setEditingProviderCode(null);
    setAddNotification(false);
    setSelectedAdminId("");
    setProviderAgentName("");
    setProviderAgentPhone("");
    setShowProviderAgentFields(false);
    setAddVisit(false);
    setVisitCreateDays([]);
    setVisitReceiveDays([]);
    setVisitFrequency("");
    setVisitStartDateISO("");
  }, []);

  const getProviderAgent = useCallback((): ProviderAgentConfig | undefined => {
    const name = providerAgentName.trim();
    const phone = formatProviderPhone(providerAgentPhone).trim();
    if (!name && !phone) return undefined;
    return { name, phone };
  }, [formatProviderPhone, providerAgentName, providerAgentPhone]);

  const isCompraInventarioProvider =
    typeof providerType === "string" &&
    providerType.trim().toUpperCase() === "COMPRA INVENTARIO";

  const sortVisitDays = useCallback(
    (days: ProviderVisitDay[]) => {
      return [...days].sort(
        (a, b) => VISIT_DAY_ORDER.indexOf(a) - VISIT_DAY_ORDER.indexOf(b),
      );
    },
    [VISIT_DAY_ORDER],
  );

  const toggleVisitDay = useCallback(
    (
      day: ProviderVisitDay,
      setter: React.Dispatch<React.SetStateAction<ProviderVisitDay[]>>,
    ) => {
      setter((prev) => {
        const exists = prev.includes(day);
        const next = exists ? prev.filter((d) => d !== day) : [...prev, day];
        return sortVisitDays(next);
      });
    },
    [sortVisitDays],
  );

  useEffect(() => {
    if (!isCompraInventarioProvider) {
      setAddVisit(false);
      setVisitCreateDays([]);
      setVisitReceiveDays([]);
      setVisitFrequency("");
      setVisitStartDateISO("");
    }
  }, [isCompraInventarioProvider]);

  useEffect(() => {
    // Si no es semanal, permitir configurar fecha inicial.
    // Para semanal, limpiar la fecha inicial.
    if (!addVisit) return;
    if (!visitFrequency) {
      setVisitStartDateISO("");
      return;
    }
    if (visitFrequency === "SEMANAL") {
      if (visitStartDateISO) setVisitStartDateISO("");
      return;
    }
    // Si se selecciona frecuencia no semanal y aún no hay fecha, sugerir hoy.
    if (!visitStartDateISO) {
      setVisitStartDateISO(dateKeyToISODate(dateToKey(new Date())));
    }
  }, [addVisit, visitFrequency, visitStartDateISO]);

  // Estado para tipos de movimientos dinámicos
  const [fondoTypesLoaded, setFondoTypesLoaded] = useState(false);
  const [ingresoTypes, setIngresoTypes] = useState<string[]>([]);
  const [gastoTypes, setGastoTypes] = useState<string[]>([]);
  const [egresoTypes, setEgresoTypes] = useState<string[]>([]);

  // Helper para determinar la categoría basándose en los tipos del owner
  const getCategoryForType = (
    type?: string,
  ): "Ingreso" | "Gasto" | "Egreso" | undefined => {
    if (!type || typeof type !== "string") return undefined;
    if (includesMovementType(ingresoTypes, type)) return "Ingreso";
    if (includesMovementType(gastoTypes, type)) return "Gasto";
    if (includesMovementType(egresoTypes, type)) return "Egreso";
    return undefined;
  };

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    code: string;
    name: string;
  }>({
    open: false,
    code: "",
    name: "",
  });

  const pendingProviderSaveRef = useRef<null | {
    mode: "create" | "update";
    code?: string;
    name: string;
    providerType?: FondoMovementType;
    correonotifi?: string;
    agent?: ProviderAgentConfig;
    visit?: ProviderVisitConfig;
  }>(null);

  // Cache para evitar consultas repetidas (se mantiene en memoria por sesión)
  const schedulesMonthCacheRef = useRef<
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
  const ownerAdminEmailCacheRef = useRef<
    Map<string, { at: number; promise: Promise<string> }>
  >(new Map());

  const SCHEDULES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  const OWNER_ADMIN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

  const getMonthlySchedulesCached = useCallback(
    async (locationValue: string, year: number, month0: number) => {
      const key = `${locationValue}__${year}__${month0}`;
      const now = Date.now();
      const cached = schedulesMonthCacheRef.current.get(key);
      if (cached && now - cached.at < SCHEDULES_CACHE_TTL_MS) {
        return cached.promise;
      }
      const promise = SchedulesService.getSchedulesByLocationYearMonth(
        locationValue,
        year,
        month0,
      );
      schedulesMonthCacheRef.current.set(key, { at: now, promise });
      return promise;
    },
    [SCHEDULES_CACHE_TTL_MS],
  );

  const getOwnerPrimaryAdminEmailCached = useCallback(
    async (ownerId: string): Promise<string> => {
      const normalized = (ownerId || "").trim();
      if (!normalized) return "";
      const now = Date.now();
      const cached = ownerAdminEmailCacheRef.current.get(normalized);
      if (cached && now - cached.at < OWNER_ADMIN_CACHE_TTL_MS) {
        return cached.promise;
      }
      const promise = (async () => {
        const admin = await UsersService.getPrimaryAdminByOwner(normalized);
        return typeof admin?.email === "string" ? admin.email.trim() : "";
      })();
      ownerAdminEmailCacheRef.current.set(normalized, { at: now, promise });
      return promise;
    },
    [OWNER_ADMIN_CACHE_TTL_MS],
  );
  const [similarConfirmOpen, setSimilarConfirmOpen] = useState(false);
  const [similarConfirmMessage, setSimilarConfirmMessage] =
    useState<React.ReactNode>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | "all">(10);
  const [showOnlyWithEmail, setShowOnlyWithEmail] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("provider-filter-email");
    return saved === "true";
  });
  const companySelectId = `provider-company-select-${id ?? "default"}`;
  const showCompanySelector =
    canSelectCompany &&
    (ownerCompaniesLoading ||
      sortedOwnerCompanies.length > 0 ||
      !!ownerCompaniesError);

  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEmail =
        !showOnlyWithEmail ||
        (p.correonotifi && p.correonotifi.trim().length > 0);
      return matchesSearch && matchesEmail;
    });
  }, [providers, searchTerm, showOnlyWithEmail]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === "all") return 1;
    return Math.ceil(filteredProviders.length / itemsPerPage);
  }, [filteredProviders.length, itemsPerPage]);

  const paginatedProviders = useMemo(() => {
    if (itemsPerPage === "all") return filteredProviders;
    return filteredProviders.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );
  }, [filteredProviders, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  // Guardar preferencia de filtro de correo en localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "provider-filter-email",
        showOnlyWithEmail.toString(),
      );
    }
  }, [showOnlyWithEmail]);

  // Escuchar cambios de empresa desde FondoSection (sincronización bidireccional)
  useEffect(() => {
    if (!canSelectCompany) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === SHARED_COMPANY_STORAGE_KEY &&
        event.newValue &&
        event.newValue !== adminCompany
      ) {
        setAdminCompany(event.newValue);
        // Reset form state when company changes from external source
        setProviderDrawerOpen(false);
        resetProviderFormState();
        setDeletingCode(null);
        setConfirmState({ open: false, code: "", name: "" });
        setCurrentPage(1);
        setSearchTerm("");
        setItemsPerPage(10);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [canSelectCompany, adminCompany, resetProviderFormState]);

  const notificationOwnerId = useMemo(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    if (!user) return "";

    // Admin/Superadmin: ownerId de la empresa seleccionada
    if (canSelectCompany) {
      const normalizedSelected = normalizeCompanyKey(adminCompany);
      if (!normalizedSelected) return "";
      const match = ownerCompanies.find((emp) => {
        const candidates = [emp?.name, emp?.ubicacion, emp?.id]
          .map(normalizeCompanyKey)
          .filter(Boolean);
        return candidates.includes(normalizedSelected);
      });
      return typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
    }

    // Otros: si tiene ownerId usarlo, si no (dueño) usar su propio id
    if (user.ownerId && user.ownerId.trim().length > 0)
      return user.ownerId.trim();
    return (user.id || "").trim();
  }, [adminCompany, canSelectCompany, ownerCompanies, user]);

  const sendEgresoProviderCreatedEmailToOwner = useCallback(
    async (
      providerName: string,
      providerType?: FondoMovementType,
    ): Promise<void> => {
      try {
        if (!providerType) return;
        if (!isEgresoType(providerType)) return;

        const resolveCreatedByFromControlHorario = async (
          createdAtISO: string,
        ): Promise<string> => {
          const fallback = (
            user?.name?.trim() ||
            user?.email?.trim() ||
            user?.id ||
            "Sistema"
          ).toString();

          const normalizedCompany = (company || "").trim();
          if (!normalizedCompany) return fallback;

          // En producción, `companieValue` en schedules puede estar guardado como `name`, `ubicacion` o `id`
          // según cómo se haya seleccionado la empresa al registrar el horario.
          // Si podemos, intentamos con varias claves para evitar mismatch.
          const companyKeysToTry = (() => {
            const set = new Set<string>();
            set.add(normalizedCompany);

            if (canSelectCompany && ownerCompanies.length > 0) {
              const normalizeCompanyKey = (value: unknown) =>
                String(value || "")
                  .trim()
                  .toLowerCase();

              const selectedKey = normalizeCompanyKey(adminCompany);
              const match = ownerCompanies.find((emp) => {
                const candidates = [emp?.name, emp?.ubicacion, emp?.id]
                  .map(normalizeCompanyKey)
                  .filter(Boolean);
                return candidates.includes(selectedKey);
              });

              [match?.name, match?.ubicacion, match?.id]
                .map((v) =>
                  typeof v === "string" ? v.trim() : String(v || "").trim(),
                )
                .filter(Boolean)
                .forEach((v) => set.add(v));
            }

            return Array.from(set);
          })();

          const createdDate = new Date(createdAtISO);
          if (Number.isNaN(createdDate.getTime())) return fallback;
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Costa_Rica",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(createdDate);

          const getPart = (type: string) =>
            parts.find((p) => p.type === type)?.value ?? "";

          const year = Number(getPart("year"));
          const month1 = Number(getPart("month"));
          const day = Number(getPart("day"));
          const hour = Number(getPart("hour"));

          if (
            !Number.isFinite(year) ||
            !Number.isFinite(month1) ||
            !Number.isFinite(day) ||
            !Number.isFinite(hour)
          ) {
            return fallback;
          }

          // Regla: cambio de turno a las 4pm (16:00) Costa Rica.
          // Antes de las 4pm => turno "D". Desde las 4pm => turno "N".
          const shift = hour >= 16 ? "N" : "D";

          // En schedules se usa month en formato JS (0-11)
          const month0 = Math.max(0, Math.min(11, month1 - 1));

          try {
            const schedulesLists = await Promise.all(
              companyKeysToTry.map((key) =>
                getMonthlySchedulesCached(key, year, month0),
              ),
            );
            const monthSchedules = schedulesLists.flat();

            const matches = monthSchedules
              .filter((entry) => entry.day === day && entry.shift === shift)
              .map((entry) => (entry.employeeName || "").trim())
              .filter(Boolean);

            if (matches.length === 0) return fallback;

            const normalizedUserName = (user?.name || "").trim().toLowerCase();
            const direct = normalizedUserName
              ? matches.find(
                  (name) => name.toLowerCase() === normalizedUserName,
                )
              : undefined;
            if (direct) return direct;

            return matches
              .slice()
              .sort((a, b) =>
                a.localeCompare(b, "es", { sensitivity: "base" }),
              )[0];
          } catch (err) {
            console.error(
              "[PROVIDER-EGRESO-EMAIL] Error resolving createdBy from schedules:",
              err,
            );
            return fallback;
          }
        };

        const ownerId = (notificationOwnerId || "").trim();
        if (!ownerId) return;

        const toEmail = await getOwnerPrimaryAdminEmailCached(ownerId);
        if (!toEmail) return;

        const createdAt = await getAuthoritativeNowISO();
        const createdBy = await resolveCreatedByFromControlHorario(createdAt);

        const emailContent = generateEgresoProviderCreatedEmail({
          company: company || "",
          providerName,
          providerType,
          createdBy,
          createdAt,
        });

        await addDoc(collection(db, "mail"), {
          to: toEmail,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error(
          "[PROVIDER-EGRESO-EMAIL] Error sending owner notification:",
          err,
        );
        // La notificación es secundaria: no bloquear creación del proveedor
      }
    },
    [
      adminCompany,
      canSelectCompany,
      company,
      getMonthlySchedulesCached,
      getOwnerPrimaryAdminEmailCached,
      notificationOwnerId,
      ownerCompanies,
      user,
    ],
  );

  // Cargar admins cuando se necesite para notificaciones
  useEffect(() => {
    if (!addNotification || !user) {
      setAdminUsers([]);
      return;
    }

    let isMounted = true;
    setLoadingAdmins(true);

    const referenceOwnerId = notificationOwnerId;
    if (!referenceOwnerId) {
      setAdminUsers([]);
      setLoadingAdmins(false);
      return;
    }

    UsersService.findUsersByRole("admin")
      .then((allAdmins) => {
        if (!isMounted) return;

        // Filtrar admins que cumplan cualquiera de estas condiciones:
        // 1. Admins que tengan el mismo ownerId que el referenceOwnerId
        // 2. El admin "dueño" cuyo id sea igual al referenceOwnerId (sin ownerId o ownerId vacío)
        const filtered = allAdmins.filter((admin) => {
          const hasEmail = admin.email && admin.email.trim().length > 0;
          if (!hasEmail) return false;

          // Condición 1: Admin con el mismo ownerId
          const sameOwnerId =
            admin.ownerId && admin.ownerId.trim() === referenceOwnerId;

          // Condición 2: Admin dueño (su id es el referenceOwnerId y no tiene ownerId)
          const isOwnerAdmin =
            admin.id === referenceOwnerId &&
            (!admin.ownerId || admin.ownerId.trim().length === 0);

          return sameOwnerId || isOwnerAdmin;
        });

        setAdminUsers(filtered);
        setSelectedAdminId((prev) => prev || filtered[0]?.id || "");
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error loading admin users:", err);
        setAdminUsers([]);
      })
      .finally(() => {
        if (isMounted) setLoadingAdmins(false);
      });

    return () => {
      isMounted = false;
    };
  }, [addNotification, notificationOwnerId, user]);

  // Cargar tipos de movimientos de fondo desde la base de datos (con caché y sincronización en tiempo real)
  useEffect(() => {
    let isMounted = true;

    // Función para cargar y actualizar tipos
    const loadTypes = async () => {
      try {
        const types =
          await FondoMovementTypesService.getMovementTypesByCategoriesWithCache(
            activeOwnerId,
          );

        if (!isMounted) return;

        setIngresoTypes(types.INGRESO);
        setGastoTypes(types.GASTO);
        setEgresoTypes(types.EGRESO);
        setFondoTypesLoaded(true);

        // El paymentType de ajustes de cierre se normaliza al persistir.

        console.log("[FondoTypes] Loaded:", types);
      } catch (err) {
        console.error("Error loading fondo movement types:", err);
        if (isMounted) {
          setFondoTypesLoaded(true);
        }
      }
    };

    // Listener para actualizaciones en tiempo real desde el caché
    const handleFondoTypesUpdate = (event: Event) => {
      const eventOwnerId = String(
        (event as CustomEvent<{ ownerId?: string }>).detail?.ownerId || "",
      ).trim();
      if (activeOwnerId && eventOwnerId && eventOwnerId !== activeOwnerId) {
        return;
      }
      if (!isMounted) return;

      console.log("[FondoTypes] Cache updated, reloading types...");

      // Recargar tipos cuando el caché se actualiza
      loadTypes();
    };

    // Cargar tipos iniciales (desde caché o DB)
    loadTypes();

    // Escuchar actualizaciones en tiempo real
    window.addEventListener(
      "fondoMovementTypesUpdated",
      handleFondoTypesUpdate,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "fondoMovementTypesUpdated",
        handleFondoTypesUpdate,
      );
    };
  }, [activeOwnerId]);

  const handleAdminCompanyChange = useCallback(
    (value: string) => {
      if (!canSelectCompany) return;
      setAdminCompany(value);
      try {
        localStorage.setItem(SHARED_COMPANY_STORAGE_KEY, value);
        // Disparar evento de storage manualmente para sincronizar dentro de la misma ventana
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: SHARED_COMPANY_STORAGE_KEY,
            newValue: value,
            oldValue: adminCompany,
            storageArea: localStorage,
          }),
        );
      } catch (error) {
        console.error("Error saving selected company to localStorage:", error);
      }
      setProviderDrawerOpen(false);
      resetProviderFormState();
      setDeletingCode(null);
      setConfirmState({ open: false, code: "", name: "" });
      setCurrentPage(1);
      setSearchTerm("");
      setItemsPerPage(10);
    },
    [canSelectCompany, resetProviderFormState, adminCompany],
  );

  // provider creation is handled from the drawer UI below

  const openRemoveModal = (code: string, name: string) => {
    if (!company) return;
    setConfirmState({ open: true, code, name });
  };

  const openEditProvider = (code: string) => {
    const prov = providers.find((p) => p.code === code);
    if (!prov) return;
    setEditingProviderCode(prov.code);
    setProviderName(prov.name ?? "");
    setProviderType((prov.type as FondoMovementType) ?? "");
    setProviderTypeError("");
    setProviderAgentName(prov.agent?.name ?? "");
    setProviderAgentPhone(formatProviderPhone(prov.agent?.phone ?? ""));
    setShowProviderAgentFields(Boolean(prov.agent));
    // Cargar datos de notificación si existen
    if (prov.correonotifi && prov.correonotifi.trim().length > 0) {
      setAddNotification(true);
      // Intentar encontrar el admin con ese correo
      const matchingAdmin = adminUsers.find(
        (admin) => admin.email === prov.correonotifi,
      );
      if (matchingAdmin?.id) {
        setSelectedAdminId(matchingAdmin.id);
      }
    } else {
      setAddNotification(false);
      setSelectedAdminId("");
    }

    if (prov.visit && (prov.type || "").toUpperCase() === "COMPRA INVENTARIO") {
      setAddVisit(true);
      setVisitCreateDays(
        (prov.visit.createOrderDays || []) as ProviderVisitDay[],
      );
      setVisitReceiveDays(
        (prov.visit.receiveOrderDays || []) as ProviderVisitDay[],
      );
      setVisitFrequency((prov.visit.frequency || "") as ProviderVisitFrequency);

      const startKey = (prov.visit as any).startDateKey;
      if (
        typeof startKey === "number" &&
        Number.isFinite(startKey) &&
        startKey > 0
      ) {
        setVisitStartDateISO(dateKeyToISODate(startKey));
      } else {
        setVisitStartDateISO("");
      }
    } else {
      setAddVisit(false);
      setVisitCreateDays([]);
      setVisitReceiveDays([]);
      setVisitFrequency("");
      setVisitStartDateISO("");
    }

    setProviderDrawerOpen(true);
  };

  const cancelRemoveModal = () => {
    if (deletingCode) return;
    setConfirmState({ open: false, code: "", name: "" });
  };

  const closeRemoveModal = () =>
    setConfirmState({ open: false, code: "", name: "" });

  const confirmRemoveProvider = async () => {
    if (!company) return;
    if (!confirmState.code || deletingCode) return;

    try {
      setFormError(null);
      setDeletingCode(confirmState.code);
      await removeProvider(confirmState.code);
      closeRemoveModal();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo eliminar el proveedor.";
      setFormError(message);
      closeRemoveModal();
    } finally {
      setDeletingCode(null);
    }
  };

  const resolvedError = formError || error;
  const isLoading = authLoading || providersLoading;

  if (authLoading) {
    return (
      <div id={id} className="mt-10">
        <div className="p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded text-center">
          <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!canManageFondoGeneral) {
    return (
      <div id={id} className="mt-10">
        <AccessRestrictedMessage description="No tienes permisos para administrar proveedores del Fondo General." />
      </div>
    );
  }

  if (!fondoTypesLoaded) {
    return (
      <div id={id}>
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
    <div id={id}>
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-medium text-[var(--muted-foreground)] flex items-center gap-2">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted-foreground)]" />
              Proveedores
            </h2>
            {company && (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--input-border)] px-2.5 py-1 text-[10px] sm:text-xs text-[var(--foreground)] whitespace-nowrap">
                <span className="text-[var(--muted-foreground)]">Empresa</span>
                <span className="font-semibold text-[var(--foreground)] truncate max-w-[160px] sm:max-w-none">
                  {company}
                </span>
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] sm:text-xs text-[var(--muted-foreground)]">
            Administra proveedores del Fondo General.
          </p>
        </div>

        <div className="flex w-full flex-col sm:w-auto sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3">
          {showCompanySelector && (
            <div className="flex w-full sm:w-auto flex-col gap-1">
              <label
                htmlFor={companySelectId}
                className="text-[10px] sm:text-xs text-[var(--muted-foreground)]"
              >
                Empresa
              </label>
              <select
                id={companySelectId}
                value={adminCompany}
                onChange={(event) =>
                  handleAdminCompanyChange(event.target.value)
                }
                disabled={
                  ownerCompaniesLoading || sortedOwnerCompanies.length === 0
                }
                className="w-full sm:min-w-[220px] lg:min-w-[260px] h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
              >
                {(() => {
                  const getCompanyKey = (emp: Empresas) =>
                    String(emp?.name || emp?.ubicacion || emp?.id || "").trim();
                  const getCompanyLabel = (emp: Empresas) => {
                    const name = String(emp?.name || "").trim();
                    const ubicacion = String(emp?.ubicacion || "").trim();
                    if (
                      name &&
                      ubicacion &&
                      name.toLowerCase() !== ubicacion.toLowerCase()
                    ) {
                      return `${name} (${ubicacion})`;
                    }
                    return (
                      name || ubicacion || getCompanyKey(emp) || "Sin nombre"
                    );
                  };

                  return (
                    <>
                      {ownerCompaniesLoading && (
                        <option value="">Cargando empresas...</option>
                      )}
                      {!ownerCompaniesLoading &&
                        sortedOwnerCompanies.length === 0 && (
                          <option value="">Sin empresas disponibles</option>
                        )}
                      {!ownerCompaniesLoading &&
                        sortedOwnerCompanies.length > 0 && (
                          <>
                            <option value="" disabled>
                              Selecciona una empresa
                            </option>
                            {sortedOwnerCompanies.map((emp, index) => (
                              <option
                                key={
                                  emp.id ||
                                  emp.name ||
                                  emp.ubicacion ||
                                  `admin-company-${index}`
                                }
                                value={getCompanyKey(emp)}
                                className="border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] hover:shadow-md hover:shadow-sky-950/25 active:translate-y-0 active:scale-[0.99]"
                              >
                                {getCompanyLabel(emp)}
                              </option>
                            ))}
                          </>
                        )}
                    </>
                  );
                })()}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setProviderDrawerOpen(true);
              setFormError(null);
              setProviderTypeError("");
              setProviderName("");
              setProviderType("");
              setEditingProviderCode(null);
              setAddNotification(false);
              setSelectedAdminId("");

              setAddVisit(false);
              setVisitCreateDays([]);
              setVisitReceiveDays([]);
              setVisitFrequency("");
            }}
            disabled={!company || saving || providersLoading}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded border px-3 text-sm font-semibold shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] disabled:pointer-events-none disabled:opacity-50 ${
              !company || saving || providersLoading
                ? "cursor-not-allowed border-[var(--input-border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)] opacity-70"
                : "border-[var(--accent)] bg-transparent text-[var(--foreground)] hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-transparent hover:shadow-md hover:shadow-sky-950/25 active:translate-y-0 active:scale-[0.99]"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Agregar proveedor</span>
          </button>
        </div>
      </div>

      {!authLoading && !company && !isAdminUser && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Tu usuario no tiene una empresa asociada; no es posible registrar
          proveedores.
        </p>
      )}
      {!authLoading && !company && isAdminUser && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Selecciona una empresa para administrar proveedores.
        </p>
      )}

      {resolvedError && (
        <div className="mb-4 text-sm text-red-500">{resolvedError}</div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
          <h3 className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
            Lista de proveedores
          </h3>
        </div>
        {!isLoading && (
          <div className="mb-3 sm:mb-4 space-y-2 sm:space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground)]/70" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código o correo…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 sm:h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label
                  htmlFor="filter-with-email"
                  title="Muestra solo proveedores con correo de notificación"
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 cursor-pointer select-none transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-within:ring-2 focus-within:ring-[var(--accent)]/40 focus-within:ring-offset-1 focus-within:ring-offset-[var(--card-bg)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                >
                  <input
                    type="checkbox"
                    id="filter-with-email"
                    checked={showOnlyWithEmail}
                    onChange={(e) => {
                      setShowOnlyWithEmail(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="mt-0.5 sm:mt-0 h-4 w-4 cursor-pointer rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                  />
                  <span className="text-xs sm:text-sm text-[var(--foreground)] whitespace-nowrap">
                    Solo con correo
                  </span>
                  <span className="sm:hidden text-[10px] text-[var(--muted-foreground)] leading-tight">
                    Solo proveedores con correo de notificación.
                  </span>
                </label>
                <div className="hidden sm:block text-[10px] sm:text-xs text-[var(--muted-foreground)] leading-tight">
                  Filtra por correo de notificación.
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="items-per-page"
                  className="text-xs sm:text-sm text-[var(--muted-foreground)] whitespace-nowrap"
                >
                  Mostrar
                </label>
                <select
                  id="items-per-page"
                  value={
                    itemsPerPage === "all" ? "all" : itemsPerPage.toString()
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    setItemsPerPage(value === "all" ? "all" : parseInt(value));
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                </select>
              </div>

              {itemsPerPage !== "all" && totalPages > 1 && (
                <div className="flex items-center gap-2 justify-center sm:justify-end">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[var(--foreground)] text-xs sm:text-sm whitespace-nowrap px-1">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {isLoading ? (
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] py-4 text-center">
            Cargando proveedores...
          </p>
        ) : (
          <div>
            <ul className="space-y-1.5 sm:space-y-2">
              {filteredProviders.length === 0 && (
                <li className="text-xs sm:text-sm text-[var(--muted-foreground)] py-4 text-center">
                  {searchTerm
                    ? "No se encontraron proveedores."
                    : "Aun no hay proveedores."}
                </li>
              )}
              {paginatedProviders.map((p) => (
                <li
                  key={p.code}
                  className="group overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/35 hover:bg-[var(--card-bg)]/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="flex-1 min-w-0 px-3 sm:px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base text-[var(--foreground)] font-semibold truncate">
                              {p.name}
                            </span>
                            {p.correonotifi?.trim() && (
                              <span
                                title={`Correo: ${p.correonotifi}`}
                                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5 text-[10px] text-[var(--foreground)]"
                              >
                                <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
                                <span className="truncate">Con correo</span>
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs text-[var(--muted-foreground)]">
                            <span className="inline-flex items-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5">
                              Código:{" "}
                              <span className="ml-1 text-[var(--foreground)]">
                                {p.code}
                              </span>
                            </span>
                            <span className="inline-flex items-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5">
                              Empresa:{" "}
                              <span className="ml-1 text-[var(--foreground)]">
                                {p.company}
                              </span>
                            </span>
                            {p.type && (
                              <span className="inline-flex items-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5">
                                Tipo:{" "}
                                <span className="ml-1 text-[var(--foreground)]">
                                  {p.type}
                                </span>
                              </span>
                            )}
                            {p.category && (
                              <span className="inline-flex items-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5">
                                {p.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 px-2.5 py-2 sm:px-3 sm:py-3 border-t sm:border-t-0 sm:border-l border-[var(--input-border)] bg-black/10">
                      <button
                        type="button"
                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50 p-2.5 sm:p-2 rounded-md hover:bg-white/5 transition-colors"
                        onClick={() => openEditProvider(p.code)}
                        disabled={saving || deletingCode !== null}
                        title="Editar proveedor"
                        aria-label="Editar proveedor"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <div className="w-px h-7 bg-[var(--input-border)]" />

                      <button
                        type="button"
                        className="text-red-500 hover:text-red-400 disabled:opacity-50 p-2.5 sm:p-2 rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 transition-colors"
                        onClick={() => openRemoveModal(p.code, p.name)}
                        disabled={
                          deletingCode === p.code ||
                          saving ||
                          deletingCode !== null
                        }
                        title="Eliminar (requiere confirmación)"
                        aria-label="Eliminar proveedor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmState.open}
        title="Eliminar proveedor"
        message={`Quieres eliminar el proveedor "${
          confirmState.name || confirmState.code
        }"? Esta accion no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        actionType="delete"
        loading={deletingCode !== null && deletingCode === confirmState.code}
        onConfirm={confirmRemoveProvider}
        onCancel={cancelRemoveModal}
      />

      <ConfirmModal
        open={similarConfirmOpen}
        title="Nombre demasiado similar"
        message={similarConfirmMessage}
        confirmText="Continuar"
        cancelText="Cancelar"
        actionType="change"
        loading={saving}
        onConfirm={async () => {
          const pending = pendingProviderSaveRef.current;
          if (!pending) {
            setSimilarConfirmOpen(false);
            return;
          }

          try {
            setSaving(true);
            setFormError(null);
            const agent = getProviderAgent();

            if (pending.mode === "update" && pending.code) {
              await updateProvider(
                pending.code,
                pending.name,
                pending.providerType,
                pending.correonotifi,
                agent,
                pending.visit,
                getCategoryForType(pending.providerType),
              );
            } else {
              await addProvider(
                pending.name,
                pending.providerType,
                pending.correonotifi,
                agent,
                pending.visit,
                getCategoryForType(pending.providerType),
              );

              await sendEgresoProviderCreatedEmailToOwner(
                pending.name,
                pending.providerType,
              );
            }

            pendingProviderSaveRef.current = null;
            resetProviderFormState();

            setProviderDrawerOpen(false);
            setSimilarConfirmOpen(false);
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : "No se pudo guardar el proveedor.";
            setFormError(message);
          } finally {
            setSaving(false);
          }
        }}
        onCancel={() => {
          pendingProviderSaveRef.current = null;
          setSimilarConfirmOpen(false);
        }}
      />

      <Drawer
        anchor="right"
        open={providerDrawerOpen}
        onClose={() => {
          setProviderDrawerOpen(false);
          resetProviderFormState();
        }}
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
              {editingProviderCode ? "Editar proveedor" : "Agregar proveedor"}
            </Typography>
            <IconButton
              aria-label="Cerrar"
              onClick={() => {
                setProviderDrawerOpen(false);
                resetProviderFormState();
              }}
              sx={{ color: "var(--foreground)" }}
            >
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: "var(--input-border)" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
            {company && (
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Empresa asignada:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {company}
                </span>
              </p>
            )}
            {resolvedError && (
              <div className="mb-4 text-sm text-red-500">{resolvedError}</div>
            )}

            <div className="flex flex-col gap-3">
              <input
                className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
                placeholder="Nombre del proveedor"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value.toUpperCase())}
                disabled={!company || saving || deletingCode !== null}
                autoFocus
              />
              <select
                value={providerType}
                onChange={(e) => {
                  const nextType = e.target.value as FondoMovementType | "";
                  setProviderType(nextType);
                  setProviderTypeError("");

                  const normalized = String(nextType || "")
                    .trim()
                    .toUpperCase();

                  if (normalized === "COMPRA INVENTARIO") {
                    // Al seleccionar COMPRA INVENTARIO, activar visita automáticamente.
                    setAddVisit(true);
                  } else {
                    // Si se cambia a otro tipo, limpiar configuración de visita.
                    setAddVisit(false);
                    setVisitCreateDays([]);
                    setVisitReceiveDays([]);
                    setVisitFrequency("");
                  }
                }}
                className={`w-full h-11 rounded-lg border bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] ${
                  providerTypeError
                    ? "border-red-500"
                    : "border-[var(--input-border)]"
                }`}
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
                disabled={!company || saving}
              >
                <option value="">Seleccione un tipo</option>
                <optgroup label="Ingresos">
                  {ingresoTypes.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatMovementType(opt)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Gastos">
                  {gastoTypes.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatMovementType(opt)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Egresos">
                  {egresoTypes.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatMovementType(opt)}
                    </option>
                  ))}
                </optgroup>
              </select>
              {providerTypeError && (
                <p className="text-xs text-red-500">{providerTypeError}</p>
              )}

              {/* Checkbox para agregar notificación */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="add-notification-checkbox"
                  checked={addNotification}
                  onChange={(e) => {
                    setAddNotification(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedAdminId("");
                    }
                  }}
                  disabled={!company || saving}
                  className="w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor="add-notification-checkbox"
                  className="text-sm text-[var(--foreground)] cursor-pointer"
                >
                  Agregar Notificación
                </label>
              </div>

              {/* Selector de admin para notificación */}
              {addNotification && (
                <div className="mt-2">
                  {loadingAdmins ? (
                    <div className="text-xs text-[var(--muted-foreground)] p-2">
                      Cargando administradores...
                    </div>
                  ) : adminUsers.length === 0 ? (
                    <div className="text-xs text-red-500 p-2">
                      {isSuperAdminUser
                        ? "No hay administradores disponibles con correo electrónico para la empresa seleccionada."
                        : "No hay administradores disponibles con correo electrónico en tu organización."}
                    </div>
                  ) : (
                    <>
                      <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                        Seleccionar administrador para notificaciones:
                      </label>
                      <select
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                        className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                        style={{
                          backgroundColor: "var(--card-bg)",
                          color: "var(--foreground)",
                        }}
                        disabled={!company || saving}
                      >
                        <option value="">Seleccione un administrador</option>
                        {adminUsers.map((admin) => (
                          <option key={admin.id} value={admin.id || ""}>
                            {admin.name || admin.email} ({admin.email})
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderAgentFields((current) => {
                      const next = !current;
                      if (!next) {
                        setProviderAgentName("");
                        setProviderAgentPhone("");
                      }
                      return next;
                    });
                  }}
                  disabled={!company || saving}
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>
                    {showProviderAgentFields ? "Ocultar agente" : "Agregar agente"}
                  </span>
                </button>

                {showProviderAgentFields && (
                  <div className="mt-3 space-y-3 rounded border border-[var(--input-border)] bg-[var(--input-bg)] p-3">
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                        Nombre del agente
                      </label>
                      <input
                        type="text"
                        value={providerAgentName}
                        onChange={(e) => setProviderAgentName(e.target.value)}
                        placeholder="Nombre del agente"
                        className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                        style={{
                          backgroundColor: "var(--card-bg)",
                          color: "var(--foreground)",
                        }}
                        disabled={!company || saving}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                        Número de teléfono
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={providerAgentPhone}
                        onChange={(e) =>
                          setProviderAgentPhone(
                            formatProviderPhone(e.target.value),
                          )
                        }
                        placeholder="8888-8888"
                        maxLength={9}
                        className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                        style={{
                          backgroundColor: "var(--card-bg)",
                          color: "var(--foreground)",
                        }}
                        disabled={!company || saving}
                      />
                    </div>
                  </div>
                )}
              </div>

              {isCompraInventarioProvider && (
                <div className="mt-2 rounded border border-[var(--input-border)] p-3 bg-[var(--input-bg)]">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="add-visit-checkbox"
                      checked={addVisit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAddVisit(checked);
                        if (!checked) {
                          setVisitCreateDays([]);
                          setVisitReceiveDays([]);
                          setVisitFrequency("");
                          setVisitStartDateISO("");
                        }
                      }}
                      disabled={!company || saving}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor="add-visit-checkbox"
                      className="text-sm text-[var(--foreground)] cursor-pointer"
                    >
                      Agregar visita
                    </label>
                  </div>

                  {addVisit && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-xs text-[var(--muted-foreground)] mb-1">
                          Día de realizar pedido
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {VISIT_DAY_ORDER.map((day) => {
                            const selected = visitCreateDays.includes(day);
                            return (
                              <button
                                key={`visit-create-${day}`}
                                type="button"
                                onClick={() =>
                                  toggleVisitDay(day, setVisitCreateDays)
                                }
                                title={VISIT_DAY_TITLES[day]}
                                className={`px-2 py-1 rounded border text-xs transition-colors ${
                                  selected
                                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                    : "bg-[var(--input-bg)] text-[var(--foreground)] border-[var(--input-border)]"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-[var(--muted-foreground)] mb-1">
                          Día de recibir pedido
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {VISIT_DAY_ORDER.map((day) => {
                            const selected = visitReceiveDays.includes(day);
                            return (
                              <button
                                key={`visit-receive-${day}`}
                                type="button"
                                onClick={() =>
                                  toggleVisitDay(day, setVisitReceiveDays)
                                }
                                title={VISIT_DAY_TITLES[day]}
                                className={`px-2 py-1 rounded border text-xs transition-colors ${
                                  selected
                                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                    : "bg-[var(--input-bg)] text-[var(--foreground)] border-[var(--input-border)]"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                          Frecuencia
                        </label>
                        <select
                          value={visitFrequency}
                          onChange={(e) =>
                            setVisitFrequency(
                              e.target.value as ProviderVisitFrequency | "",
                            )
                          }
                          className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                          style={{
                            backgroundColor: "var(--card-bg)",
                            color: "var(--foreground)",
                          }}
                          disabled={!company || saving}
                        >
                          <option value="">Seleccione una frecuencia</option>
                          {VISIT_FREQUENCY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {visitFrequency && visitFrequency !== "SEMANAL" ? (
                        <div>
                          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                            Fecha inicial
                          </label>
                          <input
                            type="date"
                            value={visitStartDateISO}
                            onChange={(e) =>
                              setVisitStartDateISO(e.target.value)
                            }
                            className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                            style={{
                              backgroundColor: "var(--card-bg)",
                              color: "var(--foreground)",
                            }}
                            disabled={!company || saving}
                          />
                          <div className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                            Define desde qué semana empieza el ciclo
                            (quincenal/22 días/mensual).
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setProviderDrawerOpen(false);
                  resetProviderFormState();
                }}
                className="px-4 py-2 border border-[var(--input-border)] rounded text-[var(--foreground)] hover:bg-[var(--muted)]"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const name = providerName.trim().toUpperCase();
                  const agent = getProviderAgent();
                  if (!name) {
                    setFormError("Nombre requerido.");
                    return;
                  }
                  if (!company) {
                    setFormError("Tu usuario no tiene una empresa asignada.");
                    return;
                  }

                  if (!providerType) {
                    setProviderTypeError("Debe seleccionar un tipo.");
                    return;
                  }
                  if (providersLoading) {
                    setFormError("Espera a que carguen los proveedores.");
                    return;
                  }

                  // Validar que si se marcó notificación, se haya seleccionado un admin
                  if (addNotification && !selectedAdminId) {
                    setFormError(
                      "Debe seleccionar un administrador para las notificaciones.",
                    );
                    return;
                  }

                  // Obtener el correo del admin seleccionado
                  let correonotifi: string | undefined = undefined;
                  if (addNotification && selectedAdminId) {
                    const selectedAdmin = adminUsers.find(
                      (admin) => admin.id === selectedAdminId,
                    );
                    if (selectedAdmin?.email) {
                      correonotifi = selectedAdmin.email;
                    }
                  }

                  let visit: ProviderVisitConfig | undefined = undefined;
                  if (isCompraInventarioProvider && addVisit) {
                    if (visitCreateDays.length === 0) {
                      setFormError(
                        "Debe seleccionar al menos un día para crear pedido.",
                      );
                      return;
                    }
                    if (visitReceiveDays.length === 0) {
                      setFormError(
                        "Debe seleccionar al menos un día para recibir pedido.",
                      );
                      return;
                    }
                    if (!visitFrequency) {
                      setFormError(
                        "Debe seleccionar una frecuencia de visita.",
                      );
                      return;
                    }

                    let startDateKey: number | undefined = undefined;
                    if (visitFrequency !== "SEMANAL") {
                      const key = isoDateToDateKey(visitStartDateISO);
                      if (!key) {
                        setFormError(
                          "Debe seleccionar una fecha inicial válida.",
                        );
                        return;
                      }
                      startDateKey = key;
                    }

                    visit = {
                      createOrderDays: visitCreateDays,
                      receiveOrderDays: visitReceiveDays,
                      frequency: visitFrequency as ProviderVisitFrequency,
                      ...(typeof startDateKey === "number"
                        ? { startDateKey }
                        : {}),
                    };
                  }

                  try {
                    setFormError(null);
                    setProviderTypeError("");

                    const normalizedProviderType = providerType || undefined;

                    if (editingProviderCode) {
                      const otherProviders = providers.filter(
                        (p) => p.code !== editingProviderCode,
                      );
                      if (
                        otherProviders.some(
                          (p) => p.name.toUpperCase() === name,
                        )
                      ) {
                        setFormError(`El proveedor "${name}" ya existe.`);
                        return;
                      }

                      const { best, score } = findBestStringMatch(
                        name,
                        otherProviders.map((p) => p.name),
                      );
                      if (best && score >= 0.9) {
                        const similarProvider = otherProviders.find(
                          (p) => p.name === best,
                        );
                        const similarTypeLabel = similarProvider?.type
                          ? formatMovementType(similarProvider.type)
                          : "";
                        pendingProviderSaveRef.current = {
                          mode: "update",
                          code: editingProviderCode,
                          name,
                          providerType: normalizedProviderType,
                          correonotifi,
                          agent,
                          visit,
                        };
                        setSimilarConfirmMessage(
                          <div className="w-full flex flex-col items-center text-center">
                            <p className="text-center">
                              Detectamos un nombre demasiado similar.
                            </p>

                            <div className="mt-3 space-y-2">
                              <div className="flex items-start justify-center gap-2 w-full">
                                <UserPlus className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                <div className="min-w-0 flex flex-col items-center">
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    Nuevo proveedor
                                  </div>
                                  <div className="font-semibold break-words">
                                    &apos;{name}&apos;
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-start justify-center gap-2 w-full">
                                <Layers className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                <div className="min-w-0 flex flex-col items-center">
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    Proveedor existente
                                  </div>
                                  <div className="font-semibold break-words">
                                    &apos;{best}&apos;
                                  </div>
                                </div>
                              </div>

                              {similarTypeLabel && (
                                <div className="flex items-start justify-center gap-2 w-full">
                                  <Tag className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                  <div className="min-w-0 flex flex-col items-center">
                                    <div className="text-xs text-[var(--muted-foreground)]">
                                      Tipo del existente
                                    </div>
                                    <div className="break-words">
                                      {similarTypeLabel}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="text-xs text-[var(--muted-foreground)] pt-1 text-center">
                                Similitud: {Math.round(score * 100)}%
                              </div>
                            </div>

                            <p className="mt-4 text-center">
                              ¿Deseas continuar y guardarlo de todas formas?
                            </p>
                          </div>,
                        );
                        setSimilarConfirmOpen(true);
                        return;
                      }

                      setSaving(true);
                      await updateProvider(
                        editingProviderCode,
                        name,
                        normalizedProviderType,
                        correonotifi,
                        agent,
                        visit,
                      );
                    } else {
                      if (
                        providers.some((p) => p.name.toUpperCase() === name)
                      ) {
                        setFormError(`El proveedor "${name}" ya existe.`);
                        return;
                      }

                      const { best, score } = findBestStringMatch(
                        name,
                        providers.map((p) => p.name),
                      );
                      if (best && score >= 0.9) {
                        const similarProvider = providers.find(
                          (p) => p.name === best,
                        );
                        const similarTypeLabel = similarProvider?.type
                          ? formatMovementType(similarProvider.type)
                          : "";
                        pendingProviderSaveRef.current = {
                          mode: "create",
                          name,
                          providerType: normalizedProviderType,
                          correonotifi,
                          agent,
                          visit,
                        };
                        setSimilarConfirmMessage(
                          <div className="w-full flex flex-col items-center text-center">
                            <p className="text-center">
                              Detectamos un nombre demasiado similar.
                            </p>

                            <div className="mt-3 space-y-2">
                              <div className="flex items-start justify-center gap-2 w-full">
                                <UserPlus className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                <div className="min-w-0 flex flex-col items-center">
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    Nuevo proveedor
                                  </div>
                                  <div className="font-semibold break-words">
                                    &apos;{name}&apos;
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-start justify-center gap-2 w-full">
                                <Layers className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                <div className="min-w-0 flex flex-col items-center">
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    Proveedor existente
                                  </div>
                                  <div className="font-semibold break-words">
                                    &apos;{best}&apos;
                                  </div>
                                </div>
                              </div>

                              {similarTypeLabel && (
                                <div className="flex items-start justify-center gap-2 w-full">
                                  <Tag className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                  <div className="min-w-0 flex flex-col items-center">
                                    <div className="text-xs text-[var(--muted-foreground)]">
                                      Tipo del existente
                                    </div>
                                    <div className="break-words">
                                      {similarTypeLabel}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="text-xs text-[var(--muted-foreground)] pt-1 text-center">
                                Similitud: {Math.round(score * 100)}%
                              </div>
                            </div>

                            <p className="mt-4 text-center">
                              ¿Deseas continuar y guardarlo de todas formas?
                            </p>
                          </div>,
                        );
                        setSimilarConfirmOpen(true);
                        return;
                      }

                      setSaving(true);
                      await addProvider(
                        name,
                        normalizedProviderType,
                        correonotifi,
                        agent,
                        visit,
                        getCategoryForType(normalizedProviderType),
                      );

                      await sendEgresoProviderCreatedEmailToOwner(
                        name,
                        normalizedProviderType,
                      );
                    }
                    resetProviderFormState();
                    setProviderDrawerOpen(false);
                  } catch (err) {
                    const message =
                      err instanceof Error
                        ? err.message
                        : "No se pudo guardar el proveedor.";
                    setFormError(message);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                disabled={!company || saving || deletingCode !== null}
              >
                {saving
                  ? editingProviderCode
                    ? "Actualizando..."
                    : "Guardando..."
                  : editingProviderCode
                    ? "Actualizar"
                    : "Guardar"}
              </button>
            </div>
          </Box>
        </Box>
      </Drawer>
    </div>
  );
}
