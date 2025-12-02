export interface EmpresaEmpleado {
  Empleado: string;
  hoursPerShift: number;
  extraAmount: number;
  ccssType: 'TC' | 'MT';
}

export interface Empresas {
  id?: string;
  ownerId: string;
  name: string;
  ubicacion: string;
  empleados: EmpresaEmpleado[];
}

export interface ProviderEntry {
  code: string;
  name: string;
  company: string;
  type?: string;
  category?: 'Ingreso' | 'Gasto' | 'Egreso';
  createdAt?: string;
  updatedAt?: string;
}

export interface Sorteo {
  id?: string;
  name: string;
}
export interface UserPermissions {
  scanner: boolean;      // Escáner - Escanear códigos de barras
  calculator: boolean;   // Calculadora - Calcular precios con descuentos
  converter: boolean;    // Conversor - Convertir y transformar texto
  cashcounter: boolean;  // Contador Efectivo - Contar billetes y monedas
  timingcontrol: boolean; // Control Tiempos - Registro de venta de tiempos
  controlhorario: boolean; // Control Horario - Registro de horarios de trabajo
  supplierorders: boolean; // Órdenes Proveedor - Gestión de órdenes de proveedores
  mantenimiento: boolean;  // Mantenimiento - Nueva sección de mantenimiento
  fondogeneral?: boolean; // Fondo General - Acceso a administración del fondo general
  fondogeneralBCR?: boolean; // Fondo General - Acceso a la cuenta BCR
  fondogeneralBN?: boolean; // Fondo General - Acceso a la cuenta BN
  fondogeneralBAC?: boolean; // Fondo General - Acceso a la cuenta BAC
  solicitud?: boolean; // Solicitud - Permiso extra en sección de Mantenimiento
  scanhistory: boolean;    // Historial General de Escaneos - Ver historial completo de escaneos
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
  // Nombre de la empresa dueña asignada (espacio ownercompanie)
  ownercompanie?: string;
  role?: 'admin' | 'user' | 'superadmin';
  isActive?: boolean;
  // Campo para marcar eliminación lógica; por defecto false
  eliminate?: boolean;
  permissions?: UserPermissions;
  photoUrl?: string;
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
  source: 'mobile' | 'web';
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
}