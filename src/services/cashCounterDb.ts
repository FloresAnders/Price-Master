import type { CashCounterData } from "@/components/business/cash-counter-tabs/types";

export type CashCounterSnapshot = {
  counters: CashCounterData[];
  activeTab: number;
  lastSaved: string;
};

type CashCounterRecord = {
  key: string;
  value: CashCounterSnapshot;
  updatedAt: number;
};

const DB_NAME = "cash-counter-db";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "cashCounters";

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openOnce(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    request.onblocked = () =>
      reject(new Error("IndexedDB bloqueada por otra pestaña/instancia"));
  });
}

async function openCashCounterDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    throw new Error("IndexedDB no está disponible en este entorno.");
  }

  if (!dbPromise) {
    dbPromise = openOnce().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Error en operación IndexedDB"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("Transacción IndexedDB fallida"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("Transacción IndexedDB abortada"));
  });
}

function numericValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeBills(value: unknown): Record<number, number> {
  if (!value || typeof value !== "object") return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<number, number>>(
    (acc, [denomination, rawCount]) => {
      const numericDenomination = Number(denomination);
      const numericCount = Number(rawCount);

      if (!Number.isFinite(numericDenomination) || !Number.isFinite(numericCount)) {
        return acc;
      }

      acc[numericDenomination] = Math.max(0, Math.trunc(numericCount));
      return acc;
    },
    {},
  );
}

function normalizeCounter(item: unknown, index: number): CashCounterData {
  const counter = item && typeof item === "object" ? item as Record<string, unknown> : {};

  return {
    name: typeof counter.name === "string" && counter.name.trim()
      ? counter.name
      : `Contador ${index + 1}`,
    bills: normalizeBills(counter.bills),
    extraAmount: numericValue(counter.extraAmount),
    currency: counter.currency === "USD" ? "USD" : "CRC",
    aperturaCaja: numericValue(counter.aperturaCaja),
    ventaActual: numericValue(counter.ventaActual),
  };
}

export function createDefaultCashCounterSnapshot(): CashCounterSnapshot {
  return {
    counters: [{
      name: "Contador 1",
      bills: {},
      extraAmount: 0,
      currency: "CRC",
      aperturaCaja: 0,
      ventaActual: 0,
    }],
    activeTab: 0,
    lastSaved: new Date().toISOString(),
  };
}

export function normalizeCashCounterSnapshot(input: unknown): CashCounterSnapshot {
  const source = Array.isArray(input)
    ? { counters: input, activeTab: 0, lastSaved: new Date().toISOString() }
    : input && typeof input === "object"
      ? input as Record<string, unknown>
      : {};

  const rawCounters = Array.isArray(source.counters) ? source.counters : [];
  if (rawCounters.length === 0) {
    return createDefaultCashCounterSnapshot();
  }

  const counters = rawCounters.map(normalizeCounter);
  const activeTab = typeof source.activeTab === "number" && Number.isFinite(source.activeTab)
    ? Math.min(Math.max(Math.trunc(source.activeTab), 0), counters.length - 1)
    : 0;

  return {
    counters,
    activeTab,
    lastSaved: typeof source.lastSaved === "string"
      ? source.lastSaved
      : new Date().toISOString(),
  };
}

export async function getCashCounterSnapshot(): Promise<CashCounterSnapshot | undefined> {
  const db = await openCashCounterDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const record = await requestToPromise(
    store.get(SNAPSHOT_KEY) as IDBRequest<CashCounterRecord | undefined>,
  );
  await txDone(tx);

  return record ? normalizeCashCounterSnapshot(record.value) : undefined;
}

export async function saveCashCounterSnapshot(snapshot: CashCounterSnapshot): Promise<void> {
  const db = await openCashCounterDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put({
    key: SNAPSHOT_KEY,
    value: normalizeCashCounterSnapshot(snapshot),
    updatedAt: Date.now(),
  } satisfies CashCounterRecord);
  await txDone(tx);
}

export async function clearCashCounterSnapshot(): Promise<void> {
  const db = await openCashCounterDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
  await txDone(tx);
}
