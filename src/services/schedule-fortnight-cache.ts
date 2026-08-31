import type { ScheduleEntry } from "./schedules";

const DB_NAME = "timemaster-schedule-cache";
const STORE_NAME = "fortnights";
const TTL_MS = 12 * 60 * 60 * 1000;
let databasePromise: Promise<IDBDatabase> | null = null;
const generations = new Map<string, number>();

type CacheRecord = {
  key: string;
  company: string;
  rangeKey: string;
  rows: ScheduleEntry[];
  expiresAt: number;
  schemaVersion: 1;
};

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function getFortnightRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startDay = date.getDate() <= 15 ? 1 : 16;
  const endDay = startDay === 1 ? 15 : new Date(year, month + 1, 0).getDate();
  const start = new Date(year, month, startDay);
  const end = new Date(year, month, endDay);
  return { start, end, key: `${dateKey(start)}_${dateKey(end)}` };
}

const recordKey = (company: string, rangeKey: string) =>
  `${company.trim().toLowerCase()}::${rangeKey}`;

export const getScheduleFortnightCacheGeneration = (
  company: string,
  rangeKey: string,
) => generations.get(recordKey(company, rangeKey)) ?? 0;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

export async function readScheduleFortnightCache(company: string, rangeKey: string) {
  try {
    const db = await openDatabase();
    return await new Promise<ScheduleEntry[] | null>((resolve) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(recordKey(company, rangeKey));
      request.onsuccess = () => {
        const value = request.result as CacheRecord | undefined;
        resolve(value?.schemaVersion === 1 && value.expiresAt > Date.now() && Array.isArray(value.rows) ? value.rows : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeScheduleFortnightCache(company: string, rangeKey: string, rows: ScheduleEntry[], expectedGeneration?: number) {
  if (
    expectedGeneration !== undefined &&
    getScheduleFortnightCacheGeneration(company, rangeKey) !== expectedGeneration
  ) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ key: recordKey(company, rangeKey), company, rangeKey, rows, expiresAt: Date.now() + TTL_MS, schemaVersion: 1 } satisfies CacheRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache failures never block Firestore-backed screens.
  }
}

export async function invalidateScheduleFortnightCache(company: string, year: number, month: number, day: number) {
  const range = getFortnightRange(new Date(year, month - 1, day));
  const key = recordKey(company, range.key);
  generations.set(key, (generations.get(key) ?? 0) + 1);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(recordKey(company, range.key));
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Ignore cache invalidation failures.
  }
}

export async function clearScheduleFortnightCache() {
  generations.clear();
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Ignore cache cleanup failures.
  }
}
