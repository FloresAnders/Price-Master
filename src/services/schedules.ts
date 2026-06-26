import {
  collection,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { FirestoreService } from "./firestore";

export interface ScheduleEntry {
  id?: string;
  companieValue: string;
  employeeName: string;
  year: number;
  month: number;
  day: number;
  shift: string;
  horasPorDia?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

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

type FirestoreDoc = Record<string, any> & { id?: string };

const V2_ID_PREFIX = "v2:";

export function buildScheduleDocId(
  company: string,
  year: number,
  month: number,
): string {
  return `${company}_${year}_${month}`;
}

function isMonthlySchedule(docData: FirestoreDoc): docData is MonthlySchedule & {
  id?: string;
} {
  return (
    typeof docData.company === "string" &&
    typeof docData.year === "number" &&
    typeof docData.month === "number" &&
    docData.employees !== null &&
    typeof docData.employees === "object"
  );
}

function scheduleEntryId(docId: string, employeeName: string, day: number) {
  return [
    V2_ID_PREFIX,
    encodeURIComponent(docId),
    encodeURIComponent(employeeName),
    String(day),
  ].join(":");
}

function parseScheduleEntryId(id: string):
  | { docId: string; employeeName: string; day: number }
  | null {
  const parts = id.split(":");
  if (parts.length !== 4 || parts[0] !== "v2") return null;

  const day = Number(parts[3]);
  if (!Number.isInteger(day)) return null;

  return {
    docId: decodeURIComponent(parts[1]),
    employeeName: decodeURIComponent(parts[2]),
    day,
  };
}

function flattenMonthlySchedule(
  docId: string,
  monthly: MonthlySchedule,
): ScheduleEntry[] {
  return Object.entries(monthly.employees ?? {}).flatMap(
    ([employeeName, days]) =>
      Object.entries(days ?? {}).map(([dayKey, entry]) => ({
        id: scheduleEntryId(docId, employeeName, Number(dayKey)),
        companieValue: monthly.company,
        employeeName,
        year: monthly.year,
        month: monthly.month,
        day: Number(dayKey),
        shift: entry?.shift ?? "",
        ...(typeof entry?.horasPorDia === "number"
          ? { horasPorDia: entry.horasPorDia }
          : {}),
        updatedAt: monthly.updatedAt,
      })),
  );
}

function asLegacyEntry(docData: FirestoreDoc): ScheduleEntry {
  return docData as ScheduleEntry;
}

function entryKey(entry: ScheduleEntry): string {
  return [
    entry.companieValue,
    entry.year,
    entry.month,
    entry.employeeName,
    entry.day,
  ].join("\u0000");
}

function mergeScheduleEntries(
  monthlyEntries: ScheduleEntry[],
  legacyEntries: ScheduleEntry[],
): ScheduleEntry[] {
  const seenMonthly = new Set(monthlyEntries.map(entryKey));
  return [
    ...monthlyEntries,
    ...legacyEntries.filter((entry) => !seenMonthly.has(entryKey(entry))),
  ];
}

async function getDefaultHoursPerShift(
  company: string,
  employeeName: string,
): Promise<number> {
  try {
    const { EmpresasService } = await import("./empresas");
    const empresas = await EmpresasService.getAllEmpresas();
    const empresa = empresas.find(
      (emp) =>
        emp.ubicacion?.toLowerCase() === company.toLowerCase() ||
        emp.name?.toLowerCase() === company.toLowerCase() ||
        emp.id === company,
    );
    const employee = empresa?.empleados?.find(
      (emp) => emp.Empleado === employeeName,
    );
    return employee?.hoursPerShift ?? 8;
  } catch (error) {
    console.warn(
      "Error getting employee hoursPerShift, using default 8:",
      error,
    );
    return 8;
  }
}

export class SchedulesService {
  private static readonly COLLECTION_NAME = "schedules";

  static async getMonthlySchedule(
    locationValue: string,
    year: number,
    month: number,
  ): Promise<MonthlySchedule | null> {
    const ref = doc(
      db,
      this.COLLECTION_NAME,
      buildScheduleDocId(locationValue, year, month),
    );
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as FirestoreDoc;
    return isMonthlySchedule(data) ? (data as MonthlySchedule) : null;
  }

  static async getAllSchedules(): Promise<ScheduleEntry[]> {
    const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
    const monthlyEntries: ScheduleEntry[] = [];
    const legacyEntries: ScheduleEntry[] = [];

    querySnapshot.docs.forEach((snap) => {
      const data = { id: snap.id, ...snap.data() };
      if (isMonthlySchedule(data)) {
        monthlyEntries.push(...flattenMonthlySchedule(snap.id, data));
      } else {
        legacyEntries.push(asLegacyEntry(data));
      }
    });

    return mergeScheduleEntries(monthlyEntries, legacyEntries);
  }

  static async getScheduleById(id: string): Promise<ScheduleEntry | null> {
    const parsed = parseScheduleEntryId(id);
    if (!parsed) {
      return await FirestoreService.getById(this.COLLECTION_NAME, id);
    }

    const snap = await getDoc(doc(db, this.COLLECTION_NAME, parsed.docId));
    if (!snap.exists()) return null;
    const monthly = snap.data() as MonthlySchedule;
    const entry = monthly.employees?.[parsed.employeeName]?.[String(parsed.day)];
    if (!entry) return null;

    return {
      id,
      companieValue: monthly.company,
      employeeName: parsed.employeeName,
      year: monthly.year,
      month: monthly.month,
      day: parsed.day,
      shift: entry.shift,
      ...(typeof entry.horasPorDia === "number"
        ? { horasPorDia: entry.horasPorDia }
        : {}),
      updatedAt: monthly.updatedAt,
    };
  }

  static async addSchedule(
    schedule: Omit<ScheduleEntry, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    await this.updateScheduleShift(
      schedule.companieValue,
      schedule.employeeName,
      schedule.year,
      schedule.month,
      schedule.day,
      schedule.shift,
      { horasPorDia: schedule.horasPorDia },
    );

    return scheduleEntryId(
      buildScheduleDocId(schedule.companieValue, schedule.year, schedule.month),
      schedule.employeeName,
      schedule.day,
    );
  }

  static async updateSchedule(
    id: string,
    schedule: Partial<ScheduleEntry>,
  ): Promise<void> {
    const parsed = parseScheduleEntryId(id);
    if (!parsed) {
      return await FirestoreService.update(this.COLLECTION_NAME, id, {
        ...schedule,
        updatedAt: new Date(),
      });
    }

    const ref = doc(db, this.COLLECTION_NAME, parsed.docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const monthly = snap.data() as MonthlySchedule;
    const current =
      monthly.employees?.[parsed.employeeName]?.[String(parsed.day)] ?? {};
    const next: DayEntry = {
      shift: schedule.shift ?? current.shift ?? "",
    };

    const hours =
      typeof schedule.horasPorDia === "number"
        ? schedule.horasPorDia
        : current.horasPorDia;
    if (typeof hours === "number") next.horasPorDia = hours;

    await setDoc(
      ref,
      {
        employees: {
          [parsed.employeeName]: { [String(parsed.day)]: next },
        },
        updatedAt: new Date(),
      },
      { merge: true },
    );
  }

  static async deleteSchedule(id: string): Promise<void> {
    const parsed = parseScheduleEntryId(id);
    if (!parsed) {
      return await FirestoreService.delete(this.COLLECTION_NAME, id);
    }

    await updateDoc(
      doc(db, this.COLLECTION_NAME, parsed.docId),
      new FieldPath("employees", parsed.employeeName, String(parsed.day)),
      deleteField(),
      "updatedAt",
      new Date(),
    );
  }

  static async getSchedulesByLocationEmployeeMonth(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
  ): Promise<ScheduleEntry[]> {
    const monthly = await this.getMonthlySchedule(locationValue, year, month);
    const legacyEntries = await FirestoreService.query(this.COLLECTION_NAME, [
      { field: "companieValue", operator: "==", value: locationValue },
      { field: "employeeName", operator: "==", value: employeeName },
      { field: "year", operator: "==", value: year },
      { field: "month", operator: "==", value: month },
    ]);

    if (!monthly) return legacyEntries;

    return mergeScheduleEntries(
      flattenMonthlySchedule(
        buildScheduleDocId(locationValue, year, month),
        {
          ...monthly,
          employees: { [employeeName]: monthly.employees?.[employeeName] ?? {} },
        },
      ),
      legacyEntries,
    );
  }

  static async getSchedulesByLocationYearMonth(
    locationValue: string,
    year: number,
    month: number,
  ): Promise<ScheduleEntry[]> {
    const monthly = await this.getMonthlySchedule(locationValue, year, month);
    const legacyEntries = await FirestoreService.query(this.COLLECTION_NAME, [
      { field: "companieValue", operator: "==", value: locationValue },
      { field: "year", operator: "==", value: year },
      { field: "month", operator: "==", value: month },
    ]);

    if (!monthly) return legacyEntries;

    return mergeScheduleEntries(
      flattenMonthlySchedule(
        buildScheduleDocId(locationValue, year, month),
        monthly,
      ),
      legacyEntries,
    );
  }

  static async getSchedulesByLocationYearMonthDayRange(
    locationValue: string,
    year: number,
    month: number,
    startDayInclusive: number,
    endDayInclusive: number,
  ): Promise<ScheduleEntry[]> {
    const startDay = Math.max(1, Math.trunc(startDayInclusive));
    const endDay = Math.max(startDay, Math.trunc(endDayInclusive));
    const rows = await this.getSchedulesByLocationYearMonth(
      locationValue,
      year,
      month,
    );
    return rows.filter(
      (row) =>
        typeof row.day === "number" && row.day >= startDay && row.day <= endDay,
    );
  }

  static async getOrCreateScheduleEntry(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number,
  ): Promise<ScheduleEntry> {
    const existing = await this.findScheduleEntry(
      locationValue,
      employeeName,
      year,
      month,
      day,
    );
    if (existing) return existing;

    const newEntry = {
      companieValue: locationValue,
      employeeName,
      year,
      month,
      day,
      shift: "",
    };
    const id = await this.addSchedule(newEntry);
    return { ...newEntry, id };
  }

  static async findScheduleEntry(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number,
  ): Promise<ScheduleEntry | null> {
    const monthly = await this.getMonthlySchedule(locationValue, year, month);
    if (monthly) {
      const entry = monthly.employees?.[employeeName]?.[String(day)];
      if (entry) {
        return {
          id: scheduleEntryId(
            buildScheduleDocId(locationValue, year, month),
            employeeName,
            day,
          ),
          companieValue: locationValue,
          employeeName,
          year,
          month,
          day,
          shift: entry.shift,
          ...(typeof entry.horasPorDia === "number"
            ? { horasPorDia: entry.horasPorDia }
            : {}),
          updatedAt: monthly.updatedAt,
        };
      }
    }

    const existing = await FirestoreService.query(this.COLLECTION_NAME, [
      { field: "companieValue", operator: "==", value: locationValue },
      { field: "employeeName", operator: "==", value: employeeName },
      { field: "year", operator: "==", value: year },
      { field: "month", operator: "==", value: month },
      { field: "day", operator: "==", value: day },
    ]);

    return existing.length > 0 ? existing[0] : null;
  }

  static async updateScheduleShift(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number,
    shift: string,
    options?: { horasPorDia?: number },
  ): Promise<void> {
    const ref = doc(
      db,
      this.COLLECTION_NAME,
      buildScheduleDocId(locationValue, year, month),
    );
    const dayKey = String(day);
    const cleanShift = shift?.trim() ?? "";

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);

      if (!cleanShift) {
        if (!snap.exists()) return;
        tx.update(
          ref,
          new FieldPath("employees", employeeName, dayKey),
          deleteField(),
          "updatedAt",
          new Date(),
        );
        return;
      }

      const entry: DayEntry = { shift: cleanShift };
      if (cleanShift === "D" || cleanShift === "N") {
        entry.horasPorDia =
          typeof options?.horasPorDia === "number"
            ? options.horasPorDia
            : await getDefaultHoursPerShift(locationValue, employeeName);
      }

      tx.set(
        ref,
        {
          company: locationValue,
          year,
          month,
          employees: { [employeeName]: { [dayKey]: entry } },
          updatedAt: new Date(),
        },
        { merge: true },
      );
    });
  }

  static async updateScheduleHours(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number,
    horasPorDia: number,
  ): Promise<void> {
    const ref = doc(
      db,
      this.COLLECTION_NAME,
      buildScheduleDocId(locationValue, year, month),
    );
    const dayKey = String(day);

    if (horasPorDia <= 0) {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      await updateDoc(
        ref,
        new FieldPath("employees", employeeName, dayKey),
        deleteField(),
        "updatedAt",
        new Date(),
      );
      return;
    }

    await setDoc(
      ref,
      {
        company: locationValue,
        year,
        month,
        employees: {
          [employeeName]: { [dayKey]: { shift: "L", horasPorDia } },
        },
        updatedAt: new Date(),
      },
      { merge: true },
    );
  }

  static async migrateHorasPorDia(
    locationValue?: string,
    employeeName?: string,
  ): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;
    const { EmpresasService } = await import("./empresas");
    const empresas = await EmpresasService.getAllEmpresas();
    const schedules = (await this.getAllSchedules()).filter((schedule) => {
      if (locationValue && schedule.companieValue !== locationValue) {
        return false;
      }
      if (employeeName && schedule.employeeName !== employeeName) {
        return false;
      }
      return schedule.shift === "D" || schedule.shift === "N";
    });

    for (const schedule of schedules) {
      try {
        const empresa = empresas.find(
          (emp) =>
            emp.ubicacion?.toLowerCase() ===
              schedule.companieValue.toLowerCase() ||
            emp.name?.toLowerCase() === schedule.companieValue.toLowerCase() ||
            emp.id === schedule.companieValue,
        );
        const employee = empresa?.empleados?.find(
          (emp) => emp.Empleado === schedule.employeeName,
        );
        const correctHorasPorDia = employee?.hoursPerShift ?? 8;
        if (schedule.horasPorDia === correctHorasPorDia || !schedule.id) {
          continue;
        }

        await this.updateSchedule(schedule.id, {
          horasPorDia: correctHorasPorDia,
        });
        updated++;
      } catch (error) {
        console.error(
          `Error procesando horario ${schedule.employeeName} ${schedule.day}:`,
          error,
        );
        errors++;
      }
    }

    return { updated, errors };
  }
}
