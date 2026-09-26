import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/config/firebase";

type FirestoreReadOperation = "getById" | "query" | "getAll";

type FirestoreReadStats = Record<FirestoreReadOperation, number> & {
  cacheHits: number;
  inFlightDedup: number;
};

export type FirestoreStatsSnapshot = {
  readsByCollection: Record<string, FirestoreReadStats>;
  totals: FirestoreReadStats;
  cache: { entries: number; collections: number };
};

/**
 * How long a read result may be served from the in-memory micro-cache.
 * Deliberately short: the goal is to collapse the burst of identical reads that
 * happens when several components mount together, not to be a data layer cache.
 */
const READ_CACHE_TTL_MS = 15_000;

/**
 * Collections that are written EXCLUSIVELY through `FirestoreService` are safe
 * to serve from the micro-cache. Collections that are written through direct SDK
 * calls (`setDoc`/`updateDoc`/`deleteDoc`/`writeBatch`/`runTransaction`) bypass
 * the invalidation done below, so caching them could return stale data right
 * after a write. A real example: `DailyClosingsService.saveClosing()` writes the
 * `cierres` document inside a transaction and immediately re-reads it to verify
 * the save — serving that read from cache would make the verification fail.
 *
 * Those collections still get in-flight de-duplication, which is always safe
 * because it only shares a single network read among concurrent callers.
 *
 * To add a collection here, first confirm every write to it goes through this
 * service (search for `setDoc(`, `updateDoc(`, `writeBatch(` and
 * `runTransaction(` against the collection name).
 */
const MICRO_CACHE_COLLECTIONS = new Set<string>([
  "empresas",
  "users",
  "sorteos",
  "empleados",
  "payroll-records",
  "calculohoras",
  "ccss-config",
  "ordenes",
]);

const isMicroCacheSafe = (collectionName: string): boolean =>
  MICRO_CACHE_COLLECTIONS.has(collectionName) ||
  (collectionName.startsWith("productos/") &&
    collectionName.endsWith("/items"));

const isDevEnvironment = process.env.NODE_ENV !== "production";

const emptyReadStats = (): FirestoreReadStats => ({
  getById: 0,
  query: 0,
  getAll: 0,
  cacheHits: 0,
  inFlightDedup: 0,
});

/**
 * Callers of this service expect freshly deserialized objects on every read
 * (the previous implementation rebuilt them from `doc.data()` each time).
 * Both the cache and the in-flight de-duplication hand out shallow copies so a
 * caller can safely mutate/sort the returned array or its top-level entries.
 */
const cloneArrayOfRecords = <T>(value: T): T => {
  if (!Array.isArray(value)) return value;
  return value.map((row) =>
    row && typeof row === "object"
      ? { ...(row as Record<string, unknown>) }
      : row,
  ) as unknown as T;
};

const cloneSingleRecord = <T>(value: T): T => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return { ...(value as Record<string, unknown>) } as unknown as T;
};

/** Only primitive (or nested primitive) values are safe to serialize into a cache key. */
const isSerializableKeyPart = (value: unknown): boolean => {
  if (value === null) return true;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") return true;
  if (Array.isArray(value)) return value.every(isSerializableKeyPart);
  if (type === "object") {
    return Object.values(value as Record<string, unknown>).every(
      isSerializableKeyPart,
    );
  }
  return false;
};

export class FirestoreService {
  private static readCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();
  private static inFlightReads = new Map<string, Promise<unknown>>();
  private static collectionGenerations = new Map<string, number>();
  private static statsByCollection = new Map<string, FirestoreReadStats>();
  private static statsTotals: FirestoreReadStats = emptyReadStats();
  private static devStatsExposed = false;

  // Remove undefined values recursively from an object or array
  // This prevents Firestore errors when a field value is undefined
  private static sanitizeForFirestore(value: unknown): unknown {
    if (value === null) return null;
    // Preserve Date objects (and other objects that should not be traversed)
    if (value instanceof Date) return value;
    if (Array.isArray(value)) {
      return (value as unknown[])
        .map((item) => this.sanitizeForFirestore(item))
        .filter((item) => item !== undefined);
    }
    if (typeof value === "object" && value !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined) continue;
        const sanitized = this.sanitizeForFirestore(v);
        if (sanitized !== undefined) out[k] = sanitized as unknown;
      }
      return out;
    }
    return value;
  }

  // ---------------------------------------------------------------------------
  // Read cache / de-duplication helpers
  // ---------------------------------------------------------------------------

  private static buildReadKey(
    collectionName: string,
    operation: FirestoreReadOperation,
    keyParts: unknown,
  ): string | null {
    try {
      if (!isSerializableKeyPart(keyParts)) return null;
      const generation = this.collectionGenerations.get(collectionName) ?? 0;
      return `${collectionName}::${operation}::${generation}::${JSON.stringify(
        keyParts,
      )}`;
    } catch {
      return null;
    }
  }

  /**
   * Bumps the collection generation and drops its cache entries. The generation
   * is part of every cache key, so reads already in flight when a write lands
   * are never reused by readers that start after the write.
   */
  private static invalidateCollection(collectionName: string): void {
    this.collectionGenerations.set(
      collectionName,
      (this.collectionGenerations.get(collectionName) ?? 0) + 1,
    );
    const prefix = `${collectionName}::`;
    for (const key of Array.from(this.readCache.keys())) {
      if (key.startsWith(prefix)) this.readCache.delete(key);
    }
  }

  private static pruneExpiredCacheEntries(now: number): void {
    // Opportunistic cleanup; entries normally expire within the TTL window.
    if (this.readCache.size <= 256) return;
    for (const [key, entry] of Array.from(this.readCache.entries())) {
      if (entry.expiresAt <= now) this.readCache.delete(key);
    }
  }

  /**
   * Shared read path.
   * - Concurrent identical reads (same collection/operation/constraints) share
   *   one network request.
   * - When `allowCache` is true and the collection is micro-cache safe, the
   *   result is served from a short-lived cache until invalidated by a write.
   * - Every caller receives its own shallow copy.
   * - Any internal failure degrades silently to the real read.
   */
  private static readThroughCache<T>(
    operation: FirestoreReadOperation,
    collectionName: string,
    keyParts: unknown,
    loader: () => Promise<T>,
    clone: (value: T) => T,
    options: { allowCache: boolean },
  ): Promise<T> {
    this.recordReadStats(collectionName, operation);

    // The micro-cache is browser-only: on the server this module is a process
    // singleton shared across requests (and users), so a cached read could leak
    // or serve stale data across requests. In-flight sharing is still safe.
    const allowCache =
      options.allowCache &&
      typeof window !== "undefined" &&
      isMicroCacheSafe(collectionName);
    const key = this.buildReadKey(collectionName, operation, keyParts);
    const now = Date.now();

    if (key) {
      if (allowCache) {
        this.pruneExpiredCacheEntries(now);
        const cached = this.readCache.get(key);
        if (cached) {
          if (cached.expiresAt > now) {
            this.recordCacheHit(collectionName);
            return Promise.resolve(clone(cached.value as T));
          }
          this.readCache.delete(key);
        }
      }

      const pending = this.inFlightReads.get(key);
      if (pending) {
        this.recordInFlightDedup(collectionName);
        return pending.then((value) => clone(value as T));
      }
    }

    const generation = this.collectionGenerations.get(collectionName) ?? 0;
    const load = (async () => {
      const value = await loader();
      if (
        key &&
        allowCache &&
        (this.collectionGenerations.get(collectionName) ?? 0) === generation
      ) {
        this.readCache.set(key, {
          expiresAt: Date.now() + READ_CACHE_TTL_MS,
          value,
        });
      }
      return value;
    })();

    if (key) {
      this.inFlightReads.set(key, load);
      const settle = () => {
        if (this.inFlightReads.get(key) === load) this.inFlightReads.delete(key);
      };
      // Swallow bookkeeping rejections here; the caller still gets the error.
      load.then(settle, settle);
    }

    return load.then((value) => clone(value as T));
  }

  // ---------------------------------------------------------------------------
  // Dev-only read stats (exposed at window.__firestoreStats)
  // ---------------------------------------------------------------------------

  private static recordReadStats(
    collectionName: string,
    operation: FirestoreReadOperation,
  ): void {
    if (!isDevEnvironment) return;
    const bucket = this.statsByCollection.get(collectionName) ?? emptyReadStats();
    bucket[operation] += 1;
    this.statsByCollection.set(collectionName, bucket);
    this.statsTotals[operation] += 1;
    if (!this.devStatsExposed) this.exposeDevStats();
  }

  private static recordCacheHit(collectionName: string): void {
    if (!isDevEnvironment) return;
    const bucket = this.statsByCollection.get(collectionName);
    if (bucket) bucket.cacheHits += 1;
    this.statsTotals.cacheHits += 1;
  }

  private static recordInFlightDedup(collectionName: string): void {
    if (!isDevEnvironment) return;
    const bucket = this.statsByCollection.get(collectionName);
    if (bucket) bucket.inFlightDedup += 1;
    this.statsTotals.inFlightDedup += 1;
  }

  private static exposeDevStats(): void {
    if (!isDevEnvironment || typeof window === "undefined") return;
    this.devStatsExposed = true;
    try {
      Object.defineProperty(window, "__firestoreStats", {
        configurable: true,
        enumerable: false,
        get: () => FirestoreService.getReadStats(),
      });
    } catch {
      (window as unknown as Record<string, unknown>).__firestoreStats =
        this.getReadStats();
    }
  }

  /** Snapshot of read counters. Empty in production. */
  static getReadStats(): FirestoreStatsSnapshot {
    const readsByCollection: Record<string, FirestoreReadStats> = {};
    this.statsByCollection.forEach((bucket, collectionName) => {
      readsByCollection[collectionName] = { ...bucket };
    });
    return {
      readsByCollection,
      totals: { ...this.statsTotals },
      cache: {
        entries: this.readCache.size,
        collections: this.statsByCollection.size,
      },
    };
  }

  /** Resets the dev read counters (no-op in production). */
  static resetReadStats(): void {
    this.statsByCollection.clear();
    this.statsTotals = emptyReadStats();
  }

  /**
   * Get all documents from a collection
   */
  static async getAll(
    collectionName: string,
    limitCount?: number,
  ): Promise<any[]> {
    try {
      const normalizedLimit =
        typeof limitCount === "number" && Number.isFinite(limitCount)
          ? Math.max(1, Math.trunc(limitCount))
          : null;
      return await this.readThroughCache<any[]>(
        "getAll",
        collectionName,
        { limit: normalizedLimit },
        async () => {
          const colRef = collection(db, collectionName);
          const querySnapshot =
            normalizedLimit !== null
              ? await getDocs(query(colRef, limit(normalizedLimit)))
              : await getDocs(colRef);
          return querySnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
        },
        cloneArrayOfRecords,
        { allowCache: false },
      );
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }
  /**
   * Get a single document by ID
   */
  static async getById(
    collectionName: string,
    id: string,
  ): Promise<any | null> {
    try {
      return await this.readThroughCache<any | null>(
        "getById",
        collectionName,
        { id },
        async () => {
          const docRef = doc(db, collectionName, id);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            return {
              id: docSnap.id,
              ...docSnap.data(),
            };
          } else {
            return null;
          }
        },
        cloneSingleRecord,
        { allowCache: true },
      );
    } catch (error) {
      console.error(
        `Error getting document ${id} from ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add a new document to a collection
   */
  static async add(collectionName: string, data: any): Promise<string> {
    try {
      const safeData = this.sanitizeForFirestore(data) as Record<
        string,
        unknown
      >;
      // Allow passing through sanitized record to Firestore SDK; safeData is validated above
      const docRef = await addDoc(
        collection(db, collectionName),
        safeData as any,
      );
      this.invalidateCollection(collectionName);
      return docRef.id;
    } catch (error) {
      console.error(`Error adding document to ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Add a new document with a specific ID to a collection
   */
  static async addWithId(
    collectionName: string,
    id: string,
    data: any,
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      const safeData = this.sanitizeForFirestore(data) as Record<
        string,
        unknown
      >;
      await setDoc(docRef, safeData as any);
      this.invalidateCollection(collectionName);
    } catch (error) {
      console.error(`Error adding document ${id} to ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update a document by ID
   */
  static async update(
    collectionName: string,
    id: string,
    data: any,
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      const safeData = this.sanitizeForFirestore(data) as Record<
        string,
        unknown
      >;
      await updateDoc(docRef, safeData as any);
      this.invalidateCollection(collectionName);
    } catch (error) {
      console.error(
        `Error updating document ${id} in ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete a document by ID
   */
  static async delete(collectionName: string, id: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      this.invalidateCollection(collectionName);
    } catch (error) {
      console.error(
        `Error deleting document ${id} from ${collectionName}:`,
        error,
      );
      throw error;
    }
  } /**
   * Query documents with conditions
   */
  static async query(
    collectionName: string,
    conditions: Array<{ field: string; operator: any; value: any }> = [],
    orderByField?: string,
    orderDirection: "asc" | "desc" = "asc",
    limitCount?: number,
  ): Promise<any[]> {
    try {
      // eslint-disable-next-line prefer-const
      let q = collection(db, collectionName);

      // Apply where conditions
      const constraints: QueryConstraint[] = [];
      conditions.forEach((condition) => {
        constraints.push(
          where(condition.field, condition.operator, condition.value),
        );
      });

      // Apply order by
      if (orderByField) {
        constraints.push(orderBy(orderByField, orderDirection));
      }

      // Apply limit
      if (limitCount) {
        constraints.push(limit(limitCount));
      }

      return await this.readThroughCache<any[]>(
        "query",
        collectionName,
        {
          conditions,
          orderByField: orderByField ?? null,
          orderDirection,
          limit: limitCount ?? null,
        },
        async () => {
          const queryRef = query(q, ...constraints);
          const querySnapshot = await getDocs(queryRef);

          return querySnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
        },
        cloneArrayOfRecords,
        { allowCache: true },
      );
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Check if a document exists
   */
  static async exists(collectionName: string, id: string): Promise<boolean> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error(
        `Error checking if document ${id} exists in ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get documents count in a collection
   */
  static async count(collectionName: string): Promise<number> {
    try {
      const snapshot = await getCountFromServer(collection(db, collectionName));
      return snapshot.data().count;
    } catch (error) {
      console.error(`Error counting documents in ${collectionName}:`, error);
      throw error;
    }
  }
}
