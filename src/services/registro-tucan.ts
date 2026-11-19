import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { RegistroTucanRecord } from "../types/firestore";
import { buildRegistroTucanEmpresaDocId } from "../utils/registroTucan";

const DB_NAME = "registro-tucan-db";
const DB_VERSION = 1;
const RECORDS_STORE = "records";
const PENDING_CREATE_STORE = "pendingCreates";
const PENDING_DELETE_STORE = "pendingDeletes";
const LEGACY_RECORDS_KEY = "registro-tucan-offline-records";

type OfflineRecord = RegistroTucanRecord & { id: string; offline?: boolean };
type PendingCreate = { key: string; input: OfflineRecord };
type PendingDelete = { key: string; empresa: string; recordId: string };

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error("IndexedDB no esta disponible."));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RECORDS_STORE)) {
          db.createObjectStore(RECORDS_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(PENDING_CREATE_STORE)) {
          db.createObjectStore(PENDING_CREATE_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(PENDING_DELETE_STORE)) {
          db.createObjectStore(PENDING_DELETE_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

function recordKey(empresa: string, recordId: string): string {
  return `${buildRegistroTucanEmpresaDocId(empresa)}::${recordId}`;
}

function normalizeCachedRecord(record: unknown): OfflineRecord | null {
  if (!record || typeof record !== "object") return null;
  const value = record as Record<string, unknown>;
  if (!value.empresa || !value.id) return null;
  return value as unknown as OfflineRecord;
}

export type RegistroTucanInput = Omit<
  RegistroTucanRecord,
  "id" | "currency" | "createdAt" | "updatedAt"
>;

export class RegistroTucanService {
  static readonly COLLECTION_NAME = "registrotucan";
  static readonly RECORDS_SUBCOLLECTION = "records";

  static buildEmpresaDocId(empresa: string): string {
    return buildRegistroTucanEmpresaDocId(empresa);
  }

  private static recordsCollectionRef(empresa: string) {
    return collection(
      db,
      this.COLLECTION_NAME,
      this.buildEmpresaDocId(empresa),
      this.RECORDS_SUBCOLLECTION,
    );
  }

  private static recordDocRef(empresa: string, recordId: string) {
    return doc(
      db,
      this.COLLECTION_NAME,
      this.buildEmpresaDocId(empresa),
      this.RECORDS_SUBCOLLECTION,
      recordId,
    );
  }

  static async createRecord(input: RegistroTucanInput): Promise<string> {
    const now = new Date();
    const payload = {
      ...input,
      empresaId: this.buildEmpresaDocId(input.empresa),
      currency: "CRC",
      createdAt: now,
      updatedAt: now,
    } satisfies Omit<RegistroTucanRecord, "id">;

    if (isOnline()) {
      try {
        const docRef = await addDoc(this.recordsCollectionRef(input.empresa), payload);
        await this.cacheRecord({ ...payload, id: docRef.id });
        return docRef.id;
      } catch (error) {
        console.warn("Registro Tucan online write failed; saving offline.", error);
      }
    }

    const offlineId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const offlineRecord: OfflineRecord = {
      ...payload,
      id: offlineId,
      offline: true,
    };
    await this.queueCreate(offlineRecord);
    await this.cacheRecord(offlineRecord);
    return offlineId;
  }

  static async getRecentRecords(
    empresa: string,
    limitCount = 20,
  ): Promise<RegistroTucanRecord[]> {
    const normalizedEmpresa = String(empresa || "").trim();
    if (!normalizedEmpresa) return [];

    if (isOnline()) {
      try {
        const q = query(
          this.recordsCollectionRef(normalizedEmpresa),
          orderBy("dateKey", "desc"),
          orderBy("hora", "desc"),
          limit(Math.max(1, Math.trunc(limitCount))),
        );
        const snap = await getDocs(q);
        const serverRecords = snap.docs.map((record) => ({
          id: record.id,
          ...(record.data() as Omit<RegistroTucanRecord, "id">),
        }));
        await this.replaceCachedEmpresaRecords(normalizedEmpresa, serverRecords);
        return this.mergeCachedAndPending(normalizedEmpresa, serverRecords, limitCount);
      } catch (error) {
        console.warn("Registro Tucan online read failed; using cache.", error);
      }
    }

    return this.getCachedRecords(normalizedEmpresa, limitCount);
  }

  static async deleteRecord(empresa: string, recordId: string): Promise<void> {
    const normalizedEmpresa = String(empresa || "").trim();
    const normalizedRecordId = String(recordId || "").trim();
    if (!normalizedEmpresa || !normalizedRecordId) return;

    await this.removeCachedRecord(normalizedEmpresa, normalizedRecordId);
    if (normalizedRecordId.startsWith("offline-")) {
      await this.removePendingCreate(normalizedEmpresa, normalizedRecordId);
      return;
    }

    if (isOnline()) {
      try {
        await deleteDoc(this.recordDocRef(normalizedEmpresa, normalizedRecordId));
        return;
      } catch (error) {
        console.warn("Registro Tucan online delete failed; queueing offline.", error);
      }
    }
    await this.queueDelete(normalizedEmpresa, normalizedRecordId);
  }

  private static async cacheRecord(record: OfflineRecord): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(RECORDS_STORE, "readwrite");
      tx.objectStore(RECORDS_STORE).put({
        key: recordKey(record.empresa, record.id),
        record,
      });
      await txDone(tx);
      db.close();
    } catch (error) {
      console.warn("No se pudo guardar Registro Tucan en IndexedDB.", error);
    }
  }

  private static async replaceCachedEmpresaRecords(
    empresa: string,
    records: RegistroTucanRecord[],
  ): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(RECORDS_STORE, "readwrite");
      const store = tx.objectStore(RECORDS_STORE);
      const cursorRequest = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            resolve();
            return;
          }
          const cached = normalizeCachedRecord(cursor.value?.record);
          if (
            cached &&
            buildRegistroTucanEmpresaDocId(cached.empresa) ===
              buildRegistroTucanEmpresaDocId(empresa)
          ) {
            cursor.delete();
          }
          cursor.continue();
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
      for (const record of records) {
        if (!record.id) continue;
        store.put({
          key: recordKey(empresa, record.id),
          record: { ...record, offline: false },
        });
      }
      await txDone(tx);
      db.close();
    } catch (error) {
      console.warn("No se pudo actualizar cache de Registro Tucan.", error);
    }
  }

  private static async getCachedRecords(
    empresa: string,
    limitCount: number,
  ): Promise<RegistroTucanRecord[]> {
    try {
      const db = await openDb();
      const tx = db.transaction(RECORDS_STORE, "readonly");
      const store = tx.objectStore(RECORDS_STORE);
      const records: RegistroTucanRecord[] = [];
      await new Promise<void>((resolve, reject) => {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          const record = normalizeCachedRecord(cursor.value?.record);
          if (
            record &&
            buildRegistroTucanEmpresaDocId(record.empresa) ===
              buildRegistroTucanEmpresaDocId(empresa)
          ) {
            records.push(record);
          }
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
      await txDone(tx);
      db.close();
      return this.sortAndLimit(records, limitCount);
    } catch {
      return this.getLegacyCachedRecords(empresa, limitCount);
    }
  }

  private static async mergeCachedAndPending(
    empresa: string,
    serverRecords: RegistroTucanRecord[],
    limitCount: number,
  ): Promise<RegistroTucanRecord[]> {
    const cached = await this.getCachedRecords(empresa, limitCount);
    const pending = await this.getPendingCreates(empresa);
    const serverIds = new Set(serverRecords.map((record) => record.id).filter(Boolean));
    const pendingOnly = pending.filter(
      (record) => record.id && !serverIds.has(record.id),
    );
    const cachedOnly = cached.filter(
      (record) =>
        record.id?.startsWith("offline-") &&
        !serverIds.has(record.id) &&
        !pendingOnly.some((pendingRecord) => pendingRecord.id === record.id),
    );
    return this.sortAndLimit(
      [...serverRecords, ...pendingOnly, ...cachedOnly],
      limitCount,
    );
  }

  private static async getPendingCreates(
    empresa: string,
  ): Promise<RegistroTucanRecord[]> {
    try {
      const db = await openDb();
      const tx = db.transaction(PENDING_CREATE_STORE, "readonly");
      const store = tx.objectStore(PENDING_CREATE_STORE);
      const pending = await requestPromise(store.getAll()) as PendingCreate[];
      await txDone(tx);
      db.close();
      return pending
        .map((item) => item.input)
        .filter(
          (record) =>
            buildRegistroTucanEmpresaDocId(record.empresa) ===
            buildRegistroTucanEmpresaDocId(empresa),
        );
    } catch {
      return [];
    }
  }

  private static sortAndLimit(
    records: RegistroTucanRecord[],
    limitCount: number,
  ): RegistroTucanRecord[] {
    return records
      .slice()
      .sort((a, b) =>
        (b.dateKey - a.dateKey) ||
        String(b.hora || "").localeCompare(String(a.hora || "")),
      )
      .slice(0, Math.max(1, Math.trunc(limitCount)));
  }

  private static getLegacyCachedRecords(
    empresa: string,
    limitCount: number,
  ): RegistroTucanRecord[] {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(LEGACY_RECORDS_KEY) || "[]",
      );
      if (!Array.isArray(parsed)) return [];
      return this.sortAndLimit(
        parsed.filter(
          (record) =>
            normalizeCachedRecord(record)?.empresa &&
            buildRegistroTucanEmpresaDocId(normalizeCachedRecord(record)!.empresa) ===
              buildRegistroTucanEmpresaDocId(empresa),
        ),
        limitCount,
      );
    } catch {
      return [];
    }
  }

  private static async removeCachedRecord(
    empresa: string,
    recordId: string,
  ): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(RECORDS_STORE, "readwrite");
      tx.objectStore(RECORDS_STORE).delete(recordKey(empresa, recordId));
      await txDone(tx);
      db.close();
    } catch (error) {
      console.warn("No se pudo eliminar registro de la cache.", error);
    }
  }

  private static async queueCreate(record: OfflineRecord): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(PENDING_CREATE_STORE, "readwrite");
      tx.objectStore(PENDING_CREATE_STORE).put({
        key: recordKey(record.empresa, record.id),
        input: record,
      } satisfies PendingCreate);
      await txDone(tx);
      db.close();
    } catch (error) {
      console.warn("No se pudo crear cola offline.", error);
    }
  }

  private static async removePendingCreate(
    empresa: string,
    recordId: string,
  ): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(PENDING_CREATE_STORE, "readwrite");
      tx.objectStore(PENDING_CREATE_STORE).delete(recordKey(empresa, recordId));
      await txDone(tx);
      db.close();
    } catch (error) {
      console.warn("No se pudo limpiar cola offline.", error);
    }
  }

  private static async queueDelete(
    empresa: string,
    recordId: string,
  ): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(PENDING_DELETE_STORE, "readwrite");
      tx.objectStore(PENDING_DELETE_STORE).put({
        key: recordKey(empresa, recordId),
        empresa,
        recordId,
      } satisfies PendingDelete);
      await txDone(tx);
      db.close();
    } catch (error) {
      console.warn("No se pudo crear eliminacion offline.", error);
    }
  }

  static async getPendingCount(): Promise<number> {
    if (!hasIndexedDb()) return 0;
    try {
      const db = await openDb();
      const createTx = db.transaction(PENDING_CREATE_STORE, "readonly");
      const createCount = await requestPromise(
        createTx.objectStore(PENDING_CREATE_STORE).count(),
      );
      await txDone(createTx);
      const deleteTx = db.transaction(PENDING_DELETE_STORE, "readonly");
      const deleteCount = await requestPromise(
        deleteTx.objectStore(PENDING_DELETE_STORE).count(),
      );
      await txDone(deleteTx);
      db.close();
      return createCount + deleteCount;
    } catch {
      return 0;
    }
  }

  static async syncPending(): Promise<void> {
    if (!isOnline()) return;
    try {
      const db = await openDb();
      const deleteTx = db.transaction(PENDING_DELETE_STORE, "readonly");
      const deleteStore = deleteTx.objectStore(PENDING_DELETE_STORE);
      const pendingDeletes = await requestPromise(deleteStore.getAll()) as PendingDelete[];
      await txDone(deleteTx);

      for (const pending of pendingDeletes) {
        try {
          await deleteDoc(this.recordDocRef(pending.empresa, pending.recordId));
          await this.removeCachedRecord(pending.empresa, pending.recordId);
          const tx = db.transaction(PENDING_DELETE_STORE, "readwrite");
          tx.objectStore(PENDING_DELETE_STORE).delete(pending.key);
          await txDone(tx);
        } catch (error) {
          console.warn("No se pudo sincronizar eliminacion Registro Tucan.", error);
        }
      }

      const createTx = db.transaction(PENDING_CREATE_STORE, "readonly");
      const createStore = createTx.objectStore(PENDING_CREATE_STORE);
      const pendingCreates = await requestPromise(createStore.getAll()) as PendingCreate[];
      await txDone(createTx);

      for (const pending of pendingCreates) {
        try {
          const { offline, id, ...input } = pending.input;
          const payload = {
            ...input,
            empresaId: this.buildEmpresaDocId(input.empresa),
            currency: "CRC",
            createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
            updatedAt: new Date(),
          } satisfies Omit<RegistroTucanRecord, "id">;
          const docRef = await addDoc(this.recordsCollectionRef(input.empresa), payload);
          await this.removeCachedRecord(input.empresa, id);
          await this.removePendingCreate(input.empresa, id);
          await this.cacheRecord({ ...payload, id: docRef.id });
        } catch (error) {
          console.warn("No se pudo sincronizar registro Registro Tucan.", error);
        }
      }
      db.close();
    } catch (error) {
      console.warn("No se pudo sincronizar Registro Tucan pendiente.", error);
    }
  }
}
