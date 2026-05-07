"use client";
import Image from "next/image";
import Fireworks from "fireworks-js";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Scan,
  Calculator,
  Type,
  FileCode,
  Banknote,
  Smartphone,
  Clock,
  Truck,
  Settings,
  History,
  Users,
  Star,
  Plus,
  Search,
  ArrowRight,
  Sparkles,
  Activity,
  BarChart3,
} from "lucide-react";
import AnimatedStickman from "../ui/AnimatedStickman";
import { CustomIcon } from "../../icons/icons";
import { User, UserPermissions } from "../../types/firestore";
import { getDefaultPermissions } from "../../utils/permissions";
import { useProviders } from "../../hooks/useProviders";
import { useControlPedido } from "../../hooks/useControlPedido";
import { MovimientosFondosService } from "../../services/movimientos-fondos";
import { EmpresasService } from "../../services/empresas";
import type { ControlPedidoEntry } from "../../services/controlpedido";
import {
  addDays,
  dateToKey,
  nextBusinessDay,
  visitDayFromDate,
  weekStartKeyFromDateKey,
} from "../../utils/dateKey";
import { SupplierWeekSection } from "../business/SupplierWeekSection";
import {
  getAccessibleHomeMenuFavoriteOptions,
  HomeMenuFavoriteOption,
  HomeMenuFavoriteGroup,
  HomeMenuMaintenanceTab,
} from "./homeMenuFavoritesCatalog";
import {
  addHomeMenuFavorite,
  getHomeMenuFavorites,
  removeHomeMenuFavorite,
} from "../../services/homeMenuFavoritesDb";

const MAINTENANCE_TAB_STORAGE_KEY = "pricemaster:maintenance-active-tab";
const MAINTENANCE_TAB_EVENT = "pricemaster:maintenance-tab-change";

const menuItems = [
  {
    id: "scanner",
    name: "Escáner",
    icon: Scan,
    description: "Escanear códigos de barras",
    permission: "scanner" as keyof UserPermissions,
  },
  {
    id: "calculator",
    name: "Calculadora",
    icon: Calculator,
    description: "Calcular precios con descuentos",
    permission: "calculator" as keyof UserPermissions,
  },
  {
    id: "converter",
    name: "Conversor",
    icon: Type,
    description: "Convertir y transformar texto",
    permission: "converter" as keyof UserPermissions,
  },
  {
    id: "xml",
    name: "XML",
    icon: FileCode,
    description: "Cargar archivos XML",
    permission: "xml" as keyof UserPermissions,
  },
  {
    id: "cashcounter",
    name: "Contador Efectivo",
    icon: Banknote,
    description: "Contar billetes y monedas (CRC/USD)",
    permission: "cashcounter" as keyof UserPermissions,
  },
  {
    id: "fondogeneral",
    name: "Fondo General",
    icon: Banknote,
    description: "Administrar el fondo general",
    permission: "fondogeneral" as keyof UserPermissions,
  },
  {
    id: "timingcontrol",
    name: "Control Tiempos",
    icon: Smartphone,
    description: "Registro de venta de tiempos",
    permission: "timingcontrol" as keyof UserPermissions,
  },
  {
    id: "controlhorario",
    name: "Control Horario",
    icon: Clock,
    description: "Registro de horarios de trabajo",
    permission: "controlhorario" as keyof UserPermissions,
  },
  {
    id: "empleados",
    name: "Empleados",
    icon: Users,
    description: "Información de empleados",
    permission: "empleados" as keyof UserPermissions,
  },
  {
    id: "funciones",
    name: "Funciones",
    icon: Clock,
    description: "Ver funciones por empresa",
    permission: "notificaciones" as keyof UserPermissions,
  },
  {
    id: "recetas",
    name: "Recetas",
    icon: (props: { className?: string }) => (
      <CustomIcon name="FoodAndSoda" {...props} />
    ),
    description: "Crear y editar recetas",
    permission: "recetas" as keyof UserPermissions,
  },
  {
    id: "calculohorasprecios",
    name: "Cálculo Horas Precios",
    icon: Calculator,
    description: "Cálculo de horas y precios (planilla)",
    permission: "calculohorasprecios" as keyof UserPermissions,
  },
  {
    id: "supplierorders",
    name: "Órdenes Proveedor",
    icon: Truck,
    description: "Gestión de órdenes de proveedores",
    permission: "supplierorders" as keyof UserPermissions,
  },
  {
    id: "scanhistory",
    name: "Historial de Escaneos",
    icon: History,
    description: "Ver historial completo de escaneos",
    permission: "scanhistory" as keyof UserPermissions,
  },
  {
    id: "solicitud",
    name: "Solicitud",
    icon: Type,
    description: "Solicitudes y trámites",
    permission: "solicitud" as keyof UserPermissions,
  },
  {
    id: "edit",
    name: "Mantenimiento",
    icon: Settings,
    description: "Gestión y mantenimiento del sistema",
    permission: "mantenimiento" as keyof UserPermissions,
  },
];

const MENU_THEMES: Record<
  string,
  {
    gradient: string;
    accent: string;
    chip: string;
    glow: string;
    border: string;
  }
> = {
  default: {
    gradient: "from-sky-400 via-cyan-400 to-blue-500",
    accent: "text-sky-200",
    chip: "bg-sky-500/15 text-sky-100",
    glow: "shadow-sky-500/20",
    border: "border-sky-400/20",
  },
  scanner: {
    gradient: "from-cyan-400 via-sky-500 to-blue-600",
    accent: "text-cyan-100",
    chip: "bg-cyan-500/15 text-cyan-100",
    glow: "shadow-cyan-500/20",
    border: "border-cyan-400/20",
  },
  calculator: {
    gradient: "from-violet-400 via-indigo-500 to-blue-600",
    accent: "text-violet-100",
    chip: "bg-violet-500/15 text-violet-100",
    glow: "shadow-violet-500/20",
    border: "border-violet-400/20",
  },
  converter: {
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    accent: "text-amber-100",
    chip: "bg-amber-500/15 text-amber-100",
    glow: "shadow-amber-500/20",
    border: "border-amber-400/20",
  },
  xml: {
    gradient: "from-pink-400 via-fuchsia-500 to-purple-600",
    accent: "text-pink-100",
    chip: "bg-pink-500/15 text-pink-100",
    glow: "shadow-pink-500/20",
    border: "border-pink-400/20",
  },
  cashcounter: {
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    accent: "text-emerald-100",
    chip: "bg-emerald-500/15 text-emerald-100",
    glow: "shadow-emerald-500/20",
    border: "border-emerald-400/20",
  },
  fondogeneral: {
    gradient: "from-sky-400 via-cyan-500 to-blue-600",
    accent: "text-sky-100",
    chip: "bg-sky-500/15 text-sky-100",
    glow: "shadow-sky-500/20",
    border: "border-sky-400/20",
  },
  timingcontrol: {
    gradient: "from-cyan-400 via-sky-500 to-indigo-600",
    accent: "text-cyan-100",
    chip: "bg-cyan-500/15 text-cyan-100",
    glow: "shadow-cyan-500/20",
    border: "border-cyan-400/20",
  },
  controlhorario: {
    gradient: "from-indigo-400 via-blue-500 to-sky-600",
    accent: "text-indigo-100",
    chip: "bg-indigo-500/15 text-indigo-100",
    glow: "shadow-indigo-500/20",
    border: "border-indigo-400/20",
  },
  empleados: {
    gradient: "from-purple-400 via-violet-500 to-fuchsia-600",
    accent: "text-purple-100",
    chip: "bg-purple-500/15 text-purple-100",
    glow: "shadow-purple-500/20",
    border: "border-purple-400/20",
  },
  funciones: {
    gradient: "from-rose-400 via-pink-500 to-fuchsia-600",
    accent: "text-rose-100",
    chip: "bg-rose-500/15 text-rose-100",
    glow: "shadow-rose-500/20",
    border: "border-rose-400/20",
  },
  recetas: {
    gradient: "from-fuchsia-400 via-purple-500 to-indigo-600",
    accent: "text-fuchsia-100",
    chip: "bg-fuchsia-500/15 text-fuchsia-100",
    glow: "shadow-fuchsia-500/20",
    border: "border-fuchsia-400/20",
  },
  calculohorasprecios: {
    gradient: "from-blue-400 via-sky-500 to-cyan-600",
    accent: "text-blue-100",
    chip: "bg-blue-500/15 text-blue-100",
    glow: "shadow-blue-500/20",
    border: "border-blue-400/20",
  },
  supplierorders: {
    gradient: "from-amber-400 via-yellow-500 to-orange-600",
    accent: "text-amber-100",
    chip: "bg-amber-500/15 text-amber-100",
    glow: "shadow-amber-500/20",
    border: "border-amber-400/20",
  },
  scanhistory: {
    gradient: "from-teal-400 via-cyan-500 to-sky-600",
    accent: "text-teal-100",
    chip: "bg-teal-500/15 text-teal-100",
    glow: "shadow-teal-500/20",
    border: "border-teal-400/20",
  },
  solicitud: {
    gradient: "from-violet-400 via-fuchsia-500 to-pink-600",
    accent: "text-violet-100",
    chip: "bg-violet-500/15 text-violet-100",
    glow: "shadow-violet-500/20",
    border: "border-violet-400/20",
  },
  edit: {
    gradient: "from-emerald-400 via-green-500 to-teal-600",
    accent: "text-emerald-100",
    chip: "bg-emerald-500/15 text-emerald-100",
    glow: "shadow-emerald-500/20",
    border: "border-emerald-400/20",
  },
};

const FEATURED_MENU_IDS = new Set(["scanner", "fondogeneral", "recetas", "edit"]);

function getMenuTheme(id: string) {
  return MENU_THEMES[id] || MENU_THEMES.default;
}

function getMenuSpanClass(id: string) {
  if (id === "scanner" || id === "fondogeneral") {
    return "sm:col-span-6 xl:col-span-6";
  }
  if (id === "recetas" || id === "edit") {
    return "sm:col-span-6 xl:col-span-4";
  }
  return "sm:col-span-3 xl:col-span-3";
}

interface HomeMenuProps {
  currentUser?: User | null;
}

function arraysEqual(a: string[], b: string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function SortableHomeMenuCard({
  id,
  onClick,
  lastDragEndAt,
  className,
  style,
  children,
}: {
  id: string;
  onClick: () => void;
  lastDragEndAt: number;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const mergedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : undefined,
    touchAction: "none",
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => {
        if (isDragging) return;
        if (lastDragEndAt && Date.now() - lastDragEndAt < 250) return;
        onClick();
      }}
      className={className}
      style={mergedStyle}
      {...attributes}
      {...listeners}
    >
      {children}
    </button>
  );
}

export default function HomeMenu({ currentUser }: HomeMenuProps) {
  const [hovered, setHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showStickman, setShowStickman] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [showSupplierWeekInMenu, setShowSupplierWeekInMenu] = useState(false);
  const [enableHomeMenuSortMobile, setEnableHomeMenuSortMobile] =
    useState(false);
  const [showFavoritesView, setShowFavoritesView] = useState(false);
  const [favoritesPreferenceHydrated, setFavoritesPreferenceHydrated] =
    useState(false);
  const [favoriteMenuIds, setFavoriteMenuIds] = useState<string[]>([]);
  const [showAddFavoriteModal, setShowAddFavoriteModal] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [currentHash, setCurrentHash] = useState("");
  const [supplierWeekAnchorKey, setSupplierWeekAnchorKey] = useState<number>(
    () => dateToKey(new Date()),
  );
  const [selectedCreateDateKey, setSelectedCreateDateKey] = useState<
    number | null
  >(null);
  const [selectedProviderCode, setSelectedProviderCode] = useState<string>("");
  const [selectedReceiveDateKey, setSelectedReceiveDateKey] = useState<
    number | null
  >(null);
  const [orderAmount, setOrderAmount] = useState<string>("");
  const [orderSaving, setOrderSaving] = useState(false);
  const [fondoGeneralBalanceCRC, setFondoGeneralBalanceCRC] = useState<
    number | null
  >(null);

  const fireworksRef = useRef<HTMLDivElement>(null);

  // Resolve user permissions once for reuse
  const resolvedPermissions: UserPermissions | null = (() => {
    if (!currentUser) return null;
    return currentUser.permissions
      ? currentUser.permissions
      : getDefaultPermissions(currentUser.role || "user");
  })();

  // Filter menu items based on user permissions
  const getVisibleMenuItems = () => {
    if (!currentUser) {
      // If no user is logged in, show no items for security
      return [];
    }

    // Get user permissions or default permissions based on role
    let userPermissions: UserPermissions;
    if (currentUser.permissions) {
      userPermissions = currentUser.permissions;
    } else {
      // If no permissions are defined, use default permissions based on role
      userPermissions = getDefaultPermissions(currentUser.role || "user");
    }

    // Filter items based on user permissions
    return menuItems.filter((item) => {
      const hasPermission = userPermissions[item.permission];
      return hasPermission === true;
    });
  };

  const visibleMenuItems = getVisibleMenuItems();

  const homeMenuOrderStorageKey = useMemo(() => {
    if (!currentUser) return null;
    const userKey = (currentUser.id || currentUser.email || "anonymous").trim();
    return `pricemaster:home-menu-order:${userKey}`;
  }, [currentUser]);

  const homeMenuFavoritesStorageKey = useMemo(() => {
    if (!currentUser) return null;
    const userKey = (currentUser.id || currentUser.email || "anonymous").trim();
    return userKey;
  }, [currentUser]);

  const [savedMenuOrder, setSavedMenuOrder] = useState<string[]>([]);

  // Preference: allow HomeMenu reordering on mobile
  useEffect(() => {
    if (typeof window === "undefined") return;

    const readPreference = () => {
      const savedPreference = localStorage.getItem(
        "enable-home-menu-sort-mobile",
      );
      setEnableHomeMenuSortMobile(savedPreference === "true");
    };

    readPreference();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "enable-home-menu-sort-mobile") readPreference();
    };

    const handlePrefChange = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key === "enable-home-menu-sort-mobile") readPreference();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("pricemaster:preference-change", handlePrefChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "pricemaster:preference-change",
        handlePrefChange,
      );
    };
  }, []);

  // Guardar preferencia de vista favoritos del HomeMenu
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!favoritesPreferenceHydrated) return;

      localStorage.setItem(
        "pricemaster:home-menu-show-favorites",
        showFavoritesView.toString(),
      );

      window.dispatchEvent(
        new CustomEvent("pricemaster:preference-change", {
          detail: { key: "pricemaster:home-menu-show-favorites" },
        }),
      );
    }
  }, [showFavoritesView, favoritesPreferenceHydrated]);

  // Cargar preferencia para vista de favoritos en HomeMenu
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPreference = localStorage.getItem(
        "pricemaster:home-menu-show-favorites",
      );
      setShowFavoritesView(savedPreference === "true");
      setFavoritesPreferenceHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readFavoritesViewPreference = () => {
      const savedPreference = localStorage.getItem(
        "pricemaster:home-menu-show-favorites",
      );
      setShowFavoritesView(savedPreference === "true");
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "pricemaster:home-menu-show-favorites") {
        readFavoritesViewPreference();
      }
    };

    const handlePrefChange = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key === "pricemaster:home-menu-show-favorites") {
        readFavoritesViewPreference();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("pricemaster:preference-change", handlePrefChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "pricemaster:preference-change",
        handlePrefChange,
      );
    };
  }, []);

  const accessibleFavoriteOptions = useMemo(
    () => getAccessibleHomeMenuFavoriteOptions(currentUser),
    [currentUser],
  );

  const accessibleFavoriteOptionsById = useMemo(() => {
    return new Map(
      accessibleFavoriteOptions.map((item) => [item.id, item] as const),
    );
  }, [accessibleFavoriteOptions]);

  const favoriteMenuItems = useMemo(() => {
    return favoriteMenuIds
      .map((id) => accessibleFavoriteOptionsById.get(id))
      .filter(Boolean) as HomeMenuFavoriteOption[];
  }, [favoriteMenuIds, accessibleFavoriteOptionsById]);

  const favoriteGroupOrder: HomeMenuFavoriteGroup[] = [
    "Herramientas",
    "Recetas",
    "Fondo General",
    "Mantenimiento",
  ];

  const favoriteOptionsByGroup = useMemo(() => {
    return favoriteGroupOrder.reduce(
      (acc, group) => {
        acc[group] = accessibleFavoriteOptions.filter(
          (item) => item.group === group,
        );
        return acc;
      },
      {} as Record<HomeMenuFavoriteGroup, HomeMenuFavoriteOption[]>,
    );
  }, [accessibleFavoriteOptions]);

  useEffect(() => {
    if (!homeMenuFavoritesStorageKey) {
      setFavoriteMenuIds([]);
      return;
    }

    let cancelled = false;
    setFavoritesLoading(true);

    const loadFavorites = async () => {
      try {
        const ids = await getHomeMenuFavorites(homeMenuFavoritesStorageKey);
        if (!cancelled) {
          setFavoriteMenuIds(ids);
        }
      } catch (error) {
        console.error("Error loading HomeMenu favorites:", error);
        if (!cancelled) {
          setFavoriteMenuIds([]);
        }
      } finally {
        if (!cancelled) {
          setFavoritesLoading(false);
        }
      }
    };

    void loadFavorites();

    return () => {
      cancelled = true;
    };
  }, [homeMenuFavoritesStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!homeMenuOrderStorageKey) {
      setSavedMenuOrder([]);
      return;
    }

    try {
      const raw = localStorage.getItem(homeMenuOrderStorageKey);
      if (!raw) {
        setSavedMenuOrder([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedMenuOrder(parsed.filter((v) => typeof v === "string"));
        return;
      }
      setSavedMenuOrder([]);
    } catch {
      setSavedMenuOrder([]);
    }
  }, [homeMenuOrderStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!homeMenuFavoritesStorageKey) {
      setFavoriteMenuIds([]);
      return;
    }

    try {
      const raw = localStorage.getItem(homeMenuFavoritesStorageKey);
      if (!raw) {
        setFavoriteMenuIds([]);
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteMenuIds(parsed.filter((v) => typeof v === "string"));
      } else {
        setFavoriteMenuIds([]);
      }
    } catch {
      setFavoriteMenuIds([]);
    }
  }, [homeMenuFavoritesStorageKey]);

  const orderedVisibleMenuItemIds = useMemo(() => {
    const currentIds = visibleMenuItems.map((item) => item.id);
    if (currentIds.length === 0) return [];

    const saved = savedMenuOrder.filter((id) => currentIds.includes(id));
    const missing = currentIds.filter((id) => !saved.includes(id));
    return [...saved, ...missing];
  }, [visibleMenuItems, savedMenuOrder]);

  // If new menu items appear, append them and persist for next reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!homeMenuOrderStorageKey) return;
    if (orderedVisibleMenuItemIds.length === 0) return;

    // Only auto-sync when there's already a saved order (avoid writing defaults).
    if (savedMenuOrder.length === 0) return;
    if (arraysEqual(orderedVisibleMenuItemIds, savedMenuOrder)) return;

    setSavedMenuOrder(orderedVisibleMenuItemIds);
    try {
      localStorage.setItem(
        homeMenuOrderStorageKey,
        JSON.stringify(orderedVisibleMenuItemIds),
      );
    } catch {
      // ignore
    }
  }, [homeMenuOrderStorageKey, orderedVisibleMenuItemIds, savedMenuOrder]);

  const orderedVisibleMenuItems = useMemo(() => {
    const byId = new Map(
      visibleMenuItems.map((item) => [item.id, item] as const),
    );
    return orderedVisibleMenuItemIds
      .map((id) => byId.get(id))
      .filter(Boolean) as typeof visibleMenuItems;
  }, [visibleMenuItems, orderedVisibleMenuItemIds]);

  const favoriteVisibleMenuItems = useMemo(() => {
    if (favoriteMenuIds.length === 0) return [];
    const byId = new Map(
      visibleMenuItems.map((item) => [item.id, item] as const),
    );
    return favoriteMenuIds
      .map((id) => byId.get(id))
      .filter(Boolean) as typeof visibleMenuItems;
  }, [favoriteMenuIds, visibleMenuItems]);

  const displayedMenuItems = showFavoritesView
    ? favoriteVisibleMenuItems
    : orderedVisibleMenuItems;
  const reorderEnabled = enableHomeMenuSortMobile;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 50,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
  );

  const [lastDragEndAt, setLastDragEndAt] = useState(0);

  const hasSupplierWeekPermission = Boolean(
    resolvedPermissions?.supplierorders || resolvedPermissions?.fondogeneral,
  );
  const isSupplierWeekRoute = currentHash === "#SupplierWeek";
  const shouldShowSupplierWeekCard =
    hasSupplierWeekPermission && (!showFavoritesView || isSupplierWeekRoute);
  const showOnlySupplierWeek = isSupplierWeekRoute && hasSupplierWeekPermission;
  const showExpandedSupplierWeek =
    hasSupplierWeekPermission &&
    (isSupplierWeekRoute || showSupplierWeekInMenu);

  const canChangeSupplierWeekCompany =
    currentUser?.role === "admin" || currentUser?.role === "superadmin";

  const assignedCompanyForProviders = (currentUser?.ownercompanie || "").trim();
  const [supplierWeekCompanySelection, setSupplierWeekCompanySelection] =
    useState<string>(() => assignedCompanyForProviders);
  const [supplierWeekCompany, setSupplierWeekCompany] = useState<string>(
    () => assignedCompanyForProviders,
  );
  const [supplierWeekCompanyOptions, setSupplierWeekCompanyOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [
    supplierWeekCompanyOptionsLoading,
    setSupplierWeekCompanyOptionsLoading,
  ] = useState(false);

  // When the supplier week card is shown in the Home menu, it must always reflect the current week.
  useEffect(() => {
    if (showSupplierWeekInMenu && !isSupplierWeekRoute) {
      setSupplierWeekAnchorKey(dateToKey(new Date()));
    }
  }, [showSupplierWeekInMenu, isSupplierWeekRoute]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHash = () => setCurrentHash(window.location.hash || "");
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readPreference = () => {
      const savedPreference = localStorage.getItem("show-supplier-week-menu");
      // Por defecto está desactivado (false)
      setShowSupplierWeekInMenu(savedPreference === "true");
    };

    readPreference();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "show-supplier-week-menu") readPreference();
    };

    const handlePrefChange = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key === "show-supplier-week-menu") readPreference();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("pricemaster:preference-change", handlePrefChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "pricemaster:preference-change",
        handlePrefChange,
      );
    };
  }, []);

  useEffect(() => {
    // Mantener la empresa sincronizada con la asignada al usuario.
    // - rol user: forzar siempre a su empresa
    // - otros roles: si no hay selección aún, usar la asignada como default
    if (!currentUser) return;
    if (currentUser.role === "user") {
      setSupplierWeekCompanySelection(assignedCompanyForProviders);
      setSupplierWeekCompany(assignedCompanyForProviders);
      return;
    }
    setSupplierWeekCompanySelection((prev) =>
      prev ? prev : assignedCompanyForProviders,
    );
    setSupplierWeekCompany((prev) =>
      prev ? prev : assignedCompanyForProviders,
    );
  }, [currentUser, assignedCompanyForProviders]);

  useEffect(() => {
    // Cargar opciones de empresas para selector (solo admin/superadmin)
    // Nota: solo se necesita en la ruta (no en el card del menú).
    if (!isSupplierWeekRoute) return;
    if (!showExpandedSupplierWeek) return;
    if (!canChangeSupplierWeekCompany) return;
    if (!currentUser) return;

    let cancelled = false;
    const load = async () => {
      setSupplierWeekCompanyOptionsLoading(true);
      try {
        const allEmpresas = await EmpresasService.getAllEmpresas();

        let owned: typeof allEmpresas = [];
        if (currentUser.role === "superadmin") {
          owned = allEmpresas || [];
        } else {
          const resolvedOwnerId =
            currentUser.ownerId ||
            (currentUser.eliminate === false ? currentUser.id : "") ||
            "";

          owned = (allEmpresas || []).filter((e: any) => {
            if (!e) return false;
            const ownerId = e.ownerId || "";

            const ownerIdMatch =
              ownerId && String(ownerId) === String(resolvedOwnerId);

            const name = e.name || "";
            const ubicacion = e.ubicacion || "";
            const ownerCompanieMatch =
              currentUser.ownercompanie &&
              (String(name) === String(currentUser.ownercompanie) ||
                String(ubicacion) === String(currentUser.ownercompanie));

            return !!ownerIdMatch || !!ownerCompanieMatch;
          });
        }

        const mapped = (owned || [])
          .map((e: any) => {
            const label = e.name || e.ubicacion || e.id || "Empresa";
            const value = e.ubicacion || e.name || e.id || "";
            return { label: String(label), value: String(value) };
          })
          .filter((x) => x.value.trim().length > 0)
          .sort((a, b) =>
            a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
          );

        if (cancelled) return;
        setSupplierWeekCompanyOptions(mapped);

        // Si aún no hay empresa seleccionada, resolver la asignada al value disponible
        setSupplierWeekCompanySelection((prev) => {
          if (prev && prev.trim()) return prev;
          const assignedStr = String(assignedCompanyForProviders || "").trim();
          if (!assignedStr) return "";
          const assignedLower = assignedStr.toLowerCase();
          const resolved = mapped.find((m) => {
            const mv = String(m.value || "").toLowerCase();
            const ml = String(m.label || "").toLowerCase();
            return (
              mv === assignedLower ||
              ml === assignedLower ||
              ml.includes(assignedLower) ||
              assignedLower.includes(mv)
            );
          });
          return resolved ? String(resolved.value) : assignedStr;
        });

        setSupplierWeekCompany((prev) => {
          if (prev && prev.trim()) return prev;
          const assignedStr = String(assignedCompanyForProviders || "").trim();
          if (!assignedStr) return "";
          const assignedLower = assignedStr.toLowerCase();
          const resolved = mapped.find((m) => {
            const mv = String(m.value || "").toLowerCase();
            const ml = String(m.label || "").toLowerCase();
            return (
              mv === assignedLower ||
              ml === assignedLower ||
              ml.includes(assignedLower) ||
              assignedLower.includes(mv)
            );
          });
          return resolved ? String(resolved.value) : assignedStr;
        });
      } catch (err) {
        console.error("Error loading empresas for SupplierWeek selector:", err);
        if (!cancelled) setSupplierWeekCompanyOptions([]);
      } finally {
        if (!cancelled) setSupplierWeekCompanyOptionsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    showExpandedSupplierWeek,
    canChangeSupplierWeekCompany,
    currentUser,
    assignedCompanyForProviders,
  ]);

  const companyForProviders = supplierWeekCompany;
  const {
    providers: weeklyProviders,
    loading: weeklyProvidersLoading,
    error: weeklyProvidersError,
  } = useProviders(showExpandedSupplierWeek ? companyForProviders : undefined);

  useEffect(() => {
    // Fallback: si el admin selecciona una empresa y no hay proveedores bajo el "value",
    // intentar cargar usando el label (nombre) como key alternativo.
    // Nota: solo tiene sentido en la ruta (donde hay selector de empresa).
    if (!isSupplierWeekRoute) return;
    if (!showExpandedSupplierWeek) return;
    if (!canChangeSupplierWeekCompany) return;
    if (weeklyProvidersLoading) return;
    if (weeklyProvidersError) return;

    const selectedValue = (supplierWeekCompanySelection || "").trim();
    const activeKey = (supplierWeekCompany || "").trim();
    if (!selectedValue || !activeKey) return;

    // Solo intentar fallback cuando todavía estamos usando el value seleccionado.
    if (activeKey !== selectedValue) return;

    const hasAnyProviders = (weeklyProviders || []).length > 0;
    if (hasAnyProviders) return;

    const option = supplierWeekCompanyOptions.find(
      (o) => o.value === selectedValue,
    );
    const alt = (option?.label || "").trim();
    if (!alt || alt === activeKey) return;

    setSupplierWeekCompany(alt);
  }, [
    showExpandedSupplierWeek,
    canChangeSupplierWeekCompany,
    weeklyProvidersLoading,
    weeklyProvidersError,
    weeklyProviders,
    supplierWeekCompanySelection,
    supplierWeekCompany,
    supplierWeekCompanyOptions,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!showExpandedSupplierWeek) {
      setFondoGeneralBalanceCRC(null);
      return;
    }

    const normalizedCompany = (companyForProviders || "").trim();
    if (normalizedCompany.length === 0) {
      setFondoGeneralBalanceCRC(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const companyKey =
        MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);

      let resolved = null as Awaited<
        ReturnType<typeof MovimientosFondosService.getDocument>
      >;

      // In menu mode, prefer local cache and avoid hitting Firestore.
      if (isSupplierWeekRoute) {
        try {
          resolved = await MovimientosFondosService.getDocument(companyKey);
        } catch (err) {
          console.error("Error reading Fondo General balances:", err);
        }
      }

      if (!resolved) {
        try {
          const raw = window.localStorage.getItem(companyKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            resolved = MovimientosFondosService.ensureMovementStorageShape(
              parsed,
              normalizedCompany,
            );
          }
        } catch (err) {
          console.error(
            "Error reading Fondo General balances from cache:",
            err,
          );
        }
      }

      if (cancelled) return;

      if (!resolved) {
        setFondoGeneralBalanceCRC(null);
        return;
      }

      const crcBalance =
        resolved.state.balancesByAccount.find(
          (b) => b.accountId === "FondoGeneral" && b.currency === "CRC",
        )?.currentBalance ?? 0;

      setFondoGeneralBalanceCRC(crcBalance);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [showExpandedSupplierWeek, companyForProviders]);

  type VisitDay = "D" | "L" | "M" | "MI" | "J" | "V" | "S";
  const WEEK_DAY_CODES: VisitDay[] = ["D", "L", "M", "MI", "J", "V", "S"];
  const WEEK_DAY_LABELS: Record<VisitDay, string> = {
    D: "Domingo",
    L: "Lunes",
    M: "Martes",
    MI: "Miércoles",
    J: "Jueves",
    V: "Viernes",
    S: "Sábado",
  };

  const weekModel = (() => {
    const todayKey = dateToKey(new Date());

    const weekStartKey = weekStartKeyFromDateKey(supplierWeekAnchorKey);
    const start = new Date(weekStartKey);

    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    const intervalWeeksForFrequency = (frequencyRaw: unknown): number => {
      const freq =
        typeof frequencyRaw === "string"
          ? frequencyRaw.trim().toUpperCase()
          : "SEMANAL";
      if (freq === "QUINCENAL") return 2;
      if (freq === "22 DIAS") return 3; // cada ~3 semanas
      if (freq === "MENSUAL") return 4;
      return 1;
    };

    const providerAppliesToWeek = (
      visit: any,
      targetWeekStartKey: number,
    ): boolean => {
      if (!visit) return false;
      const interval = intervalWeeksForFrequency(visit.frequency);
      if (interval <= 1) return true;
      const startDateKey = visit.startDateKey;
      if (typeof startDateKey !== "number" || !Number.isFinite(startDateKey)) {
        // Backward compatible: if no anchor configured, show every week.
        return true;
      }
      const anchorWeekStart = weekStartKeyFromDateKey(startDateKey);
      const diffWeeks = Math.round(
        (targetWeekStartKey - anchorWeekStart) / MS_PER_WEEK,
      );
      const mod = ((diffWeeks % interval) + interval) % interval;
      return mod === 0;
    };

    const days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const code = WEEK_DAY_CODES[idx];
      const dateKey = dateToKey(date);
      return {
        idx,
        code,
        label: WEEK_DAY_LABELS[code],
        date,
        dateKey,
        isToday: dateKey === todayKey,
      };
    });

    type ProviderRef = { code: string; name: string };
    const visitProviders = (weeklyProviders || []).filter((p) => {
      const type = (p.type || "").toUpperCase();
      return (
        type === "COMPRA INVENTARIO" &&
        !!p.visit &&
        providerAppliesToWeek((p as any).visit, weekStartKey)
      );
    });

    const createByCode = new Map<VisitDay, ProviderRef[]>();
    const receiveByCode = new Map<VisitDay, ProviderRef[]>();
    WEEK_DAY_CODES.forEach((c) => {
      createByCode.set(c, []);
      receiveByCode.set(c, []);
    });

    // Helper: compute the next date (same day allowed) whose VisitDay is in allowed codes.
    // We intentionally do NOT skip weekends here, because some providers may have D/S as valid receive days.
    const nextMatchingVisitDay = (
      baseDate: Date,
      allowed: VisitDay[],
      includeSameDay: boolean,
    ): Date | null => {
      if (!Array.isArray(allowed) || allowed.length === 0) return null;
      let candidate = new Date(baseDate);
      candidate.setHours(0, 0, 0, 0);

      if (includeSameDay) {
        const c = visitDayFromDate(candidate) as VisitDay;
        if (allowed.includes(c)) return candidate;
      }

      // Guard: deliveries are expected within the next two weeks at most.
      for (let i = 0; i < 14; i++) {
        candidate = addDays(candidate, 1);
        const c = visitDayFromDate(candidate) as VisitDay;
        if (allowed.includes(c)) return candidate;
      }

      return null;
    };

    const isDateWithinWeek = (date: Date, weekStart: Date): boolean => {
      const startKey = dateToKey(weekStart);
      const endKey = dateToKey(addDays(weekStart, 6));
      const key = dateToKey(date);
      return key >= startKey && key <= endKey;
    };

    // Avoid duplicates when a provider has multiple day combinations.
    const createSeen = new Map<VisitDay, Set<string>>();
    const receiveSeen = new Map<VisitDay, Set<string>>();
    WEEK_DAY_CODES.forEach((c) => {
      createSeen.set(c, new Set());
      receiveSeen.set(c, new Set());
    });

    // CREATE: providers that place orders in THIS week.
    visitProviders.forEach((p) => {
      const name = p.name;
      const code = p.code;
      const visit = p.visit;
      if (!visit) return;

      (visit.createOrderDays || []).forEach((d) => {
        const key = d as VisitDay;
        const set = createSeen.get(key);
        if (!createByCode.has(key) || !set) return;
        if (set.has(code)) return;
        set.add(code);
        createByCode.get(key)!.push({ code, name });
      });
    });

    // RECEIVE: providers that will deliver in THIS week.
    // Deliveries can come from orders created this week OR from the previous week
    // (e.g. create Friday -> receive Tuesday of next week).
    (weeklyProviders || []).forEach((p) => {
      const type = (p.type || "").toUpperCase();
      if (type !== "COMPRA INVENTARIO") return;
      const visit = (p as any).visit;
      if (!visit) return;

      const createDays: VisitDay[] = Array.isArray(visit.createOrderDays)
        ? visit.createOrderDays
        : [];
      const receiveDays: VisitDay[] = Array.isArray(visit.receiveOrderDays)
        ? visit.receiveOrderDays
        : [];
      if (createDays.length === 0 || receiveDays.length === 0) return;

      const providerCode = String(p.code || "");
      const providerName = String(p.name || "");
      if (!providerCode || !providerName) return;

      // Check cycles that could land a delivery inside this week.
      // offsetWeeks=0: create happens this week (delivery could still be this week)
      // offsetWeeks=-1: create happened last week (delivery could land this week)
      const offsets = [0, -1];
      for (const offsetWeeks of offsets) {
        const createWeekStartDate = addDays(
          new Date(weekStartKey),
          offsetWeeks * 7,
        );
        createWeekStartDate.setHours(0, 0, 0, 0);
        const createWeekStartKey = dateToKey(createWeekStartDate);

        if (!providerAppliesToWeek(visit, createWeekStartKey)) continue;

        for (const createDayCode of createDays) {
          const idx = WEEK_DAY_CODES.indexOf(createDayCode);
          if (idx < 0) continue;

          const createDate = addDays(createWeekStartDate, idx);
          const includeSameDay = receiveDays.includes(
            visitDayFromDate(createDate) as VisitDay,
          );
          const deliveryDate = nextMatchingVisitDay(
            createDate,
            receiveDays,
            includeSameDay,
          );
          if (!deliveryDate) continue;

          if (!isDateWithinWeek(deliveryDate, start)) continue;

          const receiveCode = visitDayFromDate(deliveryDate) as VisitDay;
          const set = receiveSeen.get(receiveCode);
          if (!receiveByCode.has(receiveCode) || !set) continue;
          if (set.has(providerCode)) continue;
          set.add(providerCode);
          receiveByCode
            .get(receiveCode)!
            .push({ code: providerCode, name: providerName });
        }
      }
    });

    const sortProviders = (list: ProviderRef[]) =>
      list
        .map((p) => ({ code: p.code.trim(), name: p.name.trim() }))
        .filter((p) => p.code && p.name)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
        );

    WEEK_DAY_CODES.forEach((c) => {
      createByCode.set(c, sortProviders(createByCode.get(c) || []));
      receiveByCode.set(c, sortProviders(receiveByCode.get(c) || []));
    });

    return {
      weekStartKey,
      days,
      createByCode,
      receiveByCode,
      visitProviders,
    };
  })();

  const supplierWeekRangeLabel = (() => {
    if (!weekModel.days || weekModel.days.length === 0) return "";
    const start = weekModel.days[0].date;
    const end = weekModel.days[weekModel.days.length - 1].date;
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const fmt = (d: Date) =>
      `${days[d.getDay()]}: ${d.getDate()}/${d.getMonth() + 1}`;
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  // ControlPedido: avoid a live Firestore subscription unless we're on the SupplierWeek route.
  const controlPedidoEnabled = showExpandedSupplierWeek && isSupplierWeekRoute;

  const controlPedidoCacheKey = useMemo(() => {
    if (typeof window === "undefined") return null;
    const c = (companyForProviders || "").trim();
    if (!c) return null;
    const wk = weekModel.weekStartKey;
    if (!Number.isFinite(wk)) return null;
    return `pricemaster:controlpedido:${c}__${wk}`;
  }, [companyForProviders, weekModel.weekStartKey]);

  const [cachedControlEntries, setCachedControlEntries] = useState<
    ControlPedidoEntry[]
  >([]);

  const {
    entries: controlEntries,
    loading: controlLoading,
    error: controlError,
    addOrder,
    deleteOrdersForProviderReceiveDay,
  } = useControlPedido(
    controlPedidoEnabled ? companyForProviders : undefined,
    controlPedidoEnabled ? weekModel.weekStartKey : undefined,
    controlPedidoEnabled,
  );

  // Persist latest control entries to localStorage (for menu mode display) and keep in-memory cache.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!controlPedidoCacheKey) return;
    if (!controlPedidoEnabled) return;

    setCachedControlEntries(controlEntries || []);

    try {
      const safe = (controlEntries || []).map((e) => ({
        id: String(e.id || ""),
        providerCode: String(e.providerCode || "").trim(),
        providerName: String(e.providerName || "").trim(),
        createDateKey: Number(e.createDateKey),
        receiveDateKey: Number(e.receiveDateKey),
        amount: Number(e.amount),
      }));
      window.localStorage.setItem(controlPedidoCacheKey, JSON.stringify(safe));
    } catch {
      // ignore
    }
  }, [controlPedidoCacheKey, controlPedidoEnabled, controlEntries]);

  // In menu mode (not route), read cached entries from localStorage to avoid Firestore reads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (controlPedidoEnabled) return;
    if (!showExpandedSupplierWeek) {
      setCachedControlEntries([]);
      return;
    }
    if (!controlPedidoCacheKey) {
      setCachedControlEntries([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(controlPedidoCacheKey);
      if (!raw) {
        setCachedControlEntries([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setCachedControlEntries([]);
        return;
      }
      const normalized: ControlPedidoEntry[] = parsed
        .map((e: any) => {
          const providerCode = String(e?.providerCode || "").trim();
          const providerName = String(e?.providerName || "").trim();
          const createDateKey = Number(e?.createDateKey);
          const receiveDateKey = Number(e?.receiveDateKey);
          const amount = Number(e?.amount);
          if (!providerCode || !providerName) return null;
          if (
            !Number.isFinite(createDateKey) ||
            !Number.isFinite(receiveDateKey) ||
            !Number.isFinite(amount)
          )
            return null;
          return {
            id: String(e?.id || `${providerCode}__${receiveDateKey}`),
            providerCode,
            providerName,
            createDateKey,
            receiveDateKey,
            amount,
            createdAt: undefined,
          } as ControlPedidoEntry;
        })
        .filter(Boolean) as ControlPedidoEntry[];

      setCachedControlEntries(normalized);
    } catch {
      setCachedControlEntries([]);
    }
  }, [controlPedidoCacheKey, controlPedidoEnabled, showExpandedSupplierWeek]);

  // weekModel is computed above (needs weeklyProviders)

  useEffect(() => {
    // Reset selection when leaving SupplierWeek route
    if (!isSupplierWeekRoute) {
      setSelectedCreateDateKey(null);
      setSelectedProviderCode("");
      setSelectedReceiveDateKey(null);
      setOrderAmount("");
    }
  }, [isSupplierWeekRoute]);

  useEffect(() => {
    // Reset selection when changing week
    setSelectedCreateDateKey(null);
    setSelectedProviderCode("");
    setSelectedReceiveDateKey(null);
    setOrderAmount("");
  }, [weekModel.weekStartKey]);

  useEffect(() => {
    // Reset selection when changing company
    if (!showExpandedSupplierWeek) return;
    setSelectedCreateDateKey(null);
    setSelectedProviderCode("");
    setSelectedReceiveDateKey(null);
    setOrderAmount("");
  }, [showExpandedSupplierWeek, companyForProviders]);

  const selectedDay = selectedCreateDateKey
    ? weekModel.days.find((d) => d.dateKey === selectedCreateDateKey) || null
    : null;

  const eligibleProviders = (() => {
    if (!selectedDay) return [];
    const dayCode = selectedDay.code as VisitDay;
    return (weekModel.visitProviders || [])
      .filter((p) => (p.visit?.createOrderDays || []).includes(dayCode))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
      );
  })();

  const selectedProvider = selectedProviderCode
    ? eligibleProviders.find((p) => p.code === selectedProviderCode) || null
    : null;

  const isImmediateDeliveryProvider = Boolean(
    selectedProvider &&
    selectedDay &&
    (selectedProvider.visit?.receiveOrderDays || []).includes(
      selectedDay.code as VisitDay,
    ),
  );

  const computeDefaultReceiveDateKey = (
    providerCode: string,
    createDate: Date,
  ): number => {
    const provider = (weekModel.visitProviders || []).find(
      (p) => p.code === providerCode,
    );
    const receiveDays = provider?.visit?.receiveOrderDays || [];

    if (!provider || receiveDays.length === 0) return dateToKey(createDate);

    const createCode = visitDayFromDate(createDate) as VisitDay;
    if (receiveDays.includes(createCode)) return dateToKey(createDate);

    let candidate = nextBusinessDay(createDate);
    if (receiveDays.length > 0) {
      let guard = 0;
      while (guard < 14) {
        const code = visitDayFromDate(candidate) as VisitDay;
        if (receiveDays.includes(code)) break;
        candidate = nextBusinessDay(candidate);
        guard++;
      }
    }

    return dateToKey(candidate);
  };

  useEffect(() => {
    if (!selectedDay || !selectedProviderCode) {
      setSelectedReceiveDateKey(null);
      return;
    }

    if (isImmediateDeliveryProvider) {
      setSelectedReceiveDateKey(selectedDay.dateKey);
      return;
    }

    setSelectedReceiveDateKey(
      computeDefaultReceiveDateKey(selectedProviderCode, selectedDay.date),
    );
  }, [selectedDay?.dateKey, selectedProviderCode, isImmediateDeliveryProvider]);

  const formatAmount = (amount: number) => {
    if (!Number.isFinite(amount)) return String(amount);
    return amount.toLocaleString("es-CR", {
      maximumFractionDigits: 2,
    });
  };

  const activeMenuId = useMemo(() => {
    const hash = currentHash.replace(/^#/, "");
    if (hash === "agregarproducto") return "recetas";
    if (hash === "scanhistory") return "scanhistory";
    return hash;
  }, [currentHash]);

  const filteredDisplayedMenuItems = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();
    if (!query) return displayedMenuItems;
    return displayedMenuItems.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const description = String(item.description || "").toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  }, [displayedMenuItems, menuSearch]);

  const dashboardStats = useMemo(() => {
    return [
      {
        label: "Herramientas",
        value: String(visibleMenuItems.length),
        note: showFavoritesView ? "Vista filtrada" : "Disponibles para tu rol",
        icon: BarChart3,
        tone: "cyan",
      },
      {
        label: "Favoritos",
        value: String(favoriteMenuItems.length),
        note: favoritesLoading ? "Sincronizando" : "Accesos guardados",
        icon: Star,
        tone: "amber",
      },
      {
        label: "Proveedores",
        value: String((weekModel.visitProviders || []).length),
        note: supplierWeekRangeLabel || "Semana activa",
        icon: Truck,
        tone: "violet",
      },
      {
        label: "Fondo CRC",
        value:
          fondoGeneralBalanceCRC !== null
            ? `CRC ${formatAmount(fondoGeneralBalanceCRC)}`
            : "—",
        note: companyForProviders || "Saldo general",
        icon: Banknote,
        tone: "emerald",
      },
    ];
  }, [
    companyForProviders,
    favoriteMenuItems.length,
    favoritesLoading,
    fondoGeneralBalanceCRC,
    formatAmount,
    showFavoritesView,
    supplierWeekRangeLabel,
    visibleMenuItems.length,
    weekModel.visitProviders,
  ]);

  const dashboardActivity = useMemo(() => {
    return [
      {
        title: supplierWeekRangeLabel || "Semana activa",
        detail: `${(weekModel.visitProviders || []).length} proveedores programados`,
        icon: Clock,
        tone: "cyan",
      },
      {
        title:
          currentUser?.name || currentUser?.email || "Sesión del usuario",
        detail: currentUser?.role || "Usuario conectado",
        icon: Users,
        tone: "violet",
      },
      {
        title: showFavoritesView ? "Favoritos en pantalla" : "Vista general",
        detail: showFavoritesView
          ? "Atajos priorizados"
          : "Todas las herramientas visibles",
        icon: Star,
        tone: "amber",
      },
      {
        title:
          fondoGeneralBalanceCRC !== null
            ? `CRC ${formatAmount(fondoGeneralBalanceCRC)}`
            : "Fondo sin saldo",
        detail: "Estado financiero del día",
        icon: Activity,
        tone: "emerald",
      },
    ];
  }, [
    currentUser?.email,
    currentUser?.name,
    currentUser?.role,
    fondoGeneralBalanceCRC,
    formatAmount,
    showFavoritesView,
    supplierWeekRangeLabel,
    weekModel.visitProviders,
  ]);

  const effectiveControlEntries = controlPedidoEnabled
    ? controlEntries
    : cachedControlEntries;

  const receiveAmountsByDateKey = useMemo(() => {
    const byDateKey = new Map<number, Map<string, number>>();
    for (const entry of effectiveControlEntries || []) {
      const receiveDateKey = entry.receiveDateKey;
      if (!Number.isFinite(receiveDateKey)) continue;

      const providerCode = String(entry.providerCode || "").trim();
      if (!providerCode) continue;

      const amount = Number(entry.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      let byProvider = byDateKey.get(receiveDateKey);
      if (!byProvider) {
        byProvider = new Map<string, number>();
        byDateKey.set(receiveDateKey, byProvider);
      }

      byProvider.set(
        providerCode,
        (byProvider.get(providerCode) || 0) + amount,
      );
    }
    return byDateKey;
  }, [effectiveControlEntries]);

  const receiveAmountByProviderCodeForDay = useCallback(
    (dateKey: number) =>
      receiveAmountsByDateKey.get(dateKey) || new Map<string, number>(),
    [receiveAmountsByDateKey],
  );

  const handleSaveControlPedido = async () => {
    if (!isSupplierWeekRoute) return;
    if (!companyForProviders) return;
    if (!selectedDay) return;
    const provider = eligibleProviders.find(
      (p) => p.code === selectedProviderCode,
    );
    if (!provider) return;

    const parsedAmount = Number(orderAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    if (!selectedReceiveDateKey || !Number.isFinite(selectedReceiveDateKey)) {
      return;
    }

    setOrderSaving(true);
    try {
      await addOrder({
        providerCode: provider.code,
        providerName: provider.name,
        createDateKey: selectedDay.dateKey,
        receiveDateKey: selectedReceiveDateKey,
        amount: parsedAmount,
      });
      setOrderAmount("");
      setSelectedProviderCode("");
      setSelectedReceiveDateKey(null);
    } finally {
      setOrderSaving(false);
    }
  };

  const handleDeleteControlPedido = async () => {
    if (!isSupplierWeekRoute) return;
    if (!companyForProviders) return;
    if (!selectedProviderCode) return;
    if (!selectedReceiveDateKey || !Number.isFinite(selectedReceiveDateKey))
      return;

    setOrderSaving(true);
    try {
      await deleteOrdersForProviderReceiveDay(
        selectedProviderCode,
        selectedReceiveDateKey,
      );
      setOrderAmount("");
    } finally {
      setOrderSaving(false);
    }
  };

  const handleNavigate = (id: string) => {
    if (typeof window !== "undefined") {
      // Redirigir a la ruta específica para la herramienta usando hash navigation
      // Nota: al entrar a "Recetas" se debe ir primero a "Agregar Producto".
      const target = id === "recetas" ? "agregarproducto" : id;
      window.location.hash = `#${target}`;
    }
  };

  const handleNavigateFavorite = (favorite: HomeMenuFavoriteOption) => {
    if (typeof window === "undefined") return;

    if (favorite.maintenanceTab) {
      window.localStorage.setItem(
        MAINTENANCE_TAB_STORAGE_KEY,
        favorite.maintenanceTab,
      );
      window.dispatchEvent(
        new CustomEvent(MAINTENANCE_TAB_EVENT, {
          detail: { tab: favorite.maintenanceTab },
        }),
      );
      window.location.hash = "#edit";
      return;
    }

    window.location.hash = `#${favorite.hash}`;
  };

  const handleToggleFavorite = async (favorite: HomeMenuFavoriteOption) => {
    if (!homeMenuFavoritesStorageKey) return;

    const isActive = favoriteMenuIds.includes(favorite.id);
    const nextIds = isActive
      ? favoriteMenuIds.filter((id) => id !== favorite.id)
      : [...favoriteMenuIds, favorite.id];

    setFavoriteMenuIds(nextIds);

    try {
      if (isActive) {
        await removeHomeMenuFavorite(homeMenuFavoritesStorageKey, favorite.id);
      } else {
        await addHomeMenuFavorite(homeMenuFavoritesStorageKey, favorite.id);
      }

      window.dispatchEvent(
        new CustomEvent("pricemaster:home-favorites-change", {
          detail: { userKey: homeMenuFavoritesStorageKey },
        }),
      );
    } catch (error) {
      console.error("Error updating HomeMenu favorites:", error);
      try {
        const ids = await getHomeMenuFavorites(homeMenuFavoritesStorageKey);
        setFavoriteMenuIds(ids);
      } catch {
        // ignore secondary errors
      }
    }
  };

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    setHovered((h) => !h);

    if (newCount >= 5) {
      setShowStickman(true);
    }
  };

  // Mostrar fuegos artificiales automáticamente al ingresar al HomeMenu durante 6 segundos
  {
    /*useEffect(() => {
    if (fireworksRef.current && !fireworksInstance) {
      const fw = new Fireworks(fireworksRef.current);
      fw.start();
      setFireworksInstance(fw);

      const timer = setTimeout(() => {
        fw.stop();
        setFireworksInstance(null);
      }, 86400); // 6 segundos

      return () => clearTimeout(timer);
    }
  }, []); // Se ejecuta solo al montar el componente
  */
  }

  // Ocultar el AnimatedStickman después de 10 segundos
  useEffect(() => {
    if (showStickman) {
      const timer = setTimeout(() => {
        setShowStickman(false);
      }, 10000); // 10 segundos

      return () => clearTimeout(timer);
    }
  }, [showStickman]);

  return (
    <div className="relative min-h-[calc(100vh-72px)] w-full overflow-hidden bg-[#050816] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.16),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(2,6,23,0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:56px_56px] opacity-20" />
      </div>

      <div
        ref={fireworksRef}
        className="fixed inset-0 pointer-events-none z-40"
      />

      <div className="relative mx-auto flex w-full max-w-[2400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(8,15,40,0.42)] backdrop-blur-xl sm:p-6"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.16),transparent_32%)]" />

          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Dashboard SaaS moderno
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl xl:text-5xl">
                  {currentUser
                    ? `¡Qué gusto verte, ${currentUser.name ?? currentUser.email ?? "Usuario"}!`
                    : "¡Qué gusto verte!"}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Todo lo que necesitás, en un solo lugar. Un centro de control
                  más limpio, más serio y mucho más visual.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-slate-100 shadow-inner shadow-black/20 backdrop-blur-md">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Buscar acceso, tarjeta o función..."
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowFavoritesView((prev) => !prev)}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                    showFavoritesView
                      ? "border-amber-400/30 bg-amber-400/15 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
                      : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  }`}
                  title={showFavoritesView ? "Ver menú normal" : "Ver favoritos"}
                  aria-label={
                    showFavoritesView
                      ? "Cambiar a menú normal"
                      : "Cambiar a favoritos"
                  }
                >
                  <Star
                    className={`h-4 w-4 ${showFavoritesView ? "fill-current" : ""}`}
                  />
                  {showFavoritesView ? "Favoritos activos" : "Ver favoritos"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleNavigate("scanner")}
                  className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  Escáner
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("fondogeneral")}
                  className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/20"
                >
                  Fondo General
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("controlhorario")}
                  className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-400/20"
                >
                  Control Horario
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("recetas")}
                  className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-400/20"
                >
                  Recetas
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {dashboardStats.slice(0, 3).map((stat) => {
                  const toneClass =
                    stat.tone === "cyan"
                      ? "from-cyan-400/20 to-sky-500/10"
                      : stat.tone === "amber"
                        ? "from-amber-400/20 to-orange-500/10"
                        : "from-violet-400/20 to-fuchsia-500/10";

                  return (
                    <div
                      key={`hero-${stat.label}`}
                      className={`rounded-2xl border border-white/10 bg-gradient-to-br ${toneClass} px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.2)]`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                        {stat.label}
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div className="text-lg font-semibold text-white">
                          {stat.value}
                        </div>
                        <div className="text-xs text-slate-300">{stat.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                      Time Master
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      Centro de control
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogoClick}
                    className="group flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] border border-white/10 bg-white/5 transition-all hover:scale-105 hover:bg-white/10"
                  >
                    <Image
                      src="/Logos/LogoBlanco2.png"
                      alt="Time Master logo"
                      className={`h-full w-full object-cover transition-transform duration-300 ${
                        hovered ? "scale-110 rotate-12" : "scale-100"
                      }`}
                      width={64}
                      height={64}
                      onMouseEnter={() => setHovered(true)}
                      onMouseLeave={() => setHovered(false)}
                      style={{
                        cursor: "pointer",
                        filter: hovered
                          ? "drop-shadow(0 0 10px rgba(255,255,255,0.35))"
                          : "none",
                      }}
                    />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {dashboardStats.map((stat) => {
                    const ThemeIcon = stat.icon;
                    const toneClass =
                      stat.tone === "cyan"
                        ? "from-cyan-400 to-sky-500"
                        : stat.tone === "amber"
                          ? "from-amber-400 to-orange-500"
                          : stat.tone === "violet"
                            ? "from-violet-400 to-fuchsia-500"
                            : "from-emerald-400 to-teal-500";

                    return (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                              {stat.label}
                            </div>
                            <div className="mt-1 text-xl font-semibold text-white">
                              {stat.value}
                            </div>
                          </div>
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${toneClass} text-white shadow-lg`}
                          >
                            <ThemeIcon className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          {stat.note}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                      Actividad reciente
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      Lectura del sistema
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    Hoy
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {dashboardActivity.slice(0, 3).map((item) => {
                    const ItemIcon = item.icon;
                    const toneClass =
                      item.tone === "cyan"
                        ? "from-cyan-400 to-sky-500"
                        : item.tone === "amber"
                          ? "from-amber-400 to-orange-500"
                          : item.tone === "violet"
                            ? "from-violet-400 to-fuchsia-500"
                            : "from-emerald-400 to-teal-500";

                    return (
                      <div
                        key={item.title}
                        className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-3"
                      >
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${toneClass} text-white shadow-lg`}
                        >
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-400">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

      {!showOnlySupplierWeek && filteredDisplayedMenuItems.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-12 text-center shadow-[0_20px_60px_rgba(8,15,40,0.28)] backdrop-blur-xl">
          <Settings className="mx-auto mb-4 h-16 w-16 text-cyan-200" />
          <h3 className="mb-2 text-xl font-semibold text-white">
            {menuSearch.trim()
              ? "Sin resultados"
              : "Sin herramientas disponibles"}
          </h3>
          <p className="mb-4 text-slate-300">
            {menuSearch.trim()
              ? `No hay coincidencias para “${menuSearch.trim()}”.`
              : "No tienes permisos para acceder a ninguna herramienta en este momento."}
          </p>
          <p className="text-sm text-slate-400">
            {menuSearch.trim()
              ? "Prueba con otro término o limpia la búsqueda para ver todo el catálogo."
              : "Contacta a tu administrador para obtener acceso a las funcionalidades que necesitas."}
          </p>
        </div>
      ) : (
        <div className="grid w-full max-w-[2200px] grid-cols-1 gap-4 pt-2 sm:grid-cols-6 xl:grid-cols-12">
          {shouldShowSupplierWeekCard && (
            <div className="col-span-full overflow-hidden rounded-[30px] border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(8,15,40,0.32)] backdrop-blur-xl">
              <SupplierWeekSection
                isSupplierWeekRoute={isSupplierWeekRoute}
                showSupplierWeekInMenu={showSupplierWeekInMenu}
                companyForProviders={companyForProviders}
                companySelectorValue={supplierWeekCompanySelection}
                canChangeCompanyForProviders={
                  canChangeSupplierWeekCompany &&
                  !supplierWeekCompanyOptionsLoading
                }
                companyOptionsForProviders={supplierWeekCompanyOptions}
                onCompanyForProvidersChange={(value) => {
                  if (!canChangeSupplierWeekCompany) return;
                  setSupplierWeekCompanySelection(value);
                  setSupplierWeekCompany(value);
                }}
                weeklyProvidersLoading={weeklyProvidersLoading}
                weeklyProvidersError={weeklyProvidersError}
                weekModel={weekModel}
                supplierWeekRangeLabel={supplierWeekRangeLabel}
                fondoGeneralBalanceCRC={fondoGeneralBalanceCRC}
                onNavigateSupplierWeek={() => handleNavigate("SupplierWeek")}
                onPrevWeek={() =>
                  setSupplierWeekAnchorKey((prev) =>
                    dateToKey(addDays(new Date(prev), -7)),
                  )
                }
                onNextWeek={() =>
                  setSupplierWeekAnchorKey((prev) =>
                    dateToKey(addDays(new Date(prev), 7)),
                  )
                }
                selectedDay={selectedDay}
                selectedProviderCode={selectedProviderCode}
                selectedReceiveDateKey={selectedReceiveDateKey}
                eligibleProviders={eligibleProviders.map((p) => ({
                  code: p.code,
                  name: p.name,
                }))}
                orderAmount={orderAmount}
                orderSaving={orderSaving}
                controlLoading={controlLoading}
                controlError={controlError}
                formatAmount={formatAmount}
                receiveAmountByProviderCodeForDay={
                  receiveAmountByProviderCodeForDay
                }
                setSelectedCreateDateKey={setSelectedCreateDateKey}
                setSelectedProviderCode={setSelectedProviderCode}
                setSelectedReceiveDateKey={setSelectedReceiveDateKey}
                setOrderAmount={setOrderAmount}
                handleSaveControlPedido={handleSaveControlPedido}
                handleDeleteControlPedido={handleDeleteControlPedido}
              />
            </div>
          )}

          {!showOnlySupplierWeek &&
            !showFavoritesView &&
            filteredDisplayedMenuItems.length > 0 &&
            (reorderEnabled ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => {
                  setLastDragEndAt(Date.now());
                  const { active, over } = event;
                  if (!over) return;
                  if (active.id === over.id) return;

                  const oldIndex = orderedVisibleMenuItemIds.indexOf(
                    String(active.id),
                  );
                  const newIndex = orderedVisibleMenuItemIds.indexOf(
                    String(over.id),
                  );
                  if (oldIndex < 0 || newIndex < 0) return;

                  const nextOrder = arrayMove(
                    orderedVisibleMenuItemIds,
                    oldIndex,
                    newIndex,
                  );
                  setSavedMenuOrder(nextOrder);
                  if (!homeMenuOrderStorageKey) return;
                  try {
                    localStorage.setItem(
                      homeMenuOrderStorageKey,
                      JSON.stringify(nextOrder),
                    );
                  } catch {
                    // ignore
                  }
                }}
              >
                <SortableContext
                  items={filteredDisplayedMenuItems.map((item) => item.id)}
                  strategy={rectSortingStrategy}
                >
                  {filteredDisplayedMenuItems.map((item) => (
                    <SortableHomeMenuCard
                      key={item.id}
                      id={item.id}
                      onClick={() => handleNavigate(item.id)}
                      lastDragEndAt={lastDragEndAt}
                      className="relative flex flex-col items-start overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-5 text-left text-white shadow-[0_20px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_24px_80px_rgba(8,15,40,0.45)] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 group touch-manipulation"
                      style={{ minHeight: FEATURED_MENU_IDS.has(item.id) ? 232 : 190 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/0 via-transparent to-fuchsia-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <div className="relative flex items-start justify-between gap-3 self-stretch">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 text-white shadow-[0_16px_40px_rgba(14,165,233,0.18)]">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300">
                          {activeMenuId === item.id
                            ? "Activo"
                            : FEATURED_MENU_IDS.has(item.id)
                              ? "Clave"
                              : "Acceso"}
                        </span>
                      </div>
                      <span className="relative mt-5 text-lg font-semibold text-white">
                        {item.name}
                      </span>
                      <span className="relative mt-2 text-sm leading-6 text-slate-300">
                        {item.description}
                      </span>
                      <div className="relative mt-6 flex w-full items-center justify-between text-sm text-slate-400">
                        <span>
                          {favoriteMenuIds.includes(item.id)
                            ? "En favoritos"
                            : "Abrir módulo"}
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </div>
                    </SortableHomeMenuCard>
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <>
                {filteredDisplayedMenuItems.map((item) => {
                  const theme = getMenuTheme(item.id);
                  const isActive = activeMenuId === item.id;
                  const featured = FEATURED_MENU_IDS.has(item.id);
                  return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`group relative flex flex-col items-start overflow-hidden rounded-[28px] border bg-white/5 p-5 text-left text-white shadow-[0_20px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_24px_80px_rgba(8,15,40,0.45)] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 touch-manipulation ${theme.border} ${getMenuSpanClass(item.id)} ${isActive ? "ring-1 ring-white/20" : ""}`}
                    style={{ minHeight: featured ? 232 : 190 }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-20`} />
                    <div className="relative flex items-start justify-between gap-3 self-stretch">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.gradient} text-white shadow-[0_16px_40px_rgba(14,165,233,0.18)]`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300">
                        {isActive ? "Activo" : featured ? "Clave" : "Acceso"}
                      </span>
                    </div>
                    <span className="relative mt-5 text-lg font-semibold text-white">
                      {item.name}
                    </span>
                    <span className="relative mt-2 text-sm leading-6 text-slate-300">
                      {item.description}
                    </span>
                    <div className="relative mt-6 flex w-full items-center justify-between text-sm text-slate-400">
                      <span>
                        {favoriteMenuIds.includes(item.id)
                          ? "En favoritos"
                          : "Abrir módulo"}
                      </span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </button>
                  );
                })}
              </>
            ))}

          {!showOnlySupplierWeek && showFavoritesView && (
            <>
              <div className="col-span-full flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Favoritos
                  </h2>
                </div>
              </div>

              {favoritesLoading ? (
                <div className="col-span-full rounded-[28px] border border-white/10 bg-white/5 p-6 text-center text-slate-300 backdrop-blur-xl">
                  Cargando favoritos...
                </div>
              ) : favoriteMenuItems.length > 0 ? (
                <>
                  {favoriteMenuItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigateFavorite(item)}
                        className="relative flex flex-col items-start overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-5 text-left text-white shadow-[0_20px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_24px_80px_rgba(8,15,40,0.45)] focus:outline-none focus:ring-2 focus:ring-amber-400/40 group touch-manipulation"
                        style={{ minHeight: 180 }}
                      >
                        <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-amber-200">
                          <Star className="w-4 h-4 fill-current" />
                        </span>
                        <IconComponent className="mb-3 h-10 w-10 text-cyan-100 transition-all group-hover:scale-110" />
                        <span className="mb-1 text-lg font-semibold text-white">
                          {item.label}
                        </span>
                        <span className="text-sm leading-6 text-slate-300">
                          {item.description}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setShowAddFavoriteModal(true)}
                    className="flex flex-col items-start justify-center rounded-[28px] border border-dashed border-white/15 bg-white/5 p-5 text-left text-white shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_24px_80px_rgba(8,15,40,0.45)] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 group touch-manipulation"
                    style={{ minHeight: 180 }}
                  >
                    <Plus className="mb-3 h-10 w-10 text-cyan-100 transition-all group-hover:scale-110" />
                    <span className="mb-1 text-lg font-semibold text-white">
                      Agregar favorito
                    </span>
                    <span className="text-sm leading-6 text-slate-300">
                      Selecciona accesos rápidos frecuentes
                    </span>
                  </button>
                </>
              ) : (
                <div className="col-span-full rounded-[28px] border border-white/10 bg-white/5 p-6 text-center space-y-3 backdrop-blur-xl">
                  <Star className="mx-auto h-10 w-10 text-amber-200" />
                  <div>
                    <p className="font-semibold text-white">
                      No tienes favoritos aún
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Usa la tarjeta {"Agregar favorito"} para configurarlos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddFavoriteModal(true)}
                    className="rounded-xl bg-cyan-400/15 px-4 py-2 text-cyan-100 transition hover:bg-cyan-400/25"
                  >
                    Agregar favorito
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* AnimatedStickman aparece solo después de 5 clicks */}
      {showStickman && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <AnimatedStickman />
        </div>
      )}

      {showAddFavoriteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-[var(--background)] border border-[var(--input-border)] rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--input-border)] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  Agregar favorito
                </h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Selecciona una tarjeta para agregarla o quitarla de tus
                  favoritos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFavoriteModal(false)}
                className="px-3 py-2 rounded-md hover:bg-[var(--hover-bg)] text-[var(--foreground)] transition-colors"
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-8">
              <div className="rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-4">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Favoritos activos: {favoriteMenuIds.length}
                </p>
              </div>

              {favoriteGroupOrder.map((group) => {
                const items = favoriteOptionsByGroup[group];
                if (!items || items.length === 0) return null;

                return (
                  <section key={group} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-[var(--foreground)]">
                        {group}
                      </h4>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {items.length} opción{items.length === 1 ? "" : "es"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {items.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = favoriteMenuIds.includes(item.id);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void handleToggleFavorite(item)}
                            className={`text-left rounded-xl border p-4 transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                              isActive
                                ? "border-amber-400 bg-amber-500/10"
                                : "border-[var(--input-border)] bg-[var(--card-bg)]"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg ${isActive ? "bg-amber-500/20 text-amber-500" : "bg-[var(--hover-bg)] text-[var(--primary)]"}`}
                              >
                                <IconComponent className="w-5 h-5" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h5 className="font-semibold text-[var(--foreground)] truncate">
                                    {item.label}
                                  </h5>
                                  <span
                                    className={`text-xs font-medium ${isActive ? "text-amber-500" : "text-[var(--muted-foreground)]"}`}
                                  >
                                    {isActive ? "Agregado" : "Disponible"}
                                  </span>
                                </div>
                                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {favoriteGroupOrder.every(
                (group) =>
                  !favoriteOptionsByGroup[group] ||
                  favoriteOptionsByGroup[group].length === 0,
              ) && (
                <div className="rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-center text-[var(--muted-foreground)]">
                  No hay opciones disponibles para tu rol.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
