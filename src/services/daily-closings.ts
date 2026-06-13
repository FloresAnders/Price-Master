import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  getAuthoritativeNowISO,
  getAuthoritativeNowMs,
} from "@/utils/serverTime";
import { FirestoreService } from "./firestore";

const COSTA_RICA_TZ = "America/Costa_Rica";
const DEFAULT_MINUTES_AFTER_CLOSE = 45;
const NEUTRAL_ISO = "1970-01-01T00:00:00.000Z";
const NEUTRAL_DATE_KEY = "1970-01-01";

export type DailyClosingSchedule = {
  horarioApertura: string;
  horarioCierre: string;
  minutesAfterClose?: number | null;
};

export const DAILY_CLOSING_DUPLICATE_ERROR =
  "Ya existe un cierre de Fondo General para el día operativo";
export const DAILY_CLOSING_SCHEDULE_REQUIRED_ERROR =
  "No se puede crear el cierre: configure horarios de apertura y cierre válidos.";

export type DailyClosingRecord = {
  id: string;
  createdAt: string;
  closingDate: string;
  manager: string;
  totalCRC: number;
  totalUSD: number;
  recordedBalanceCRC: number;
  recordedBalanceUSD: number;
  diffCRC: number;
  diffUSD: number;
  notes: string;
  turno?: "D" | "N";
  sistemas?: {
    conticaCRC: number;
    tucanCRC?: number;
    tiemposCRC?: number;
    conticaTiemposCRC?: number;
    diffCRC?: number;
    diffTiemposCRC?: number;
    conticaAjustadaCRC?: number;
    tucanAjustadaCRC?: number;
    tiemposAjustadaCRC?: number;
    conticaTiemposAjustadaCRC?: number;
  };
  singleClosingReason?: string;
  noMovements?: boolean;
  noMovementsReason?: string;
  breakdownCRC: Record<number, number>;
  breakdownUSD: Record<number, number>;
  adjustmentResolution?: {
    removedAdjustments?: Array<{
      id?: string;
      currency?: "CRC" | "USD";
      amount?: number;
      amountIngreso?: number;
      amountEgreso?: number;
      manager?: string;
      createdAt?: string;
    }>;
    note?: string;
    postAdjustmentBalanceCRC?: number;
    postAdjustmentBalanceUSD?: number;
  };
};

export type DailyClosingsDocument = {
  company: string;
  updatedAt: string;
  closingsByDate: Record<string, DailyClosingRecord[]>;
};

const COLLECTION_NAME = "cierres";
const DELETED_COLLECTION_NAME = "cierresEliminados";
const DELETED_SUBCOLLECTION_NAME = "records";
const MAX_CLOSING_RECORDS = 50;

const pad = (value: number): string => value.toString().padStart(2, "0");

const parseHHMM = (value: unknown): number | null => {
  const match =
    typeof value === "string"
      ? value.trim().match(/^(\d{2}):(\d{2})$/)
      : null;
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
};

export const isValidDailyClosingSchedule = (
  schedule:
    | {
        horarioApertura?: string | null;
        horarioCierre?: string | null;
        minutesAfterClose?: number | null;
      }
    | null
    | undefined,
): schedule is DailyClosingSchedule =>
  parseHHMM(schedule?.horarioApertura) !== null &&
  parseHHMM(schedule?.horarioCierre) !== null;

const getCRDateParts = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COSTA_RICA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    minuteOfDay: value("hour") * 60 + value("minute"),
  };
};

const shiftDateKey = (year: number, month: number, day: number, delta: number) => {
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const buildCostaRicaEndOfDayISO = (dateKey: string): string =>
  new Date(`${dateKey}T23:59:00-06:00`).toISOString();

export const getOperationalDateKey = (
  iso: string,
  schedule: DailyClosingSchedule,
): string | null => {
  const parts = getCRDateParts(iso);
  if (!parts) return null;
  const openMin = parseHHMM(schedule?.horarioApertura);
  const closeMin = parseHHMM(schedule?.horarioCierre);
  if (openMin === null || closeMin === null) return null;
  const afterClose = Math.max(
    0,
    Number(schedule.minutesAfterClose ?? DEFAULT_MINUTES_AFTER_CLOSE) || 0,
  );
  const duration = ((closeMin - openMin + 1440) % 1440) || 1440;
  const elapsed = (parts.minuteOfDay - openMin + 1440) % 1440;
  if (elapsed > duration + afterClose) return null;
  return shiftDateKey(
    parts.year,
    parts.month,
    parts.day,
    parts.minuteOfDay < openMin ? -1 : 0,
  );
};

const resolveISOString = (value: unknown, fallback?: string): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
      return trimmed;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  if (value && typeof value === "object") {
    const candidate = value as { toDate?: () => Date };
    if (typeof candidate.toDate === "function") {
      try {
        const date = candidate.toDate();
        if (date instanceof Date && !Number.isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch {
        // ignore invalid timestamp values
      }
    }
  }
  if (fallback) return fallback;
  return NEUTRAL_ISO;
};

const sanitizeMoney = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return 0;
};

const sanitizeBreakdown = (input: unknown): Record<number, number> => {
  if (!input || typeof input !== "object") return {};
  return Object.entries(input as Record<string, unknown>).reduce<
    Record<number, number>
  >((acc, [key, rawValue]) => {
    const denom = Number(key);
    if (!Number.isFinite(denom)) return acc;
    const count = sanitizeMoney(rawValue);
    if (count > 0) acc[Math.trunc(denom)] = count;
    return acc;
  }, {});
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Firestore does not allow `undefined` anywhere in the payload.
 * This removes undefined keys deeply while preserving non-plain objects
 * (Timestamp, Date, GeoPoint, DocumentReference, FieldValue, etc.).
 */
function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return value;

  if (Array.isArray(value)) {
    return value
      .map((v) => stripUndefinedDeep(v))
      .filter((v) => v !== undefined) as any;
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      const cleaned = stripUndefinedDeep(v as any);
      if (cleaned !== undefined) out[k] = cleaned;
    });
    return out as any;
  }

  return value;
}

type AdjustmentResolutionRemoval = NonNullable<
  NonNullable<DailyClosingRecord["adjustmentResolution"]>["removedAdjustments"]
>[number];

const buildDateKeyFromISO = (isoString: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return isoString;
  const parsed = Date.parse(isoString);
  if (!Number.isNaN(parsed)) {
    const parts = getCRDateParts(new Date(parsed).toISOString());
    if (parts) {
      return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
    }
  }
  if (isoString.length >= 10) {
    const candidate = isoString.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      return candidate;
    }
  }
  return NEUTRAL_DATE_KEY;
};

const buildLegacyRecordId = (candidate: Record<string, unknown>): string => {
  const source = JSON.stringify(candidate);
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (Math.imul(31, hash) + source.charCodeAt(index)) | 0;
  }
  return `dc_legacy_${Math.abs(hash)}`;
};

const sanitizeRecord = (raw: unknown): DailyClosingRecord | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<DailyClosingRecord> &
    Record<string, unknown>;
  const id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : buildLegacyRecordId(candidate);
  const closingDate = resolveISOString(
    candidate.closingDate,
    "1970-01-01T00:00:00.000Z",
  );
  const createdAt = resolveISOString(candidate.createdAt, closingDate);
  const manager =
    typeof candidate.manager === "string" ? candidate.manager.trim() : "";
  const notes =
    typeof candidate.notes === "string" ? candidate.notes.trim() : "";
  const singleClosingReason =
    typeof candidate.singleClosingReason === "string"
      ? candidate.singleClosingReason.trim()
      : "";
  const noMovementsReason =
    typeof candidate.noMovementsReason === "string"
      ? candidate.noMovementsReason.trim()
      : "";

  const record: DailyClosingRecord = {
    id,
    createdAt,
    closingDate,
    manager,
    totalCRC: sanitizeMoney(candidate.totalCRC),
    totalUSD: sanitizeMoney(candidate.totalUSD),
    recordedBalanceCRC: sanitizeMoney(candidate.recordedBalanceCRC),
    recordedBalanceUSD: sanitizeMoney(candidate.recordedBalanceUSD),
    diffCRC: sanitizeMoney(candidate.diffCRC),
    diffUSD: sanitizeMoney(candidate.diffUSD),
    notes,
    ...(candidate.turno === "D" || candidate.turno === "N"
      ? { turno: candidate.turno }
      : {}),
    ...(singleClosingReason ? { singleClosingReason } : {}),
    ...(candidate.noMovements ? { noMovements: true } : {}),
    ...(noMovementsReason ? { noMovementsReason } : {}),
    breakdownCRC: sanitizeBreakdown(candidate.breakdownCRC),
    breakdownUSD: sanitizeBreakdown(candidate.breakdownUSD),
  } as DailyClosingRecord;

  // sanitize optional adjustmentResolution if present
  if (
    candidate.adjustmentResolution &&
    typeof candidate.adjustmentResolution === "object"
  ) {
    try {
      const ar = candidate.adjustmentResolution as Record<string, unknown>;
      const resolution: DailyClosingRecord["adjustmentResolution"] = {};
      const removed = Array.isArray(ar.removedAdjustments)
        ? (ar.removedAdjustments as unknown[])
            .map((it): AdjustmentResolutionRemoval | undefined => {
              if (!it || typeof it !== "object") return undefined;
              const candidateItem = it as Record<string, unknown>;
              const item: Partial<AdjustmentResolutionRemoval> = {};
              if (
                typeof candidateItem.id === "string" &&
                candidateItem.id.trim().length > 0
              ) {
                item.id = candidateItem.id.trim();
              }
              if (candidateItem.currency === "USD") item.currency = "USD";
              else if (candidateItem.currency === "CRC") item.currency = "CRC";
              if (candidateItem.amount !== undefined)
                item.amount = sanitizeMoney(candidateItem.amount);
              if (candidateItem.amountIngreso !== undefined)
                item.amountIngreso = sanitizeMoney(candidateItem.amountIngreso);
              if (candidateItem.amountEgreso !== undefined)
                item.amountEgreso = sanitizeMoney(candidateItem.amountEgreso);
              if (
                typeof candidateItem.manager === "string" &&
                candidateItem.manager.trim().length > 0
              ) {
                item.manager = candidateItem.manager.trim();
              }
              if (
                typeof candidateItem.createdAt === "string" &&
                candidateItem.createdAt.trim().length > 0
              ) {
                item.createdAt = candidateItem.createdAt.trim();
              }
              return Object.keys(item).length > 0
                ? (item as AdjustmentResolutionRemoval)
                : undefined;
            })
            .filter((entry): entry is AdjustmentResolutionRemoval =>
              Boolean(entry),
            )
        : undefined;
      if (removed && removed.length > 0) {
        resolution.removedAdjustments = removed;
      }
      if (typeof ar.note === "string") {
        const trimmedNote = ar.note.trim();
        if (trimmedNote.length > 0) {
          resolution.note = trimmedNote;
        }
      }
      if (ar.postAdjustmentBalanceCRC !== undefined) {
        resolution.postAdjustmentBalanceCRC = sanitizeMoney(
          ar.postAdjustmentBalanceCRC,
        );
      }
      if (ar.postAdjustmentBalanceUSD !== undefined) {
        resolution.postAdjustmentBalanceUSD = sanitizeMoney(
          ar.postAdjustmentBalanceUSD,
        );
      }
      if (Object.keys(resolution).length > 0) {
        record.adjustmentResolution = resolution;
      }
    } catch {
      // ignore malformed resolution
    }
  }

  return record;
};

const sortValueForRecord = (record: DailyClosingRecord): number => {
  const createdAtTs = Date.parse(record.createdAt);
  if (!Number.isNaN(createdAtTs)) return createdAtTs;
  const closingAtTs = Date.parse(record.closingDate);
  if (!Number.isNaN(closingAtTs)) return closingAtTs;
  return 0;
};

const sortRecordsDescending = (
  a: DailyClosingRecord,
  b: DailyClosingRecord,
): number => sortValueForRecord(b) - sortValueForRecord(a);

const getOccupiedClosingShifts = (
  records: DailyClosingRecord[],
): Set<"D" | "N"> => {
  const occupied = new Set<"D" | "N">();
  records.forEach((record) => {
    if (record.turno === "D" || record.turno === "N") occupied.add(record.turno);
  });
  records
    .filter((record) => record.turno !== "D" && record.turno !== "N")
    .slice()
    .sort((a, b) => sortValueForRecord(a) - sortValueForRecord(b))
    .forEach(() => {
      if (!occupied.has("D")) occupied.add("D");
      else if (!occupied.has("N")) occupied.add("N");
    });
  return occupied;
};

const trimClosingsMap = (
  map: Record<string, DailyClosingRecord[]>,
): Record<string, DailyClosingRecord[]> => {
  const buffer: Array<{ dateKey: string; record: DailyClosingRecord }> = [];
  Object.entries(map).forEach(([, records]) => {
    if (!Array.isArray(records)) return;
    records.forEach((record) => {
      const sanitized = sanitizeRecord(record);
      if (!sanitized) return;
      const resolvedKey = buildDateKeyFromISO(sanitized.closingDate);
      buffer.push({ dateKey: resolvedKey, record: sanitized });
    });
  });
  buffer.sort((a, b) => sortRecordsDescending(a.record, b.record));
  const trimmed = buffer.slice(0, MAX_CLOSING_RECORDS);
  const result: Record<string, DailyClosingRecord[]> = {};
  trimmed.forEach(({ dateKey, record }) => {
    if (!result[dateKey]) {
      result[dateKey] = [];
    }
    result[dateKey].push(record);
  });
  Object.keys(result).forEach((key) => {
    result[key] = result[key].slice().sort(sortRecordsDescending);
  });
  return result;
};

const sanitizeDocument = (
  raw: unknown,
  fallbackCompany: string,
): DailyClosingsDocument => {
  const base: DailyClosingsDocument = {
    company: fallbackCompany,
    updatedAt: NEUTRAL_ISO,
    closingsByDate: {},
  };
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const candidate = raw as Partial<DailyClosingsDocument> & {
    closings?: unknown;
    closingsByDate?: unknown;
  };

  if (
    typeof candidate.company === "string" &&
    candidate.company.trim().length > 0
  ) {
    base.company = candidate.company.trim();
  }
  base.updatedAt = resolveISOString(candidate.updatedAt, base.updatedAt);

  const collectionMap: Record<string, DailyClosingRecord[]> = {};

  if (
    candidate.closingsByDate &&
    typeof candidate.closingsByDate === "object"
  ) {
    Object.entries(candidate.closingsByDate as Record<string, unknown>).forEach(
      ([rawKey, rawList]) => {
        if (!Array.isArray(rawList)) return;
        const sanitizedRecords = rawList
          .map((record) => sanitizeRecord(record))
          .filter((record): record is DailyClosingRecord => record !== null);
        if (sanitizedRecords.length === 0) return;
        const normalizedKey = buildDateKeyFromISO(rawKey);
        collectionMap[normalizedKey] = sanitizedRecords.sort(
          sortRecordsDescending,
        );
      },
    );
  } else if (Array.isArray(candidate.closings)) {
    candidate.closings.forEach((record) => {
      const sanitized = sanitizeRecord(record);
      if (!sanitized) return;
      const dateKey = buildDateKeyFromISO(sanitized.closingDate);
      const list = collectionMap[dateKey] ?? [];
      list.push(sanitized);
      collectionMap[dateKey] = list;
    });
  }

  base.closingsByDate = trimClosingsMap(collectionMap);
  return base;
};

export class DailyClosingsService {
  static readonly MAX_RECORDS = MAX_CLOSING_RECORDS;

  private static buildDocumentId(company: string): string {
    return company.trim();
  }

  static extractAllClosings(
    document: DailyClosingsDocument,
  ): DailyClosingRecord[] {
    const entries = Object.values(document.closingsByDate).flat();
    return entries.slice().sort(sortRecordsDescending);
  }

  static async getDocument(
    company: string,
  ): Promise<DailyClosingsDocument | null> {
    const docId = this.buildDocumentId(company);
    if (!docId) return null;
    const raw = await FirestoreService.getById(COLLECTION_NAME, docId);
    if (!raw) return null;
    return sanitizeDocument(raw, docId);
  }

  static async getClosingsForDate(
    company: string,
    dateKey: string,
  ): Promise<DailyClosingRecord[]> {
    const doc = await this.getDocument(company);
    if (!doc) return [];
    const normalizedKey = buildDateKeyFromISO(dateKey);
    return doc.closingsByDate[normalizedKey]?.slice() ?? [];
  }

  static async saveClosing(
    company: string,
    record: DailyClosingRecord,
    schedule: DailyClosingSchedule,
  ): Promise<void> {
    const docId = this.buildDocumentId(company);
    if (!docId) {
      throw new Error("Company ID is required for saving closing");
    }
    const sanitizedRecord = sanitizeRecord(record);
    if (!sanitizedRecord) {
      throw new Error("Invalid closing record data");
    }
    if (!isValidDailyClosingSchedule(schedule)) {
      throw new Error(DAILY_CLOSING_SCHEDULE_REQUIRED_ERROR);
    }
    const updatedAt = await getAuthoritativeNowISO();
    let dateKey = buildDateKeyFromISO(sanitizedRecord.closingDate);
    const documentRef = doc(db, COLLECTION_NAME, docId);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(documentRef);
      const existingDocument = snapshot.exists()
        ? sanitizeDocument(snapshot.data(), docId)
        : null;
      const currentMap = existingDocument?.closingsByDate ?? {};
      const allExisting = Object.values(currentMap).flat();
      const originalRecord = allExisting.find(
        (item) => item.id === sanitizedRecord.id,
      );
      const isEditing = Boolean(originalRecord);
      if (originalRecord) {
        sanitizedRecord.closingDate = originalRecord.closingDate;
        dateKey = buildDateKeyFromISO(originalRecord.closingDate);
        if (originalRecord.turno) sanitizedRecord.turno = originalRecord.turno;
        else delete sanitizedRecord.turno;
      }
      if (
        !isEditing &&
        sanitizedRecord.turno !== "D" &&
        sanitizedRecord.turno !== "N"
      ) {
        throw new Error("Turno D/N requerido para cierre de Fondo General.");
      }
      const operationalDateKey = !isEditing ? getOperationalDateKey(
        sanitizedRecord.closingDate,
        schedule,
      ) : null;
      if (!isEditing && !operationalDateKey) {
        throw new Error("No se pudo resolver el día operativo del cierre.");
      }
      if (!isEditing && operationalDateKey && sanitizedRecord.turno) {
        const sameOperationalDay = Object.entries(currentMap).flatMap(
          ([storedDateKey, records]) =>
            records.filter(
              (item) => {
                if (item.id === sanitizedRecord.id) return false;
                const itemOperationalDateKey = getOperationalDateKey(
                  item.closingDate,
                  schedule,
                );
                return (
                  itemOperationalDateKey === operationalDateKey ||
                  (itemOperationalDateKey === null &&
                    storedDateKey === operationalDateKey)
                );
              },
            ),
        );
        if (
          getOccupiedClosingShifts(sameOperationalDay).has(
            sanitizedRecord.turno,
          )
        ) {
          throw new Error(
            `${DAILY_CLOSING_DUPLICATE_ERROR} ${operationalDateKey}, turno ${sanitizedRecord.turno}.`,
          );
        }
      }
      if (!isEditing && operationalDateKey && sanitizedRecord.turno === "N") {
        sanitizedRecord.closingDate =
          buildCostaRicaEndOfDayISO(operationalDateKey);
        dateKey = operationalDateKey;
      }

      Object.keys(currentMap).forEach((key) => {
        currentMap[key] = currentMap[key].filter(
          (item) => item.id !== sanitizedRecord.id,
        );
        if (currentMap[key].length === 0) delete currentMap[key];
      });
      currentMap[dateKey] = [sanitizedRecord, ...(currentMap[dateKey] ?? [])];
      const payload: DailyClosingsDocument = {
        company: existingDocument?.company ?? docId,
        updatedAt,
        closingsByDate: trimClosingsMap(currentMap),
      };
      transaction.set(documentRef, stripUndefinedDeep(payload));
    });

    // Verify the save was successful by reading back the data
    // Note: This works reliably because Firestore SDK serves reads from local cache
    // immediately after writes, ensuring consistency for the same client
    const verifyDoc = await this.getDocument(company);
    if (!verifyDoc) {
      throw new Error(
        "Failed to verify closing save: document not found after save",
      );
    }
    const verifyList = verifyDoc.closingsByDate[dateKey];
    const savedRecord = verifyList?.find(
      (item) => item.id === sanitizedRecord.id,
    );
    if (!savedRecord) {
      throw new Error(
        `Failed to verify closing save: record ${sanitizedRecord.id} not found after save`,
      );
    }
  }

  static async deleteLatestClosing(
    company: string,
    params: {
      expectedClosingId: string;
      reason: string;
      deletedBy?: {
        uid?: string;
        email?: string;
        name?: string;
        role?: string;
      };
      relatedAdjustments?: unknown[];
      lockedUntilBefore?: string | null;
      lockedUntilAfter?: string | null;
    },
  ): Promise<{
    deleted: DailyClosingRecord;
    latestAfter: DailyClosingRecord | null;
    deletedBackupId: string;
  }> {
    const docId = this.buildDocumentId(company);
    if (!docId) {
      throw new Error("Company ID is required for deleting closing");
    }

    const expectedId = String(params?.expectedClosingId || "").trim();
    if (!expectedId) {
      throw new Error("expectedClosingId is required");
    }

    const reason = String(params?.reason || "").trim();
    if (!reason) {
      throw new Error("Debe indicar un motivo para eliminar el cierre");
    }

    const existingDocument = await this.getDocument(docId);
    if (!existingDocument) {
      throw new Error(
        "No se encontró el documento de cierres para esta empresa",
      );
    }

    const all = this.extractAllClosings(existingDocument);
    const latest = all[0];
    if (!latest) {
      throw new Error("No hay cierres para eliminar");
    }

    if (latest.id !== expectedId) {
      throw new Error(
        `El cierre a eliminar ya no es el último. Recargue el historial e intente de nuevo.`,
      );
    }

    const deletedAtISO = await getAuthoritativeNowISO();
    const deletedAtMs = await getAuthoritativeNowMs();
    const deletedParts = getCRDateParts(deletedAtISO);
    if (!deletedParts) {
      throw new Error("No se pudo resolver la fecha autoritativa del cierre eliminado");
    }
    const dd = pad(deletedParts.day);
    const mm = pad(deletedParts.month);
    const yyyy = String(deletedParts.year);
    const deletedAtDisplay = `${dd}/${mm}/${yyyy}`;
    // Firestore doc IDs cannot contain '/', so use '-' in the ID.
    // Keep a millisecond suffix for uniqueness when deleting multiple times the same day.
    const deletedBackupId = `del_${dd}-${mm}-${yyyy}_${deletedAtMs}_${latest.id}`;

    // Build updated closings map (remove latest)
    const updatedMap: Record<string, DailyClosingRecord[]> = {};
    Object.entries(existingDocument.closingsByDate || {}).forEach(
      ([dateKey, list]) => {
        if (!Array.isArray(list)) return;
        const filtered = list.filter((r) => r?.id !== latest.id);
        if (filtered.length > 0) {
          updatedMap[dateKey] = filtered;
        }
      },
    );

    const trimmed = trimClosingsMap(updatedMap);
    const payload: DailyClosingsDocument = {
      company: existingDocument.company || docId,
      updatedAt: deletedAtISO,
      closingsByDate: trimmed,
    };

    const latestAfter = this.extractAllClosings(payload)[0] ?? null;

    // 1) Write backup first (abort if it fails)
    try {
      const backupRef = doc(
        collection(
          db,
          DELETED_COLLECTION_NAME,
          docId,
          DELETED_SUBCOLLECTION_NAME,
        ),
        deletedBackupId,
      );
      const rawBackup = {
        company: docId,
        deletedAt: deletedAtISO,
        deletedAtDisplay,
        deletedAtServer: serverTimestamp(),
        reason,
        deletedBy: params?.deletedBy ?? {},
        lockedUntilBefore: params?.lockedUntilBefore ?? null,
        lockedUntilAfter: params?.lockedUntilAfter ?? null,
        deletedClosing: latest,
        latestAfter,
        relatedAdjustments: Array.isArray(params?.relatedAdjustments)
          ? params?.relatedAdjustments
          : [],
        kind: "DailyClosingDeletionBackup",
        version: 1,
      };
      const safeBackup = stripUndefinedDeep(rawBackup);
      await setDoc(backupRef, safeBackup as any);
    } catch (err) {
      console.error(
        "[DailyClosingsService.deleteLatestClosing] Failed to write backup:",
        err,
      );
      throw new Error(
        "No se pudo guardar el respaldo del cierre eliminado. Operación cancelada.",
      );
    }

    // 2) Persist updated closings document
    await FirestoreService.addWithId(COLLECTION_NAME, docId, payload);

    return { deleted: latest, latestAfter, deletedBackupId };
  }
}
