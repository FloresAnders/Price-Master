import { UsersService } from "./users";
import { FondoMovementTypeConfig } from "../types/firestore";
import { db } from "@/config/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  Unsubscribe,
} from "firebase/firestore";

// Keys para localStorage
const CACHE_KEY = "fondoMovementTypes_cache";
const CACHE_VERSION_KEY = "fondoMovementTypes_version";

interface FondoMovementTypesCachePayload {
  ownerId: string | null;
  scopeId: string | null;
  types: FondoMovementTypeConfig[];
}

const normalizeCachedTypes = (
  value: unknown,
): FondoMovementTypeConfig[] | null => {
  if (!Array.isArray(value)) return null;

  return value
    .filter((item): item is FondoMovementTypeConfig => Boolean(item))
    .map((item) => ({ ...item }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

// Listener global para detectar cambios en tiempo real
let globalListener: Unsubscribe | null = null;
let globalListenerKey: string | null = null;

const normalizePathSegment = (value: string): string =>
  value
    .trim()
    .replace(/[\\/#?\[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

export class FondoMovementTypesService {
  private static readonly LEGACY_COLLECTION_NAME = "fondoMovementTypes";
  private static readonly OWNER_COLLECTION_NAME = "fondoMovementTypesByOwner";
  private static readonly OWNER_SUBCOLLECTION_NAME = "types";

  private static async resolveStorageContext(ownerId?: string | null): Promise<{
    ownerId: string | null;
    scopeId: string | null;
  }> {
    const normalizedOwnerId =
      typeof ownerId === "string" ? ownerId.trim() : "";

    if (!normalizedOwnerId) {
      return { ownerId: null, scopeId: null };
    }

    try {
      const admin = await UsersService.getPrimaryAdminByOwner(normalizedOwnerId);
      const fullName =
        typeof admin?.fullName === "string"
          ? admin.fullName.trim()
          : typeof admin?.name === "string"
            ? admin.name.trim()
            : "";
      const safeOwnerId = normalizePathSegment(normalizedOwnerId);

      if (fullName) {
        const safeFullName = normalizePathSegment(fullName);
        return {
          ownerId: normalizedOwnerId,
          scopeId: `${safeFullName}`,
        };
      }

      return { ownerId: normalizedOwnerId, scopeId: safeOwnerId };
    } catch (error) {
      console.warn(
        "[FondoMovementTypes] Error resolving owner scope, using ownerId fallback:",
        error,
      );
      return { ownerId: normalizedOwnerId, scopeId: normalizePathSegment(normalizedOwnerId) };
    }
  }

  private static getCacheKey(scopeId: string | null): string {
    return scopeId ? `${CACHE_KEY}__${scopeId}` : CACHE_KEY;
  }

  private static getCacheVersionKey(scopeId: string | null): string {
    return scopeId ? `${CACHE_VERSION_KEY}__${scopeId}` : CACHE_VERSION_KEY;
  }

  private static getCollectionRef(ownerId: string | null) {
    if (!ownerId) {
      return collection(db, this.LEGACY_COLLECTION_NAME);
    }

    return collection(db, this.OWNER_COLLECTION_NAME, ownerId, this.OWNER_SUBCOLLECTION_NAME);
  }

  private static async readCollectionTypes(
    ownerId: string | null,
  ): Promise<FondoMovementTypeConfig[]> {
    if (!ownerId) return [];

    const querySnapshot = await getDocs(
      query(this.getCollectionRef(ownerId), orderBy("order", "asc")),
    );

    return querySnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as FondoMovementTypeConfig))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  private static async readTypesFromOwner(
    ownerId?: string | null,
  ): Promise<{
    types: FondoMovementTypeConfig[];
    scopeId: string | null;
    resolvedOwnerId: string | null;
  }> {
    const context = await this.resolveStorageContext(ownerId);
    return {
      types: context.scopeId ? await this.readCollectionTypes(context.scopeId) : [],
      scopeId: context.scopeId,
      resolvedOwnerId: context.ownerId,
    };
  }

  private static readCacheVersion(scopeId: string | null): number {
    if (typeof window === "undefined") return 0;

    try {
      const key = this.getCacheVersionKey(scopeId);
      const current = Number.parseInt(localStorage.getItem(key) || "0", 10);
      return Number.isFinite(current) ? current : 0;
    } catch {
      return 0;
    }
  }

  private static bumpCacheVersion(scopeId: string | null): number {
    if (typeof window === "undefined") return 0;

    try {
      const key = this.getCacheVersionKey(scopeId);
      const current = this.readCacheVersion(scopeId);
      const next = current + 1;
      localStorage.setItem(key, String(next));
      return next;
    } catch (error) {
      console.error("[FondoMovementTypes] Error updating cache version:", error);
      return 0;
    }
  }

  /**
   * Get all movement types
   */
  static async getAllMovementTypes(ownerId?: string | null): Promise<FondoMovementTypeConfig[]> {
    const result = await this.readTypesFromOwner(ownerId);
    return result.types;
  }

  /**
   * Get movement types by category
   */
  static async getMovementTypesByCategory(
    category: "INGRESO" | "GASTO" | "EGRESO",
    ownerId?: string | null,
  ): Promise<FondoMovementTypeConfig[]> {
    const allTypes = await this.getAllMovementTypes(ownerId);
    return allTypes.filter((type) => type.category === category);
  }

  /**
   * Get movement type by ID
   */
  static async getMovementTypeById(
    id: string,
    ownerId?: string | null,
  ): Promise<FondoMovementTypeConfig | null> {
    const context = await this.resolveStorageContext(ownerId);

    if (!context.scopeId) return null;

    const scopedDoc = await getDoc(
      doc(
        db,
        this.OWNER_COLLECTION_NAME,
        context.scopeId,
        this.OWNER_SUBCOLLECTION_NAME,
        id,
      ),
    );

    if (scopedDoc.exists()) {
      return { id: scopedDoc.id, ...scopedDoc.data() } as FondoMovementTypeConfig;
    }

    return null;
  }

  /**
   * Add a new movement type
   */
  static async addMovementType(
    type: Omit<FondoMovementTypeConfig, "id">,
    ownerId?: string | null,
  ): Promise<string> {
    const context = await this.resolveStorageContext(ownerId);
    const typeWithDates = {
      ...type,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!context.scopeId) {
      throw new Error("No se pudo resolver el owner para guardar tipos de movimiento de fondo.");
    }

    const docRef = await addDoc(this.getCollectionRef(context.scopeId), typeWithDates as any);
    return docRef.id;
  }

  /**
   * Update a movement type
   */
  static async updateMovementType(
    id: string,
    type: Partial<FondoMovementTypeConfig>,
    ownerId?: string | null,
  ): Promise<void> {
    const context = await this.resolveStorageContext(ownerId);
    const updateData = {
      ...type,
      updatedAt: new Date(),
    };

    if (!context.scopeId) {
      throw new Error("No se pudo resolver el owner para actualizar tipos de movimiento de fondo.");
    }

    const docRef = doc(
      db,
      this.OWNER_COLLECTION_NAME,
      context.scopeId,
      this.OWNER_SUBCOLLECTION_NAME,
      id,
    );
    await updateDoc(docRef, updateData as any);
  }

  /**
   * Delete a movement type
   */
  static async deleteMovementType(
    id: string,
    ownerId?: string | null,
  ): Promise<void> {
    const context = await this.resolveStorageContext(ownerId);

    if (!context.scopeId) {
      throw new Error("No se pudo resolver el owner para eliminar tipos de movimiento de fondo.");
    }

    const docRef = doc(
      db,
      this.OWNER_COLLECTION_NAME,
      context.scopeId,
      this.OWNER_SUBCOLLECTION_NAME,
      id,
    );
    await deleteDoc(docRef);
  }

  /**
   * Seed initial data from hardcoded constants
   */
  static async seedInitialData(ownerId?: string | null): Promise<void> {
    const existing = await this.getAllMovementTypes(ownerId);
    if (existing.length > 0) {
      console.log("Movement types already exist, skipping seed");
      return;
    }

    const FONDO_INGRESO_TYPES = ["VENTAS", "OTROS INGRESOS"];
    const FONDO_GASTO_TYPES = [
      "SALARIOS",
      "TELEFONOS",
      "CARGAS SOCIALES",
      "AGUINALDOS",
      "VACACIONES",
      "POLIZA RIESGOS DE TRABAJO",
      "PAGO TIMBRE Y EDUCACION",
      "PAGO IMPUESTOS A SOCIEDADES",
      "PATENTES MUNICIPALES",
      "ALQUILER LOCAL",
      "ELECTRICIDAD",
      "AGUA",
      "INTERNET",
      "MANTENIMIENTO INSTALACIONES",
      "PAPELERIA Y UTILES",
      "ASEO Y LIMPIEZA",
      "REDES SOCIALES",
      "MATERIALES DE EMPAQUE",
      "CONTROL PLAGAS",
      "MONITOREO DE ALARMAS",
      "FACTURA ELECTRONICA",
      "GASTOS VARIOS",
      "TRANSPORTE",
      "SERVICIOS PROFECIONALES",
      "MANTENIMIENTO MOBILIARIO Y EQUIPO",
    ];
    const FONDO_EGRESO_TYPES = [
      "EGRESOS VARIOS",
      "PAGO TIEMPOS",
      "PAGO BANCA",
      "COMPRA INVENTARIO",
      "COMPRA ACTIVOS",
      "PAGO IMPUESTO RENTA",
      "PAGO IMPUESTO IVA",
      "RETIRO EFECTIVO",
    ];

    const allTypes: Omit<FondoMovementTypeConfig, "id">[] = [];

    let order = 0;
    FONDO_INGRESO_TYPES.forEach((name) => {
      allTypes.push({ category: "INGRESO", name, order: order++ });
    });

    FONDO_GASTO_TYPES.forEach((name) => {
      allTypes.push({ category: "GASTO", name, order: order++ });
    });

    FONDO_EGRESO_TYPES.forEach((name) => {
      allTypes.push({ category: "EGRESO", name, order: order++ });
    });

    for (const type of allTypes) {
      await this.addMovementType(type, ownerId);
    }

    console.log("Movement types seeded successfully");
  }

  /**
   * Get all movement type names grouped by category
   */
  static async getMovementTypesByCategories(
    ownerId?: string | null,
  ): Promise<{
    INGRESO: string[];
    GASTO: string[];
    EGRESO: string[];
  }> {
    const allTypes = await this.getAllMovementTypes(ownerId);
    return {
      INGRESO: allTypes
        .filter((t) => t.category === "INGRESO")
        .map((t) => t.name),
      GASTO: allTypes.filter((t) => t.category === "GASTO").map((t) => t.name),
      EGRESO: allTypes
        .filter((t) => t.category === "EGRESO")
        .map((t) => t.name),
    };
  }

  /**
   * Lee los tipos desde el caché de localStorage
   */
  private static readCache(
    scopeId: string | null,
  ): FondoMovementTypesCachePayload | null {
    if (typeof window === "undefined") return null;

    try {
      const cached = localStorage.getItem(this.getCacheKey(scopeId));
      if (!cached) return null;
      const parsed = JSON.parse(cached) as unknown;

      if (Array.isArray(parsed)) {
        return {
          ownerId: null,
          scopeId,
          types: normalizeCachedTypes(parsed) || [],
        };
      }

      if (!parsed || typeof parsed !== "object") return null;

      const payload = parsed as Partial<FondoMovementTypesCachePayload> & {
        types?: unknown;
      };

      return {
        ownerId:
          typeof payload.ownerId === "string" ? payload.ownerId : null,
        scopeId:
          typeof payload.scopeId === "string"
            ? payload.scopeId
            : scopeId,
        types: normalizeCachedTypes(payload.types) || [],
      };
    } catch (error) {
      console.warn("[FondoMovementTypes] Error reading cache:", error);
    }

    return null;
  }

  /**
   * Escribe los tipos al caché de localStorage
   */
  private static writeCache(payload: FondoMovementTypesCachePayload): number {
    if (typeof window === "undefined") return 0;

    try {
      const version = this.bumpCacheVersion(payload.scopeId);
      localStorage.setItem(this.getCacheKey(payload.scopeId), JSON.stringify(payload));
      return version;
    } catch (error) {
      console.error("[FondoMovementTypes] Error writing cache:", error);
      return 0;
    }
  }

  /**
   * Inicializa el listener global de Firestore para sincronización en tiempo real
   */
  static async initializeListener(ownerId?: string | null): Promise<void> {
    const context = await this.resolveStorageContext(ownerId);
    const listenerKey = this.getCacheKey(context.scopeId);

    if (globalListener && globalListenerKey === listenerKey) {
      console.log("[FondoMovementTypes] Listener already active");
      return;
    }

    if (globalListener) {
      this.stopListener();
    }

    console.log("[FondoMovementTypes] Initializing Firestore listener...");

    const collectionRef = this.getCollectionRef(context.scopeId);
    const q = query(collectionRef, orderBy("order", "asc"));

    globalListener = onSnapshot(
      q,
      (snapshot) => {
        console.log(
          "[FondoMovementTypes] Firestore change detected, updating cache...",
        );

        const types = snapshot.docs
          .map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          } as FondoMovementTypeConfig))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const version = this.writeCache({
          ownerId: context.ownerId,
          scopeId: context.scopeId,
          types,
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("fondoMovementTypesUpdated", {
              detail: {
                types,
                version,
                ownerId: context.ownerId,
                scopeId: context.scopeId,
              },
            }),
          );
        }
      },
      (error) => {
        console.error("[FondoMovementTypes] Listener error:", error);
      },
    );

    globalListenerKey = listenerKey;
  }

  /**
   * Detiene el listener global
   */
  static stopListener(): void {
    if (globalListener) {
      console.log("[FondoMovementTypes] Stopping listener...");
      globalListener();
      globalListener = null;
      globalListenerKey = null;
    }
  }

  /**
   * Obtiene los tipos desde el caché o la base de datos
   * Esta es la función principal que deben usar los componentes
   */
  static async getTypesFromCacheOrDB(
    ownerId?: string | null,
  ): Promise<FondoMovementTypeConfig[]> {
    const context = await this.resolveStorageContext(ownerId);

    const cached = this.readCache(context.scopeId);
    if (cached && Array.isArray(cached.types)) {
      console.log("[FondoMovementTypes] Loaded from cache");
      await this.initializeListener(ownerId);
      return cached.types;
    }

    console.log("[FondoMovementTypes] Cache miss, fetching from Firestore...");
    const { types } = await this.readTypesFromOwner(ownerId);

    this.writeCache({
      ownerId: context.ownerId,
      scopeId: context.scopeId,
      types,
    });

    await this.initializeListener(ownerId);

    return types;
  }

  /**
   * Obtiene los tipos agrupados por categoría (con caché)
   */
  static async getMovementTypesByCategoriesWithCache(
    ownerId?: string | null,
  ): Promise<{
    INGRESO: string[];
    GASTO: string[];
    EGRESO: string[];
  }> {
    const types = (await this.getTypesFromCacheOrDB(ownerId)) || [];

    return {
      INGRESO: types
        .filter((t) => t.category === "INGRESO")
        .map((t) => t.name),
      GASTO: types.filter((t) => t.category === "GASTO").map((t) => t.name),
      EGRESO: types
        .filter((t) => t.category === "EGRESO")
        .map((t) => t.name),
    };
  }

  /**
   * Limpia el caché manualmente (útil para debugging)
   */
  static clearCache(ownerId?: string | null): void {
    if (typeof window === "undefined") return;

    try {
      const contextPromise = this.resolveStorageContext(ownerId);
      void contextPromise.then((context) => {
        localStorage.removeItem(this.getCacheKey(context.scopeId));
        localStorage.removeItem(this.getCacheVersionKey(context.scopeId));
        console.log("[FondoMovementTypes] Cache cleared");
      });
    } catch (error) {
      console.error("[FondoMovementTypes] Error clearing cache:", error);
    }
  }

  /**
   * Obtiene la versión actual del caché
   */
  static getCacheVersion(scopeId?: string | null): number {
    const normalizedScopeId =
      typeof scopeId === "string" && scopeId.trim().length > 0
        ? normalizePathSegment(scopeId.trim())
        : null;
    return this.readCacheVersion(normalizedScopeId);
  }
}
