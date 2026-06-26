export interface DayEntry {
  shift: string;
  horasPorDia?: number;
}

export interface MonthlySchedule {
  company: string;
  year: number;
  month: number;
  employees: Record<string, Record<string, DayEntry>>;
  updatedAt: Date;
}

export function buildDocId(company: string, year: number, month: number): string {
  return `${company}_${year}_${month}`;
}
