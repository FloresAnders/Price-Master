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
