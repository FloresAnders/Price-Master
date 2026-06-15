import type { User as FirestoreUser } from "../../../types/firestore";
import type { MappedEmpresa, ScheduleData, ShiftOption } from "./types";
import { SHIFT_OPTIONS_BASE, ADMIN_SHIFT_OPTIONS, ALL_SHIFT_COLORS } from "./constants";

export function isUserAdmin(user?: FirestoreUser | null): boolean {
  return user?.role === "admin" || user?.role === "superadmin";
}

export function userCanChangeEmpresa(user?: FirestoreUser | null): boolean {
  return user?.role === "admin" || user?.role === "superadmin";
}

export function userIsSuperAdmin(user?: FirestoreUser | null): boolean {
  return user?.role === "superadmin";
}

export function getShiftOptions(isAdmin: boolean): ShiftOption[] {
  const base = [...SHIFT_OPTIONS_BASE];
  if (isAdmin) {
    base.push(...ADMIN_SHIFT_OPTIONS);
  }
  return base;
}

export function getAllShiftColors(): ShiftOption[] {
  return ALL_SHIFT_COLORS;
}

export function getCellStyle(value: string) {
  const option = ALL_SHIFT_COLORS.find((opt) => opt.value === value);
  return option
    ? { backgroundColor: option.color, color: option.textColor }
    : { backgroundColor: "var(--card-bg)", color: "var(--foreground)" };
}

export function getStartOfCurrentQuincena(reference: Date = new Date()) {
  const ref = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() <= 15 ? 1 : 16);
}

export function formatDateShort(date: Date) {
  return date.toLocaleDateString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function getDaysToShow(viewMode: "first" | "second", fullMonthView: boolean, daysInMonth: number): number[] {
  if (fullMonthView) {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }
  if (viewMode === "first") {
    return Array.from({ length: 15 }, (_, i) => i + 1);
  }
  return Array.from({ length: daysInMonth - 15 }, (_, i) => i + 16);
}

export function getStateLabel(value: string): string {
  const labels: Record<string, string> = {
    V: "Vacaciones",
    I: "Incapacidad",
    L: "Libre",
    N: "Nocturno",
    D: "Diurno",
  };
  return labels[value] || value;
}

export function getIncompletePastDaysForMonth(
  data: ScheduleData,
  year: number,
  month: number,
  today: Date,
  startDay: number,
  endDay: number,
): number[] {
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const employeeNames = Object.keys(data);
  const incompleteDays: number[] = [];

  for (let day = startDay; day <= endDay; day++) {
    const dayKey = new Date(year, month, day).getTime();
    if (dayKey >= todayKey) continue;

    let hasN = false;
    let hasD = false;

    for (const emp of employeeNames) {
      const shift = data[emp]?.[String(day)] || "";
      if (shift === "N") hasN = true;
      else if (shift === "D") hasD = true;
      if (hasN && hasD) break;
    }

    if (!hasN || !hasD) incompleteDays.push(day);
  }

  return incompleteDays;
}

export function formatIncompletePastDaysMessage(days: number[]): string {
  const MAX_LIST = 8;
  const head = days.slice(0, MAX_LIST);
  const rest = days.length - head.length;
  const list = rest > 0 ? `${head.join(", ")} (+${rest} más)` : head.join(", ");
  return `Hay ${days.length} día(s) anterior(es) incompleto(s): ${list}. Deben tener ambos turnos N y D asignados.`;
}

export function calcEmployeeSummary(
  employeeName: string,
  shiftsByDay: { [day: string]: string } | undefined,
  daysToShow: number[],
  isDelifood: boolean,
  delifoodHoursData: { [emp: string]: { [day: string]: { hours: number } } },
): { workedDays: number; totalHours: number } {
  let workedDays = 0;
  let totalHours = 0;

  if (isDelifood) {
    totalHours = daysToShow.reduce((total, day) => {
      const hours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
      return total + hours;
    }, 0);
    workedDays = daysToShow.filter((day) => {
      const hours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
      return hours > 0;
    }).length;
  } else {
    daysToShow.forEach((day) => {
      const shift = shiftsByDay?.[day.toString()] || "";
      if (shift === "N" || shift === "D") {
        workedDays++;
        totalHours += 8; // hoursPerShift not known here, use approximate
      }
    });
  }

  return { workedDays, totalHours };
}

export function filterEmpresasByUser(
  allEmpresas: any[],
  user?: FirestoreUser | null,
): MappedEmpresa[] {
  let owned: any[] = [];

  if (!user) {
    owned = [];
  } else if (user.role === "superadmin") {
    owned = allEmpresas || [];
  } else {
    const resolvedOwnerId = user.ownerId || (user.eliminate === false ? user.id : "") || "";
    owned = (allEmpresas || []).filter((e) => {
      if (!e) return false;
      const ownerId = e.ownerId || "";
      const ownerIdMatch = ownerId && String(ownerId) === String(resolvedOwnerId);
      const name = e.name || "";
      const ubicacion = e.ubicacion || "";
      const ownerCompanieMatch =
        user.ownercompanie &&
        (String(name) === String(user.ownercompanie) ||
          String(ubicacion) === String(user.ownercompanie));
      return !!ownerIdMatch || !!ownerCompanieMatch;
    });
  }

  return (owned || []).map((e) => {
    const controlHorarioEmployees = (e.empleados || []).filter((emp: any) => {
      const ambos = Boolean(emp?.amboshorarios);
      const calculoPrecios = Boolean(emp?.calculoprecios);
      return ambos || !calculoPrecios;
    });
    return {
      id: e.id,
      label: e.name || e.ubicacion || e.id || "Empresa",
      value: e.ubicacion || e.name || e.id || "",
      mostrarInfoPago: e.mostrarInfoPago !== false,
      names: controlHorarioEmployees.map((emp: any) => emp.Empleado || ""),
      employees: controlHorarioEmployees.map((emp: any) => ({
        name: emp.Empleado || "",
        ccssType: emp.ccssType || "TC",
        hoursPerShift: emp.hoursPerShift ?? 8,
        extraAmount: emp.extraAmount || 0,
      })),
    };
  });
}

export function resolveEmpresaValue(
  assignedEmpresa: string | undefined | null,
  mapped: MappedEmpresa[],
): string | null {
  if (!assignedEmpresa || mapped.length === 0) return null;
  const assignedStr = String(assignedEmpresa).toLowerCase();
  const resolved = mapped.find((m) => {
    const mv = String(m.value || "").toLowerCase();
    const ml = String(m.label || "").toLowerCase();
    return mv === assignedStr || ml === assignedStr || ml.includes(assignedStr) || assignedStr.includes(mv);
  });
  return resolved ? String(resolved.value) : null;
}
