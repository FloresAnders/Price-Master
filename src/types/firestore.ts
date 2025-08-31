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
}

export interface CcssConfig {
  id?: string;
  mt: number; // Valor para Medio Tiempo
  tc: number; // Valor para Tiempo Completo
  valorhora: number; // Valor por hora predeterminado
  horabruta: number; // Valor por hora bruta
  updatedAt?: Date;
}
