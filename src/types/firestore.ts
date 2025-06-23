export interface Location {
  id?: string;
  label: string;
  value: string;
  names: string[];
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
  role?: 'admin' | 'user';
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
}
