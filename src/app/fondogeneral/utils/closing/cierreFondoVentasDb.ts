type CierreFondoVentasCacheRecord = {
  key: string;
  company: string;
  dateKey: string;
  turno: "D";
  conticaCRC: number;
  tucanCRC: number;
  tiemposCRC?: number;
  conticaTiemposCRC?: number;
  diffCRC: number;
  conticaAjustadaCRC: number;
  closingDateISO?: string;
  updatedAt: number;
};

const DB_NAME = "fondogeneral-cierre-fondo-ventas-db";
const DB_VERSION = 1;
const STORE_NAME = "turno-sistemas";

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function buildCacheKey(company: string, dateKey: string): string {
  const normalizedCompany = company.trim().toLowerCase();
  const normalizedDateKey = dateKey.trim();
  return `${normalizedCompany}::${normalizedDateKey}::D`;
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

async function openCierreFondoVentasDb(): Promise<IDBDatabase> {
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

export type CierreFondoVentasCacheValue = {
  conticaCRC: number;
  tucanCRC: number;
  tiemposCRC?: number;
  conticaTiemposCRC?: number;
  diffCRC: number;
  conticaAjustadaCRC: number;
  closingDateISO?: string;
};

export async function getCierreFondoVentasCache(
  company: string,
  dateKey: string,
): Promise<CierreFondoVentasCacheValue | null> {
  const normalizedCompany = company.trim();
  const normalizedDateKey = dateKey.trim();
  if (!normalizedCompany || !normalizedDateKey) return null;

  const db = await openCierreFondoVentasDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const record = await requestToPromise(
    store.get(buildCacheKey(normalizedCompany, normalizedDateKey)) as IDBRequest<
      CierreFondoVentasCacheRecord | undefined
    >,
  );
  await txDone(tx);

  if (!record) return null;

  return {
    conticaCRC: Number(record.conticaCRC) || 0,
    tucanCRC: Number(record.tucanCRC) || 0,
    tiemposCRC: Number(record.tiemposCRC) || 0,
    conticaTiemposCRC: Number(record.conticaTiemposCRC) || 0,
    diffCRC: Number(record.diffCRC) || 0,
    conticaAjustadaCRC: Number(record.conticaAjustadaCRC) || 0,
    closingDateISO:
      typeof record.closingDateISO === "string" ? record.closingDateISO : undefined,
  };
}

export async function setCierreFondoVentasCache(
  company: string,
  dateKey: string,
  value: CierreFondoVentasCacheValue,
): Promise<void> {
  const normalizedCompany = company.trim();
  const normalizedDateKey = dateKey.trim();
  if (!normalizedCompany || !normalizedDateKey) return;

  const db = await openCierreFondoVentasDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  store.put({
    key: buildCacheKey(normalizedCompany, normalizedDateKey),
    company: normalizedCompany,
    dateKey: normalizedDateKey,
    turno: "D",
    conticaCRC: Number(value.conticaCRC) || 0,
    tucanCRC: Number(value.tucanCRC) || 0,
    tiemposCRC: Number(value.tiemposCRC) || 0,
    conticaTiemposCRC: Number(value.conticaTiemposCRC) || 0,
    diffCRC: Number(value.diffCRC) || 0,
    conticaAjustadaCRC: Number(value.conticaAjustadaCRC) || 0,
    closingDateISO: value.closingDateISO,
    updatedAt: Date.now(),
  } satisfies CierreFondoVentasCacheRecord);

  await txDone(tx);
}

export async function deleteCierreFondoVentasCache(
  company: string,
  dateKey: string,
): Promise<void> {
  const normalizedCompany = company.trim();
  const normalizedDateKey = dateKey.trim();
  if (!normalizedCompany || !normalizedDateKey) return;

  const db = await openCierreFondoVentasDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.delete(buildCacheKey(normalizedCompany, normalizedDateKey));
  await txDone(tx);
}