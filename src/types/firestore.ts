export interface Location {
  id?: string;
  label: string;
  value: string;
  names: string[];
  employees?: Employee[]; // Nueva estructura para empleados con tipo CCSS
}

export interface Employee {
  name: string;
  ccssType: 'TC' | 'MT'; // TC = Tiempo Completo, MT = Medio Tiempo
  extraAmount?: number; // Monto extra, valor inicial 0
  hoursPerShift?: number; // Horas por turno, valor predeterminado 8
}

export interface Sorteo {
  id?: string;
  name: string;
}
export interface User {
  id?: string;
  name: string;
  location?: string;
  password?: string;
  role?: 'admin' | 'user' | 'superadmin';
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScheduleEntry {
  id?: string;
  locationValue: string;
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
  location?: string; // Selected location from mobile scanning
}

export interface CcssConfig {
  id?: string;
  mt: number; // Valor para Medio Tiempo
  tc: number; // Valor para Tiempo Completo
  valorhora: number; // Valor por hora predeterminado
  horabruta: number; // Valor por hora bruta
  updatedAt?: Date;
}
