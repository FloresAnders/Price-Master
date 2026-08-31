import { FirestoreService } from "./firestore";
import { UsersService } from "./users";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/config/firebase";

export type FuncionGeneralDoc = {
  type: "general";
  ownerId: string;
  funcionId: string;
  nombre: string;
  descripcion?: string;
  /**
   * Audience/scope for the function definition.
   * - DELIFOOD: only visible/assignable to empresaId === 'DELIFOOD'
   * - DELIKOR: visible to all other empresas with the same ownerId (unless empresaIds restricts it)
   */
  audience?: "DELIKOR" | "DELIFOOD";
  /** Optional restriction for DELIKOR functions: if present, only these empresaIds can see/assign it. */
  empresaIds?: string[];
  // Optional reminder time in Costa Rica local time (HH:mm)
  reminderTimeCr?: string;
  reminderTimesCr?: string[];
  blockOnReminder?: boolean;
  blockSeconds?: number;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
};

export type FuncionesEmpresaDoc = {
  type: "empresa";
  ownerId: string;
  empresaId: string;
  /**
   * Current schema mode for empresa assignments.
   * 0 = single list (`funciones`) without apertura/cierre split.
   */
  mode?: 0;
  /** Single list of function ids assigned to the empresa. */
  funciones?: string[];
  updatedAt?: string; // ISO
};

export type FuncionAudience = "DELIKOR" | "DELIFOOD";

export const DELIFOOD_EMPRESA_ID = "DELIFOOD";
const SHARED_FUNCIONES_COLLECTION = "funciones";
const OWNER_FUNCIONES_COLLECTION = "funcionesByOwner";
const OWNER_FUNCIONES_SUBCOLLECTION = "generales";

export function isDelifoodEmpresaId(empresaId: string): boolean {
  return (
    String(empresaId || "")
      .trim()
      .toUpperCase() === DELIFOOD_EMPRESA_ID
  );
}

function normalizeAudience(raw: unknown): FuncionAudience {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  return v === "DELIFOOD" ? "DELIFOOD" : "DELIKOR";
}

function normalizeEmpresaIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set(
    raw
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((x) => x.toUpperCase()),
  );
  // Never allow scoping to DELIFOOD from the DELIKOR path.
  unique.delete(DELIFOOD_EMPRESA_ID);
  return Array.from(unique.values());
}

function normalizeOwnerCollectionSegment(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[\\/#?\[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function isNumericFuncionId(value: unknown): boolean {
  return /^\d+$/.test(String(value || "").trim());
}

function getFuncionIdPrefixFromDocId(value: unknown): string {
  return String(value || "")
    .trim()
    .split("_")[0]
    ?.trim() || "";
}

function isNumericFuncionDocId(value: unknown): boolean {
  const raw = String(value || "").trim();
  if (isNumericFuncionId(raw)) return true;
  return isNumericFuncionId(getFuncionIdPrefixFromDocId(raw));
}

function isGeneralFuncionDoc(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const d = raw as Record<string, unknown>;
  return (
    d.type === "general" ||
    Boolean(d.funcionId && d.nombre && !d.empresaId)
  );
}

function isSharedSpecialFuncionDoc(raw: unknown): boolean {
  if (!isGeneralFuncionDoc(raw)) return false;
  const d = raw as Record<string, unknown>;
  return !isNumericFuncionId(d.funcionId);
}

function isOwnedNumericFuncionDoc(raw: unknown): boolean {
  if (!isGeneralFuncionDoc(raw)) return false;
  const d = raw as Record<string, unknown>;
  return isNumericFuncionId(d.funcionId);
}

function getDocTimestampMs(raw: unknown, field: "updatedAt" | "createdAt"): number {
  if (!raw || typeof raw !== "object") return Number.NEGATIVE_INFINITY;
  const value = String((raw as Record<string, unknown>)[field] || "").trim();
  if (!value) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

function compareFuncionGeneralDocPreference(a: any, b: any): number {
  const updatedDiff = getDocTimestampMs(a, "updatedAt") - getDocTimestampMs(b, "updatedAt");
  if (updatedDiff !== 0) return updatedDiff;

  const createdDiff = getDocTimestampMs(a, "createdAt") - getDocTimestampMs(b, "createdAt");
  if (createdDiff !== 0) return createdDiff;

  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function filterFuncionesGeneralesForEmpresa<
  T extends { ownerId?: unknown; audience?: unknown; empresaIds?: unknown },
>(generalDocs: T[], params: { ownerId: string; empresaId: string }): T[] {
  const ownerId = String(params.ownerId || "").trim();
  const empresaId = String(params.empresaId || "").trim();
  if (!empresaId) return [];

  const delifoodEmpresa = isDelifoodEmpresaId(empresaId);

  return (generalDocs || []).filter((d) => {
    if (!d) return false;
    const docOwnerId = String((d as any).ownerId || "").trim();
    if (ownerId && docOwnerId && docOwnerId !== ownerId) return false;

    const audience = normalizeAudience((d as any).audience);
    if (delifoodEmpresa) {
      return audience === "DELIFOOD";
    }

    if (audience === "DELIFOOD") return false;

    const empresaIds = normalizeEmpresaIds((d as any).empresaIds);
    if (empresaIds.length === 0) return true;
    return empresaIds.includes(String(empresaId).trim().toUpperCase());
  });
}

const normalizeDocIdPart = (raw: string): string => {
  const base = String(raw || "")
    .trim()
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replace(/\s+/g, "_");

  const safe = base
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe.slice(0, 160) || "funcion";
};

export class FuncionesService {
  private static readonly COLLECTION_NAME = SHARED_FUNCIONES_COLLECTION;
  private static readonly CACHE_TTL_MS = 30_000;
  private static funcionesGeneralCache = new Map<string, {
    expiresAt: number;
    data: Array<{ docId: string } & FuncionGeneralDoc>;
  }>();
  private static funcionesEmpresaCache: Map<string, { expiresAt: number; data: ({ docId: string } & FuncionesEmpresaDoc) | null }> = new Map();

  private static async resolveOwnerCollectionId(ownerId: string): Promise<string> {
    const normalizedOwnerId = String(ownerId || "").trim();
    if (!normalizedOwnerId) {
      throw new Error("ownerId requerido para funciones por owner.");
    }

    try {
      const admin = await UsersService.getPrimaryAdminByOwner(normalizedOwnerId);
      const fullName =
        typeof admin?.fullName === "string"
          ? admin.fullName.trim()
          : typeof admin?.name === "string"
            ? admin.name.trim()
            : "";

      return normalizeOwnerCollectionSegment(fullName || normalizedOwnerId);
    } catch (error) {
      console.warn("[FuncionesService] Error resolving owner collection id:", error);
      return normalizeOwnerCollectionSegment(normalizedOwnerId);
    }
  }

  static async getOwnerGeneralCollectionPath(ownerId: string): Promise<{
    ownerCollectionId: string;
    collectionName: string;
  }> {
    const ownerCollectionId = await this.resolveOwnerCollectionId(ownerId);
    return {
      ownerCollectionId,
      collectionName: `${OWNER_FUNCIONES_COLLECTION}/${ownerCollectionId}/${OWNER_FUNCIONES_SUBCOLLECTION}`,
    };
  }

  static formatNumericFuncionId(value: number, padLength = 4): string {
    const safe = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    return String(safe).padStart(Math.max(1, Math.trunc(padLength)), "0");
  }

  static async getNextNumericFuncionId(params: {
    ownerId: string;
    padLength?: number;
  }): Promise<string> {
    const ownerId = String(params.ownerId || "").trim();
    if (!ownerId) throw new Error("ownerId requerido para generar funcionId.");

    const ownerCollectionId = await this.resolveOwnerCollectionId(ownerId);
    const counterRef = doc(
      db,
      OWNER_FUNCIONES_COLLECTION,
      ownerCollectionId,
      "meta",
      "numericCounter",
    );
    const counterSnapshot = await getDoc(counterRef);
    let initialNext = 0;
    if (!counterSnapshot.exists()) {
      const all = await FirestoreService.getAll(
        `${OWNER_FUNCIONES_COLLECTION}/${ownerCollectionId}/${OWNER_FUNCIONES_SUBCOLLECTION}`,
      );
      for (const d of (Array.isArray(all) ? all : []) as Array<any>) {
        if (!isOwnedNumericFuncionDoc(d)) continue;
        if (String(d.ownerId || "").trim() !== ownerId) continue;
        const value = Number.parseInt(String(d.funcionId || ""), 10);
        if (Number.isFinite(value)) initialNext = Math.max(initialNext, value + 1);
      }
    }
    const allocated = await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(counterRef);
      const storedValue = snapshot.exists()
        ? Number(snapshot.data()?.nextValue)
        : initialNext;
      if (!Number.isSafeInteger(storedValue) || storedValue < 0) {
        throw new Error("Contador numérico de funciones inválido.");
      }
      const nextValue = storedValue;
      tx.set(counterRef, {
        nextValue: nextValue + 1,
        initialized: true,
        updatedAt: new Date().toISOString(),
      });
      return nextValue;
    });
    return this.formatNumericFuncionId(allocated, params.padLength ?? 4);
  }

  static buildFuncionDocId(funcionId: string, nombre: string): string {
    return `${String(funcionId).trim()}_${normalizeDocIdPart(nombre)}`;
  }

  static async listFuncionesGeneralesAs(actor: {
    ownerIds: string[];
    role?: string;
  }): Promise<Array<{ docId: string } & FuncionGeneralDoc>> {
    const cacheKey = `${(actor.role || "").trim().toLowerCase()}::${(actor.ownerIds || []).map((x) => String(x).trim()).filter(Boolean).sort().join("|")}`;
    const cached = this.funcionesGeneralCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data.map((doc) => ({ ...doc }));
    }

    const sharedAll = await FirestoreService.query(this.COLLECTION_NAME, [
      { field: "type", operator: "==", value: "general" },
    ]);
    const sharedDocs = (Array.isArray(sharedAll) ? sharedAll : []) as Array<any>;

    const sharedGeneral = sharedDocs.filter(isSharedSpecialFuncionDoc);

    const ownerCollections = Array.from(
      new Set((actor.ownerIds || []).map((x) => String(x).trim()).filter(Boolean)),
    );

    const ownedDocs = (
      await Promise.all(
        ownerCollections.map(async (ownerId) => {
          const ownerCollectionId = await this.resolveOwnerCollectionId(ownerId);
          const docs = await FirestoreService.getAll(
            `${OWNER_FUNCIONES_COLLECTION}/${ownerCollectionId}/${OWNER_FUNCIONES_SUBCOLLECTION}`,
          );
          return (Array.isArray(docs) ? docs : []) as Array<any>;
        }),
      )
    ).flat();

    const generalByKey = new Map<string, any>();
    for (const d of [...sharedGeneral, ...ownedDocs.filter(isOwnedNumericFuncionDoc)]) {
      const docId = String((d as any).id || "").trim();
      const ownerId = String((d as any).ownerId || "").trim();
      const funcionId = String((d as any).funcionId || "").trim();
      const key = `${ownerId}::${funcionId}`;
      if (!docId || !ownerId || !funcionId) continue;

      const current = generalByKey.get(key);
      if (!current || compareFuncionGeneralDocPreference(d, current) > 0) {
        generalByKey.set(key, d);
      }
    }

    const general = Array.from(generalByKey.values()) as Array<any>;

    const role = String(actor.role || "")
      .trim()
      .toLowerCase();
    const resolved = (role === "superadmin" || role === "admin"
      ? general
      : general.filter((d) => {
          const ownerId = String(d.ownerId || "");
          const allowed = new Set((actor.ownerIds || []).map((x) => String(x)));
          if (!ownerId) return false;
          if (allowed.size === 0) return true;
          return allowed.has(ownerId);
        })
    ).map((d) => ({ docId: String(d.id), ...(d as FuncionGeneralDoc) }));

    this.funcionesGeneralCache.set(cacheKey, {
      expiresAt: Date.now() + this.CACHE_TTL_MS,
      data: resolved,
    });

    return resolved.map((doc) => ({ ...doc }));
  }

  static async upsertFuncionGeneral(params: {
    previousDocId?: string | null;
    ownerId: string;
    funcionId: string;
    nombre: string;
    descripcion?: string;
    reminderTimeCr?: string;
    reminderTimesCr?: string[];
    blockOnReminder?: boolean;
    blockSeconds?: number;
    audience?: FuncionAudience;
    empresaIds?: string[];
    createdAt?: string;
  }): Promise<{ docId: string } & FuncionGeneralDoc> {
    const nowIso = new Date().toISOString();
    const createdAt = params.createdAt || nowIso;

    const audience = normalizeAudience(params.audience);
    const empresaIds =
      audience === "DELIKOR" ? normalizeEmpresaIds(params.empresaIds) : [];

    const reminderTimesCr = Array.from(
      new Set(
        (Array.isArray(params.reminderTimesCr)
          ? params.reminderTimesCr
          : params.reminderTimeCr
            ? [params.reminderTimeCr]
            : []
        )
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );
    const blockSeconds =
      params.blockOnReminder &&
      Number.isSafeInteger(params.blockSeconds) &&
      Number(params.blockSeconds) > 0
        ? Number(params.blockSeconds)
        : undefined;

    const doc: FuncionGeneralDoc = {
      type: "general",
      ownerId: String(params.ownerId || "").trim(),
      funcionId: String(params.funcionId || "").trim(),
      nombre: String(params.nombre || "").trim(),
      descripcion: params.descripcion ? String(params.descripcion).trim() : "",
      reminderTimeCr: reminderTimesCr[0],
      reminderTimesCr: reminderTimesCr.length > 0 ? reminderTimesCr : undefined,
      blockOnReminder: blockSeconds ? true : undefined,
      blockSeconds,
      audience,
      empresaIds: empresaIds.length > 0 ? empresaIds : undefined,
      createdAt,
      updatedAt: nowIso,
    };

    const nextDocId = this.buildFuncionDocId(doc.funcionId, doc.nombre);
    const ownerCollectionId = await this.resolveOwnerCollectionId(doc.ownerId);
    const isNumeric = isNumericFuncionId(doc.funcionId);
    const targetCollection = isNumeric
      ? `${OWNER_FUNCIONES_COLLECTION}/${ownerCollectionId}/${OWNER_FUNCIONES_SUBCOLLECTION}`
      : this.COLLECTION_NAME;

    // If renaming changed docId, create new doc and delete old.
    const prevDocId = params.previousDocId ? String(params.previousDocId) : "";
    if (prevDocId && prevDocId !== nextDocId) {
      const sourceCollection = isNumericFuncionDocId(prevDocId)
        ? `${OWNER_FUNCIONES_COLLECTION}/${ownerCollectionId}/${OWNER_FUNCIONES_SUBCOLLECTION}`
        : this.COLLECTION_NAME;
      await FirestoreService.addWithId(targetCollection, nextDocId, doc);
      await FirestoreService.delete(sourceCollection, prevDocId);
      return { docId: nextDocId, ...doc };
    }

    // If doc exists, update; otherwise set.
    // IMPORTANT: overwrite the entire doc so fields removed in the UI (e.g. empresaIds)
    // are actually deleted in Firestore. updateDoc() would keep old fields.
    await FirestoreService.addWithId(targetCollection, nextDocId, doc);

    return { docId: nextDocId, ...doc };
  }

  static async deleteFuncionGeneral(
    docId: string,
    ownerId: string,
  ): Promise<void> {
    const ownerCollectionId = await this.resolveOwnerCollectionId(ownerId);
    const isNumeric = isNumericFuncionDocId(docId);
    const targetCollection = isNumeric
      ? `${OWNER_FUNCIONES_COLLECTION}/${ownerCollectionId}/${OWNER_FUNCIONES_SUBCOLLECTION}`
      : this.COLLECTION_NAME;
    await FirestoreService.delete(targetCollection, docId);
  }

  static async ensureEmpresaDoc(params: {
    ownerId: string;
    empresaId: string;
  }): Promise<void> {
    const empresaId = String(params.empresaId || "").trim();
    if (!empresaId) return;

    const existing = await FirestoreService.getById(
      this.COLLECTION_NAME,
      empresaId,
    );
    if (existing) return;

    const doc: FuncionesEmpresaDoc = {
      type: "empresa",
      ownerId: String(params.ownerId || "").trim(),
      empresaId,
      mode: 0,
      funciones: [],
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.addWithId(this.COLLECTION_NAME, empresaId, doc);
  }

  static async getEmpresaFunciones(params: {
    empresaId: string;
  }): Promise<({ docId: string } & FuncionesEmpresaDoc) | null> {
    const empresaId = String(params.empresaId || "").trim();
    if (!empresaId) return null;

    const cached = this.funcionesEmpresaCache.get(empresaId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data ? { ...cached.data } : null;
    }

    const doc = await FirestoreService.getById(this.COLLECTION_NAME, empresaId);
    if (!doc) return null;

    if (doc.type !== "empresa") {
      throw new Error(
        "El documento de funciones por empresa no es válido (type != empresa).",
      );
    }

    const typed = doc as FuncionesEmpresaDoc;
    const funciones = Array.isArray((typed as any).funciones)
      ? (typed as any).funciones
          .map((x: unknown) => String(x).trim())
          .filter(Boolean)
      : [];

    const result: ({ docId: string } & FuncionesEmpresaDoc) = {
      docId: empresaId,
      ...typed,
      mode: 0,
      funciones,
    };

    this.funcionesEmpresaCache.set(empresaId, {
      expiresAt: Date.now() + this.CACHE_TTL_MS,
      data: result,
    });

    return result;
  }

  static async upsertEmpresaFunciones(params: {
    ownerId: string;
    empresaId: string;
    funciones: string[];
  }): Promise<void> {
    const ownerId = String(params.ownerId || "").trim();
    const empresaId = String(params.empresaId || "").trim();
    if (!ownerId)
      throw new Error("ownerId requerido para guardar funciones por empresa.");
    if (!empresaId)
      throw new Error(
        "empresaId requerido para guardar funciones por empresa.",
      );

    await this.ensureEmpresaDoc({ ownerId, empresaId });

    const existing = await FirestoreService.getById(
      this.COLLECTION_NAME,
      empresaId,
    );
    if (existing && existing.type !== "empresa") {
      throw new Error(
        "No se puede guardar: el docId de empresa colisiona con otro tipo de documento.",
      );
    }

    const funciones = Array.from(
      new Set(
        (params.funciones || []).map((x) => String(x).trim()).filter(Boolean),
      ),
    );

    // Overwrite the doc to keep a single source of truth.
    const nextDoc: FuncionesEmpresaDoc = {
      type: "empresa",
      ownerId,
      empresaId,
      mode: 0,
      funciones,
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.addWithId(this.COLLECTION_NAME, empresaId, nextDoc);
  }

  static async removeFuncionFromEmpresas(params: {
    ownerId: string;
    empresaIds: string[];
    funcionId: string;
  }): Promise<void> {
    const funcionId = String(params.funcionId || "").trim();
    if (!funcionId) return;

    const removalKeys = new Set(getFuncionIdLookupKeys(funcionId));
    // Also remove exact raw value just in case.
    removalKeys.add(funcionId);

    const empresaIds = Array.from(
      new Set(
        (params.empresaIds || []).map((x) => String(x).trim()).filter(Boolean),
      ),
    );
    await Promise.all(
      empresaIds.map(async (empresaId) => {
        const doc = await FirestoreService.getById(
          this.COLLECTION_NAME,
          empresaId,
        );
        if (!doc) return;
        if (doc.type !== "empresa") return;

        const currentFuncionesRaw = Array.isArray((doc as any).funciones)
          ? ((doc as any).funciones as unknown[])
              .map((x) => String(x).trim())
              .filter(Boolean)
          : [];

        const nextFunciones = currentFuncionesRaw.filter(
          (x) => !removalKeys.has(String(x)),
        );

        const changed = nextFunciones.length !== currentFuncionesRaw.length;
        if (!changed) return;

        // Overwrite doc.
        const nextDoc: FuncionesEmpresaDoc = {
          type: "empresa",
          ownerId: String(doc.ownerId || params.ownerId || "").trim(),
          empresaId: String(doc.empresaId || empresaId).trim(),
          mode: 0,
          funciones: nextFunciones,
          updatedAt: new Date().toISOString(),
        };

        await FirestoreService.addWithId(
          this.COLLECTION_NAME,
          empresaId,
          nextDoc,
        );
      }),
    );
  }
}

export function getFuncionIdLookupKeys(rawFuncionId: string): string[] {
  const base = String(rawFuncionId || "").trim();
  if (!base) return [];

  const keys: string[] = [];
  const add = (k: string) => {
    const kk = String(k || "").trim();
    if (!kk) return;
    if (!keys.includes(kk)) keys.push(kk);
  };

  add(base);

  // Legacy: some docs store numeric ids without padding (e.g. "1") or even as numbers.
  if (/^\d+$/.test(base)) {
    const n = Number.parseInt(base, 10);
    if (Number.isFinite(n)) {
      add(String(n));
      // Common padded format used by the app.
      add(FuncionesService.formatNumericFuncionId(n, 4));
    }
  }

  return keys;
}

export function lookupGeneralByFuncionId<T>(
  generalById: Map<string, T>,
  rawFuncionId: string,
): T | undefined {
  const raw = String(rawFuncionId || "").trim();
  if (!raw) return undefined;

  // Fast path: exact match.
  const direct = generalById.get(raw);
  if (direct !== undefined) return direct;

  // Try numeric/padded variants.
  for (const key of getFuncionIdLookupKeys(raw)) {
    const v = generalById.get(key);
    if (v !== undefined) return v;
  }

  // Backward compatibility: some legacy docs may have stored the Firestore docId
  // (e.g. "0001_nombre") instead of the plain funcionId. Try prefix before "_".
  if (raw.includes("_")) {
    const prefix = raw.split("_")[0]?.trim();
    if (prefix) {
      const byPrefix = generalById.get(prefix);
      if (byPrefix !== undefined) return byPrefix;

      for (const key of getFuncionIdLookupKeys(prefix)) {
        const v = generalById.get(key);
        if (v !== undefined) return v;
      }
    }
  }

  return undefined;
}
