export type HomeMenuFavoriteRecord = {
  compoundKey: string;
  userKey: string;
  favoriteId: string;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = "home-menu-favorites-db";
const DB_VERSION = 1;
const STORE_NAME = "favorites";

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function normalizeUserKey(userKey: string): string {
  return userKey.trim().toLowerCase();
}

function buildCompoundKey(userKey: string, favoriteId: string): string {
  return `${normalizeUserKey(userKey)}::${favoriteId}`;
}

function openOnce(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "compoundKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    request.onblocked = () =>
      reject(new Error("IndexedDB bloqueada por otra pestaña/instancia"));
  });
}

export async function openHomeMenuFavoritesDb(): Promise<IDBDatabase> {
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

export async function getHomeMenuFavorites(userKey: string): Promise<string[]> {
  const normalizedUserKey = normalizeUserKey(userKey);
  if (!normalizedUserKey) return [];

  const db = await openHomeMenuFavoritesDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const allRecords = await requestToPromise(
    store.getAll() as IDBRequest<HomeMenuFavoriteRecord[]>,
  );
  await txDone(tx);

  return (allRecords || [])
    .filter((record) => record.userKey === normalizedUserKey)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((record) => record.favoriteId);
}

export async function addHomeMenuFavorite(
  userKey: string,
  favoriteId: string,
): Promise<void> {
  const normalizedUserKey = normalizeUserKey(userKey);
  const normalizedFavoriteId = favoriteId.trim();
  if (!normalizedUserKey || !normalizedFavoriteId) return;

  const db = await openHomeMenuFavoritesDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const now = Date.now();
  const compoundKey = buildCompoundKey(normalizedUserKey, normalizedFavoriteId);
  const existing = await requestToPromise(
    store.get(compoundKey) as IDBRequest<HomeMenuFavoriteRecord | undefined>,
  );

  store.put({
    compoundKey,
    userKey: normalizedUserKey,
    favoriteId: normalizedFavoriteId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  await txDone(tx);
}

export async function removeHomeMenuFavorite(
  userKey: string,
  favoriteId: string,
): Promise<void> {
  const normalizedUserKey = normalizeUserKey(userKey);
  const normalizedFavoriteId = favoriteId.trim();
  if (!normalizedUserKey || !normalizedFavoriteId) return;

  const db = await openHomeMenuFavoritesDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.delete(buildCompoundKey(normalizedUserKey, normalizedFavoriteId));
  await txDone(tx);
}
