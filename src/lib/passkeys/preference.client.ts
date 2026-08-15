"use client";

const DATABASE_NAME = "timemaster-auth";
const DATABASE_VERSION = 1;
const STORE_NAME = "preferences";
const PASSKEY_KEY = "passkey";

export interface PasskeyPreference {
  passkeyAvailable: boolean;
  lastSuccessfulUse: number | null;
}

const inactivePreference = (): PasskeyPreference => ({
  passkeyAvailable: false,
  lastSuccessfulUse: null,
});

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPreference(): Promise<PasskeyPreference | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(PASSKEY_KEY);
      request.onsuccess = () => resolve(request.result as PasskeyPreference | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function writePreference(preference: PasskeyPreference): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(preference, PASSKEY_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function getPasskeyPreference(): Promise<PasskeyPreference> {
  if (typeof indexedDB === "undefined") return inactivePreference();

  try {
    const stored = await readPreference();
    if (
      stored?.passkeyAvailable === true &&
      typeof stored.lastSuccessfulUse === "number"
    ) {
      return stored;
    }
  } catch (error) {
    console.warn("No se pudo leer la preferencia local de passkey", error);
  }
  return inactivePreference();
}

export async function markPasskeySuccessful(now = Date.now()): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await writePreference({ passkeyAvailable: true, lastSuccessfulUse: now });
}

export async function clearPasskeyPreference(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await writePreference(inactivePreference());
}
