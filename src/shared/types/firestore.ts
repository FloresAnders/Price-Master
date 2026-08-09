// Tipos de dominio movidos a src/entities/*/types.ts
// Este archivo re-exporta por compatibilidad (migración Fase 1).
export type {
  EmpresaEmpleado,
  Empresas,
} from "@/entities/empresa/types";
export type { Empleado } from "@/entities/empleado/types";
export type { ProductEntry } from "@/entities/producto/types";
export type { ProviderEntry } from "@/entities/proveedor/types";
export type {
  RecetaEntry,
  RecetaProductoItem,
} from "@/entities/receta/types";

export interface Sorteo {
  id?: string;
  name: string;
}

export type SubscriptionStatus = "pagado" | "pendiente" | "vencido";

export interface UserSubscription {
  paymentDate: string;
  status: SubscriptionStatus;
  monthlyAmount?: number;
  lastPaidAt?: string;
  updatedAt?: Date;
}

export interface UserPermissions {
  scanner: boolean; // Escáner - Escanear códigos de barras
  calculator: boolean; // Calculadora - Calcular precios con descuentos
  converter: boolean; // Conversor - Convertir y transformar texto
  xml: boolean; // XML - Exportación / generación de XML
  cashcounter: boolean; // Contador Efectivo - Contar billetes y monedas
  recetas: boolean; // Recetas - (en mantenimiento)
  notificaciones: boolean; // Notificaciones - Acceso a notificaciones (sin tarjeta en HomeMenu)
  agregarproductosdeli: boolean; // Agregar productos deli - permiso interno (sin tarjeta)
  timingcontrol: boolean; // Control Tiempos - Registro de venta de tiempos
  controlhorario: boolean; // Control Horario - Registro de horarios de trabajo
  calculohorasprecios: boolean; // Calculo horas precios - Cálculo de horas y precios/planilla
  empleados: boolean; // Empleados - Información (próximamente)
  supplierorders: boolean; // Órdenes Proveedor - Gestión de órdenes de proveedores
  reportessinpe?: boolean; // Reportes SINPE - Acceso a tarjeta y módulo
  mantenimiento: boolean; // Mantenimiento - Nueva sección de mantenimiento
  fondogeneral?: boolean; // Fondo General - Acceso a administración del fondo general
  fondogeneralBCR?: boolean; // Fondo General - Acceso a la cuenta BCR
  fondogeneralBN?: boolean; // Fondo General - Acceso a la cuenta BN
  fondogeneralBAC?: boolean; // Fondo General - Acceso a la cuenta BAC
  cajaNegra?: boolean; // Caja Negra - Manejo de dineros extra del Fondo General
  tucan?: boolean; // Tucan - Manejo de dineros extra del Fondo General
  tiempos?: boolean; // Tiempos - Manejo de dineros extra del Fondo General
  deudasInternas?: boolean; // Deudas Internas - Deudas entre empresas y personas
  registroTucan?: boolean; // Registro Tucan - Seccion independiente en mantenimiento
  registroTiempos?: boolean; // Registro Tiempos - Seccion independiente en mantenimiento
  solicitud?: boolean; // Solicitud - Permiso extra en sección de Mantenimiento
  anotaciones: boolean; // Anotaciones - Pagina en mantenimiento
  scanhistory: boolean; // Historial General de Escaneos - Ver historial completo de escaneos
  scanhistoryEmpresas?: string[]; // Empresas específicas para historial de escaneos (almacena company names)
}

export interface User {
  id?: string;
  name: string;
  // correo electrónico del usuario
  email?: string;
  // nombre completo de la persona encargada (para admins)
  fullName?: string;
  // máximo de empresas que un admin puede manejar simultáneamente
  maxCompanies?: number;
  password?: string;
  // si el usuario pertenece a un owner (para multi-tenant)
  ownerId?: string;
  // id del usuario que creó este registro
  createdById?: string;
  // Nombre de la empresa dueña asignada (espacio ownercompanie)
  ownercompanie?: string;
  role?: "admin" | "user" | "superadmin";
  isActive?: boolean;
  // Campo para marcar eliminación lógica; por defecto false
  eliminate?: boolean;
  permissions?: UserPermissions;
  subscription?: UserSubscription;
  photoUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AnotacionStatus = "pending" | "done" | "archived";
export type AnotacionPriority = "low" | "medium" | "high" | "urgent";

export interface Anotacion {
  id: string;
  empresa: string;
  empresaId: string;
  ownerId?: string;
  title: string;
  description: string;
  category: string;
  color: string;
  priority: AnotacionPriority;
  status: AnotacionStatus;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  reminderAt?: string;
  archivedAt?: string;
  doneAt?: string;
}

export interface RegistroTucanRecord {
  id?: string;
  empresaId?: string;
  empresa: string;
  dateKey: number;
  fecha: string;
  hora?: string;
  saldoPaginaTucan: number;
  saldoFondoTucan: number;
  pagosHoy?: number;
  saldoSinpesRecibidos: number;
  total: number;
  motivo?: string;
  currency: "CRC";
  createdById?: string;
  createdByName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RegistroTiemposRecord {
  id?: string;
  empresaId?: string;
  empresa: string;
  dateKey: number;
  fecha: string;
  hora?: string;
  saldoPaginaTiempos: number;
  saldoFondoTiempos: number;
  pagosHoy?: number;
  saldoSinpesRecibidos: number;
  total: number;
  motivo?: string;
  currency: "CRC";
  createdById?: string;
  createdByName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScheduleEntry {
  id?: string;
  companieValue: string;
  employeeName: string;
  year: number;
  month: number;
  day: number;
  shift: string; // 'N', 'D', 'L', or empty string
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScanResult {
  id?: string;
  code: string;
  timestamp: Date;
  source: "mobile" | "web";
  userId?: string;
  userName?: string;
  processed: boolean;
  sessionId?: string;
  processedAt?: Date;
  productName?: string; // Optional product name for scanned codes
  ownercompanie?: string; // Owner company name/identifier assigned from mobile scanning
  hasImages?: boolean; // Indicates if the code has associated images
  codeBU?: string; // Numeric-only code extracted from photo (if available)
}

export interface CcssConfig {
  id?: string;
  ownerId: string; // ID del propietario de la configuración
  companie: companies[]; // Nombre de la empresa propietaria
  updatedAt?: Date;
}
export interface companies {
  ownerCompanie: string; // Nombre de la empresa propietaria
  mt: number; // Valor para Medio Tiempo
  tc: number; // Valor para Tiempo Completo
  valorhora: number; // Valor por hora predeterminado
  horabruta: number; // Valor por hora bruta
  pagoTotalMT?: number; // Pago total para MT
  pagoTotalTC?: number; // Pago total para TC
  pagoTotalPH?: number; // Pago total para PH (valorhora)
}

export interface FondoMovementTypeConfig {
  id?: string;
  category: "INGRESO" | "GASTO" | "EGRESO";
  name: string;
  order?: number; // Para mantener el orden de los tipos
  createdAt?: Date;
  updatedAt?: Date;
}
