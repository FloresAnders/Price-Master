export type AnotacionLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  pinned: boolean;
};

const DB_NAME = "pricemaster-anotaciones";
const STORE_NAME = "layouts";
const DB_VERSION = 1;

type LayoutRecord = AnotacionLayout & {
  key: string;
  updatedAt: string;
};

const fallback = new Map<string, LayoutRecord>();

const openLayoutDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const buildPrefix = (userKey: string, empresaId: string) =>
  `${userKey || "anonymous"}::${empresaId || "GLOBAL"}::`;

export const buildAnotacionLayoutKey = (
  userKey: string,
  empresaId: string,
  noteId: string,
) => `${buildPrefix(userKey, empresaId)}${noteId}`;

export async function getAnotacionesLayoutMap(
  userKey: string,
  empresaId: string,
): Promise<Record<string, AnotacionLayout>> {
  const prefix = buildPrefix(userKey, empresaId);
  const db = await openLayoutDb();
  const output: Record<string, AnotacionLayout> = {};

  if (!db) {
    fallback.forEach((record, key) => {
      if (!key.startsWith(prefix)) return;
      output[key.slice(prefix.length)] = record;
    });
    return output;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(output);
        db.close();
        return;
      }

      const record = cursor.value as LayoutRecord;
      if (record.key.startsWith(prefix)) {
        output[record.key.slice(prefix.length)] = {
          x: record.x,
          y: record.y,
          width: record.width,
          height: record.height,
          z: record.z,
          pinned: record.pinned,
        };
      }
      cursor.continue();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function saveAnotacionLayout(
  userKey: string,
  empresaId: string,
  noteId: string,
  layout: AnotacionLayout,
): Promise<void> {
  const key = buildAnotacionLayoutKey(userKey, empresaId, noteId);
  const record: LayoutRecord = {
    key,
    x: Math.round(layout.x),
    y: Math.round(layout.y),
    width: Math.round(layout.width),
    height: Math.round(layout.height),
    z: Math.round(layout.z),
    pinned: Boolean(layout.pinned),
    updatedAt: new Date().toISOString(),
  };
  const db = await openLayoutDb();

  if (!db) {
    fallback.set(key, record);
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteAnotacionLayout(
  userKey: string,
  empresaId: string,
  noteId: string,
): Promise<void> {
  const key = buildAnotacionLayoutKey(userKey, empresaId, noteId);
  const db = await openLayoutDb();

  if (!db) {
    fallback.delete(key);
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
