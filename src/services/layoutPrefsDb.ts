type LayoutPrefRecord<T = unknown> = {
  key: string;
  value: T;
  updatedAt: number;
};

const DB_NAME = "layout-preferences-db";
const DB_VERSION = 1;
const STORE_NAME = "prefs";

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

async function openLayoutPrefsDb(): Promise<IDBDatabase> {
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

export async function getLayoutPref<T = unknown>(
  key: string,
): Promise<T | undefined> {
  const normalizedKey = key.trim();
  if (!normalizedKey) return undefined;

  const db = await openLayoutPrefsDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const record = await requestToPromise(
    store.get(normalizedKey) as IDBRequest<LayoutPrefRecord<T> | undefined>,
  );
  await txDone(tx);

  return record?.value;
}

export async function setLayoutPref<T = unknown>(
  key: string,
  value: T,
): Promise<void> {
  const normalizedKey = key.trim();
  if (!normalizedKey) return;

  const db = await openLayoutPrefsDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  store.put({
    key: normalizedKey,
    value,
    updatedAt: Date.now(),
  } satisfies LayoutPrefRecord<T>);

  await txDone(tx);
}

export type SessionListenerPreferenceKey =
  | "pendingCompanyRequests"
  | "chatReadMuteState";

export type SessionListenerPreferences = Record<
  SessionListenerPreferenceKey,
  boolean
>;

export const DEFAULT_SESSION_LISTENER_PREFERENCES: SessionListenerPreferences = {
  pendingCompanyRequests: false,
  chatReadMuteState: false,
};

const sessionListenerPreferenceKey = (
  userId: string,
  preference: SessionListenerPreferenceKey,
): string => `session-listener:${userId.trim()}:${preference}`;

export async function getSessionListenerPreferences(
  userId: string,
): Promise<SessionListenerPreferences> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return { ...DEFAULT_SESSION_LISTENER_PREFERENCES };

  const [pendingCompanyRequests, chatReadMuteState] = await Promise.all([
    getLayoutPref<boolean>(
      sessionListenerPreferenceKey(
        normalizedUserId,
        "pendingCompanyRequests",
      ),
    ),
    getLayoutPref<boolean>(
      sessionListenerPreferenceKey(normalizedUserId, "chatReadMuteState"),
    ),
  ]);

  return {
    pendingCompanyRequests: pendingCompanyRequests === true,
    chatReadMuteState: chatReadMuteState === true,
  };
}

export async function setSessionListenerPreference(
  userId: string,
  preference: SessionListenerPreferenceKey,
  enabled: boolean,
): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return;
  await setLayoutPref(
    sessionListenerPreferenceKey(normalizedUserId, preference),
    enabled === true,
  );
}

export function shouldSubscribePendingCompanyRequests(input: {
  loaded: boolean;
  enabled: boolean;
  company: string;
  tabVisible: boolean;
}): boolean {
  return (
    input.loaded &&
    input.enabled &&
    input.tabVisible &&
    input.company.trim().length > 0
  );
}

export function shouldSubscribeChatReadState(input: {
  loaded: boolean;
  enabled: boolean;
  ownerId: string;
  userId: string;
}): boolean {
  return (
    input.loaded &&
    input.enabled &&
    input.ownerId.trim().length > 0 &&
    input.userId.trim().length > 0
  );
}
