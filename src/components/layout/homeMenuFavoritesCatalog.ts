import { createElement, type ComponentType } from "react";
import {
  Banknote,
  Calculator,
  Clock,
  DollarSign,
  FileCode,
  FileText,
  History,
  Layers,
  List,
  Scan,
  Settings,
  Smartphone,
  Star,
  Truck,
  Type,
  UserPlus,
  Users,
} from "lucide-react";
import { CustomIcon } from "../../icons/icons";
import type { User, UserPermissions } from "../../types/firestore";
import { getDefaultPermissions } from "../../utils/permissions";

const FoodAndSodaIcon: ComponentType<{ className?: string }> = (props) =>
  createElement(CustomIcon, { name: "FoodAndSoda", ...props });

const AddSquareIcon: ComponentType<{ className?: string }> = (props) =>
  createElement(CustomIcon, { name: "AddSquare", ...props });

export type HomeMenuFavoriteGroup = "Herramientas" | "Recetas" | "Fondo General" | "Mantenimiento";

export type HomeMenuMaintenanceTab =
  | "users"
  | "sorteos"
  | "schedules"
  | "ccss"
  | "empresas"
  | "fondoTypes"
  | "funciones";

export type HomeMenuFavoriteOption = {
  id: string;
  label: string;
  description: string;
  group: HomeMenuFavoriteGroup;
  icon: ComponentType<{ className?: string }>;
  maintenanceTab?: HomeMenuMaintenanceTab;
  permission:
    | keyof UserPermissions
    | "agregarproductosdeli"
    | "fondogeneralCluster"
    | "supplierweek";
  hash: string;
};

export const HOME_MENU_FAVORITE_OPTIONS: HomeMenuFavoriteOption[] = [
  {
    id: "scanner",
    label: "Escáner",
    description: "Escanear códigos de barras",
    group: "Herramientas",
    icon: Scan,
    permission: "scanner",
    hash: "scanner",
  },
  {
    id: "calculator",
    label: "Calculadora",
    description: "Calcular precios con descuentos",
    group: "Herramientas",
    icon: Calculator,
    permission: "calculator",
    hash: "calculator",
  },
  {
    id: "converter",
    label: "Conversor",
    description: "Convertir y transformar texto",
    group: "Herramientas",
    icon: Type,
    permission: "converter",
    hash: "converter",
  },
  {
    id: "xml",
    label: "XML",
    description: "Cargar archivos XML",
    group: "Herramientas",
    icon: FileCode,
    permission: "xml",
    hash: "xml",
  },
  {
    id: "maintenance-users",
    label: "Usuarios",
    description: "Gestionar usuarios y permisos",
    group: "Mantenimiento",
    icon: Users,
    permission: "mantenimiento",
    hash: "edit",
    maintenanceTab: "users",
  },
  {
    id: "maintenance-sorteos",
    label: "Sorteos",
    description: "Gestionar sorteos del sistema",
    group: "Mantenimiento",
    icon: FileText,
    permission: "mantenimiento",
    hash: "edit",
    maintenanceTab: "sorteos",
  },
  {
    id: "maintenance-planilla",
    label: "Planilla",
    description: "Acceder a la planilla",
    group: "Mantenimiento",
    icon: Clock,
    permission: "mantenimiento",
    hash: "edit",
    maintenanceTab: "schedules",
  },
  {
    id: "maintenance-ccss",
    label: "CCSS",
    description: "Configurar pagos CCSS",
    group: "Mantenimiento",
    icon: DollarSign,
    permission: "mantenimiento",
    hash: "edit",
    maintenanceTab: "ccss",
  },
  {
    id: "maintenance-empresas",
    label: "Empresas",
    description: "Gestionar empresas",
    group: "Mantenimiento",
    icon: Banknote,
    permission: "mantenimiento",
    hash: "edit",
    maintenanceTab: "empresas",
  },
  {
    id: "maintenance-fondo-types",
    label: "Tipos Fondo",
    description: "Configurar tipos de movimientos",
    group: "Mantenimiento",
    icon: List,
    permission: "mantenimiento",
    hash: "edit",
    maintenanceTab: "fondoTypes",
  },
  {
    id: "maintenance-funciones",
    label: "Funciones",
    description: "Gestionar funciones del sistema",
    group: "Mantenimiento",
    icon: Layers,
    permission: "mantenimiento",
    hash: "edit",
    maintenanceTab: "funciones",
  },
  {
    id: "cashcounter",
    label: "Contador Efectivo",
    description: "Contar billetes y monedas (CRC/USD)",
    group: "Herramientas",
    icon: Banknote,
    permission: "cashcounter",
    hash: "cashcounter",
  },
  {
    id: "timingcontrol",
    label: "Control Tiempos",
    description: "Registro de venta de tiempos",
    group: "Herramientas",
    icon: Smartphone,
    permission: "timingcontrol",
    hash: "timingcontrol",
  },
  {
    id: "controlhorario",
    label: "Control Horario",
    description: "Registro de horarios de trabajo",
    group: "Herramientas",
    icon: Clock,
    permission: "controlhorario",
    hash: "controlhorario",
  },
  {
    id: "empleados",
    label: "Empleados",
    description: "Información de empleados",
    group: "Herramientas",
    icon: Users,
    permission: "empleados",
    hash: "empleados",
  },
  {
    id: "funciones",
    label: "Funciones",
    description: "Funciones por empresa",
    group: "Herramientas",
    icon: Layers,
    permission: "notificaciones",
    hash: "funciones",
  },
  {
    id: "calculohorasprecios",
    label: "Cálculo Horas Precios",
    description: "Cálculo de horas y precios (planilla)",
    group: "Herramientas",
    icon: Calculator,
    permission: "calculohorasprecios",
    hash: "calculohorasprecios",
  },
  {
    id: "supplierorders",
    label: "Órdenes Proveedor",
    description: "Gestión de órdenes de proveedores",
    group: "Herramientas",
    icon: Truck,
    permission: "supplierorders",
    hash: "supplierorders",
  },
  {
    id: "scanhistory",
    label: "Historial de Escaneos",
    description: "Ver historial completo de escaneos",
    group: "Herramientas",
    icon: History,
    permission: "scanhistory",
    hash: "scanhistory",
  },
  {
    id: "solicitud",
    label: "Solicitud",
    description: "Solicitudes y trámites",
    group: "Herramientas",
    icon: Type,
    permission: "solicitud",
    hash: "solicitud",
  },
  {
    id: "recetas",
    label: "Recetas",
    description: "Crear y editar recetas",
    group: "Recetas",
    icon: FoodAndSodaIcon,
    permission: "recetas",
    hash: "agregarproducto",
  },
  {
    id: "agregarproducto",
    label: "Agregar Productos",
    description: "Gestionar productos de recetas",
    group: "Recetas",
    icon: AddSquareIcon,
    permission: "agregarproductosdeli",
    hash: "agregarproducto",
  },
  {
    id: "fondogeneral",
    label: "Fondo General",
    description: "Administrar el fondo general",
    group: "Fondo General",
    icon: Banknote,
    permission: "fondogeneral",
    hash: "fondogeneral",
  },
  {
    id: "agregarproveedor",
    label: "Agregar Proveedor",
    description: "Registrar nuevos proveedores",
    group: "Fondo General",
    icon: UserPlus,
    permission: "fondogeneral",
    hash: "agregarproveedor",
  },
  {
    id: "reportes",
    label: "Reportes",
    description: "Ver reportes del fondo general",
    group: "Fondo General",
    icon: Layers,
    permission: "fondogeneral",
    hash: "reportes",
  },
  {
    id: "configuracion",
    label: "Configuración",
    description: "Configurar el fondo general",
    group: "Fondo General",
    icon: Settings,
    permission: "fondogeneral",
    hash: "configuracion",
  },
  {
    id: "supplierweek",
    label: "Semana Proveedores",
    description: "Ver la tarjeta semanal de proveedores",
    group: "Fondo General",
    icon: Star,
    permission: "supplierweek",
    hash: "SupplierWeek",
  },
  {
    id: "edit",
    label: "Mantenimiento",
    description: "Gestión y mantenimiento del sistema",
    group: "Mantenimiento",
    icon: Settings,
    permission: "mantenimiento",
    hash: "edit",
  },
];

export function getAccessibleHomeMenuFavoriteOptions(currentUser?: User | null) {
  if (!currentUser) return [];

  const userPermissions = currentUser.permissions || getDefaultPermissions(currentUser.role || "user");
  const isFondoPrivileged =
    currentUser.role === "admin" || currentUser.role === "superadmin";

  return HOME_MENU_FAVORITE_OPTIONS.filter((option) => {
    if (
      (option.id === "reportes" || option.id === "configuracion") &&
      !isFondoPrivileged
    ) {
      return false;
    }

    if (option.permission === "supplierweek") {
      return Boolean(userPermissions.supplierorders || userPermissions.fondogeneral);
    }

    if (option.permission === "agregarproductosdeli") {
      return Boolean(userPermissions.agregarproductosdeli);
    }

    if (option.permission === "fondogeneralCluster") {
      return Boolean(userPermissions.fondogeneral);
    }

    return Boolean(userPermissions[option.permission as keyof UserPermissions]);
  });
}
