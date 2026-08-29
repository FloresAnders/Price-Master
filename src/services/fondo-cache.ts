export type FondoCacheResource =
  | "providers"
  | "movement-types"
  | "movements";

export type FondoCacheScope = {
  databaseId: string;
  userId: string;
  ownerId: string;
  companyId: string;
  accountId?: string;
  resource: FondoCacheResource;
  dateKey?: string;
};

export type FondoCacheHit<T> = {
  data: T;
  freshness: "fresh" | "stale";
  storedAt: number;
  expiresAt: number;
};

type FondoCacheRecord<T = unknown> = {
  schemaVersion: 1;
  key: string;
  scope: FondoCacheScope;
  storedAt: number;
  expiresAt: number;
  data: T;
};

const CACHE_SCHEMA_VERSION = 1;
const DATABASE_NAME = "pricemaster-fondo-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "records";
const INVALIDATION_CHANNEL = "pricemaster-fondo-cache-invalidated";
const INVALIDATION_STORAGE_KEY = "pricemaster_fondo_cache_invalidation";

let databasePromise: Promise<IDBDatabase> | null = null;
let warnedUnavailable = false;
const invalidationListeners = new Set<
  (match: Partial<FondoCacheScope>) => void
>();
let sharedBroadcastChannel: BroadcastChannel | null = null;
let storageListenerInstalled = false;

const normalizePart = (value: unknown): string =>
  String(value ?? "").trim();

const normalizeScope = (scope: FondoCacheScope): FondoCacheScope => ({
  databaseId: normalizePart(scope.databaseId) || "(default)",
  userId: normalizePart(scope.userId),
  ownerId: normalizePart(scope.ownerId),
  companyId: normalizePart(scope.companyId),
  accountId: normalizePart(scope.accountId),
  resource: scope.resource,
  dateKey: normalizePart(scope.dateKey),
});

export function buildFondoCacheKey(scope: FondoCacheScope): string {
  const normalized = normalizeScope(scope);
  return JSON.stringify([
    CACHE_SCHEMA_VERSION,
    normalized.databaseId,
    normalized.userId,
    normalized.ownerId,
    normalized.companyId,
    normalized.accountId,
    normalized.resource,
    normalized.dateKey,
  ]);
}

const warnCacheFailure = (error: unknown) => {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(
    "[FondoCache] IndexedDB no está disponible; se continuará con Firestore.",
    error,
  );
};

const openDatabase = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });

export async function readFondoCache<T>(
  scope: FondoCacheScope,
  now = Date.now(),
): Promise<FondoCacheHit<T> | null> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const record = (await requestResult(
      transaction.objectStore(STORE_NAME).get(buildFondoCacheKey(scope)),
    )) as FondoCacheRecord<T> | undefined;
    await transactionComplete(transaction);

    if (!record || record.schemaVersion !== CACHE_SCHEMA_VERSION) return null;
    return {
      data: record.data,
      freshness: record.expiresAt > now ? "fresh" : "stale",
      storedAt: record.storedAt,
      expiresAt: record.expiresAt,
    };
  } catch (error) {
    warnCacheFailure(error);
    return null;
  }
}

export async function writeFondoCache<T>(
  scope: FondoCacheScope,
  data: T,
  ttlMs: number,
  now = Date.now(),
): Promise<void> {
  try {
    const normalizedScope = normalizeScope(scope);
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      schemaVersion: CACHE_SCHEMA_VERSION,
      key: buildFondoCacheKey(normalizedScope),
      scope: normalizedScope,
      storedAt: now,
      expiresAt: now + Math.max(0, Math.trunc(ttlMs)),
      data,
    } satisfies FondoCacheRecord<T>);
    await transactionComplete(transaction);
  } catch (error) {
    warnCacheFailure(error);
  }
}

const scopeMatches = (
  scope: FondoCacheScope,
  match: Partial<FondoCacheScope>,
): boolean =>
  (Object.keys(match) as Array<keyof FondoCacheScope>).every((key) => {
    const expected = match[key];
    if (expected === undefined) return true;
    return normalizePart(scope[key]) === normalizePart(expected);
  });

const notifyInvalidationListeners = (match: Partial<FondoCacheScope>) => {
  invalidationListeners.forEach((listener) => listener(match));
};

const publishInvalidation = (match: Partial<FondoCacheScope>) => {
  notifyInvalidationListeners(match);
  try {
    sharedBroadcastChannel?.postMessage(match);
  } catch {
    // Cross-tab propagation is best effort.
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        INVALIDATION_STORAGE_KEY,
        JSON.stringify({ match, nonce: `${Date.now()}-${Math.random()}` }),
      );
      localStorage.removeItem(INVALIDATION_STORAGE_KEY);
    } catch {
      // The BroadcastChannel path may still be available.
    }
  }
};

export async function invalidateFondoCache(
  match: Partial<FondoCacheScope>,
): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        const record = cursor.value as FondoCacheRecord;
        if (record?.scope && scopeMatches(record.scope, match)) {
          cursor.delete();
        }
        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB cursor failed"));
    });
    await transactionComplete(transaction);
    publishInvalidation(match);
  } catch (error) {
    warnCacheFailure(error);
  }
}

export async function clearFondoCacheForUser(userId: string): Promise<void> {
  const normalizedUserId = normalizePart(userId);
  if (!normalizedUserId) return;
  await invalidateFondoCache({ userId: normalizedUserId });
}

const ensureCrossTabListeners = () => {
  if (typeof window === "undefined") return;

  if (!sharedBroadcastChannel && typeof BroadcastChannel !== "undefined") {
    sharedBroadcastChannel = new BroadcastChannel(INVALIDATION_CHANNEL);
    sharedBroadcastChannel.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== "object") return;
      notifyInvalidationListeners(event.data as Partial<FondoCacheScope>);
    };
  }

  if (!storageListenerInstalled) {
    window.addEventListener("storage", (event) => {
      if (event.key !== INVALIDATION_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as {
          match?: Partial<FondoCacheScope>;
        };
        if (parsed.match) notifyInvalidationListeners(parsed.match);
      } catch {
        // Ignore malformed auxiliary cross-tab messages.
      }
    });
    storageListenerInstalled = true;
  }
};

export function subscribeFondoCacheInvalidation(
  listener: (match: Partial<FondoCacheScope>) => void,
): () => void {
  invalidationListeners.add(listener);
  ensureCrossTabListeners();
  return () => {
    invalidationListeners.delete(listener);
  };
}
