import type { CashCounterData } from "@/components/business/cash-counter-tabs/types";
import type { MovementAccountKey } from "@/services/movimientos-fondos";

export type CashCounterSnapshot = {
  counters: CashCounterData[];
  activeTab: number;
  lastSaved: string;
  revision: number;
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
const LEGACY_STORAGE_KEY = "cashCounters";
export const CASH_COUNTER_SNAPSHOT_EVENT = "price-master:cash-counter-snapshot";

const ACCOUNT_IDS = new Set<MovementAccountKey>([
  "FondoGeneral",
  "BCR",
  "BN",
  "BAC",
  "CajaNegra",
  "Tucan",
  "Tiempos",
]);

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
  const accountId = ACCOUNT_IDS.has(counter.accountId as MovementAccountKey)
    ? counter.accountId as MovementAccountKey
    : undefined;

  return {
    ...(accountId ? { accountId } : {}),
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
    revision: 0,
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
    revision: typeof source.revision === "number" && Number.isFinite(source.revision)
      ? Math.max(0, Math.trunc(source.revision))
      : 0,
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

export async function getOrCreateCashCounterSnapshot(): Promise<CashCounterSnapshot> {
  const stored = await getCashCounterSnapshot();
  if (stored) return stored;

  const legacyRaw = typeof window !== "undefined"
    ? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    : null;
  const snapshot = legacyRaw
    ? normalizeCashCounterSnapshot(JSON.parse(legacyRaw))
    : createDefaultCashCounterSnapshot();

  let saved: CashCounterSnapshot;
  try {
    saved = await saveCashCounterSnapshot(snapshot);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== "CASH_COUNTER_SNAPSHOT_CHANGED"
    ) {
      throw error;
    }
    const concurrent = await getCashCounterSnapshot();
    if (!concurrent) throw error;
    saved = concurrent;
  }
  if (legacyRaw && typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return saved;
}

export async function saveCashCounterSnapshot(
  snapshot: CashCounterSnapshot,
): Promise<CashCounterSnapshot> {
  const db = await openCashCounterDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const record = await requestToPromise(
    store.get(SNAPSHOT_KEY) as IDBRequest<CashCounterRecord | undefined>,
  );
  const normalizedInput = normalizeCashCounterSnapshot(snapshot);
  const currentRevision = record
    ? normalizeCashCounterSnapshot(record.value).revision
    : 0;

  if (normalizedInput.revision !== currentRevision) {
    await txDone(tx);
    throw new Error("CASH_COUNTER_SNAPSHOT_CHANGED");
  }

  const saved = {
    ...normalizedInput,
    revision: currentRevision + 1,
  };
  store.put({
    key: SNAPSHOT_KEY,
    value: saved,
    updatedAt: Date.now(),
  } satisfies CashCounterRecord);
  await txDone(tx);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CASH_COUNTER_SNAPSHOT_EVENT, {
        detail: saved,
      }),
    );
  }
  return saved;
}

export async function updateCashCounterSnapshotAtomically(
  update: (current: CashCounterSnapshot) => CashCounterSnapshot | null,
): Promise<boolean> {
  const db = await openCashCounterDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const record = await requestToPromise(
    store.get(SNAPSHOT_KEY) as IDBRequest<CashCounterRecord | undefined>,
  );

  if (!record) {
    await txDone(tx);
    return false;
  }

  const next = update(normalizeCashCounterSnapshot(record.value));
  if (!next) {
    await txDone(tx);
    return false;
  }

  const normalized = {
    ...normalizeCashCounterSnapshot(next),
    revision: normalizeCashCounterSnapshot(record.value).revision + 1,
  };
  store.put({
    key: SNAPSHOT_KEY,
    value: normalized,
    updatedAt: Date.now(),
  } satisfies CashCounterRecord);
  await txDone(tx);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CASH_COUNTER_SNAPSHOT_EVENT, { detail: normalized }),
    );
  }
  return true;
}

export async function clearCashCounterSnapshot(): Promise<void> {
  const db = await openCashCounterDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
  await txDone(tx);
}
