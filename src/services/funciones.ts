import { FirestoreService } from './firestore';

export type FuncionGeneralDoc = {
  type: 'general';
  ownerId: string;
  funcionId: string;
  nombre: string;
  descripcion?: string;
  /**
   * Audience/scope for the function definition.
   * - DELIFOOD: only visible/assignable to empresaId === 'DELIFOOD'
   * - DELIKOR: visible to all other empresas with the same ownerId (unless empresaIds restricts it)
   */
  audience?: 'DELIKOR' | 'DELIFOOD';
  /** Optional restriction for DELIKOR functions: if present, only these empresaIds can see/assign it. */
  empresaIds?: string[];
  // Optional reminder time in Costa Rica local time (HH:mm)
  reminderTimeCr?: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
};

export type FuncionesEmpresaDoc = {
  type: 'empresa';
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

export type FuncionAudience = 'DELIKOR' | 'DELIFOOD';

export const DELIFOOD_EMPRESA_ID = 'DELIFOOD';

export function isDelifoodEmpresaId(empresaId: string): boolean {
  return String(empresaId || '').trim().toUpperCase() === DELIFOOD_EMPRESA_ID;
}

function normalizeAudience(raw: unknown): FuncionAudience {
  const v = String(raw || '').trim().toUpperCase();
  return v === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR';
}

function normalizeEmpresaIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set(
    raw
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((x) => x.toUpperCase())
  );
  // Never allow scoping to DELIFOOD from the DELIKOR path.
  unique.delete(DELIFOOD_EMPRESA_ID);
  return Array.from(unique.values());
}

export function filterFuncionesGeneralesForEmpresa<T extends { ownerId?: unknown; audience?: unknown; empresaIds?: unknown }>(
  generalDocs: T[],
  params: { ownerId: string; empresaId: string }
): T[] {
  const ownerId = String(params.ownerId || '').trim();
  const empresaId = String(params.empresaId || '').trim();
  if (!empresaId) return [];

  const delifoodEmpresa = isDelifoodEmpresaId(empresaId);

  return (generalDocs || []).filter((d) => {
    if (!d) return false;
    const docOwnerId = String((d as any).ownerId || '').trim();
    if (ownerId && docOwnerId && docOwnerId !== ownerId) return false;

    const audience = normalizeAudience((d as any).audience);
    if (delifoodEmpresa) {
      return audience === 'DELIFOOD';
    }

    if (audience === 'DELIFOOD') return false;

    const empresaIds = normalizeEmpresaIds((d as any).empresaIds);
    if (empresaIds.length === 0) return true;
    return empresaIds.includes(String(empresaId).trim().toUpperCase());
  });
}

const normalizeDocIdPart = (raw: string): string => {
  const base = String(raw || '')
    .trim()
    .replaceAll('/', '-')
    .replaceAll('\\', '-')
    .replace(/\s+/g, '_');

  const safe = base
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return safe.slice(0, 160) || 'funcion';
};

export class FuncionesService {
  private static readonly COLLECTION_NAME = 'funciones';

  static formatNumericFuncionId(value: number, padLength = 4): string {
    const safe = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    return String(safe).padStart(Math.max(1, Math.trunc(padLength)), '0');
  }

  static async getNextNumericFuncionId(params: { ownerId: string; padLength?: number }): Promise<string> {
    const ownerId = String(params.ownerId || '').trim();
    if (!ownerId) throw new Error('ownerId requerido para generar funcionId.');

    const all = await FirestoreService.getAll(this.COLLECTION_NAME);
    const docs = (Array.isArray(all) ? all : []) as Array<any>;

    const generalForOwner = docs.filter((d) => {
      if (!d) return false;
      const isGeneral = d.type === 'general' || (d.funcionId && d.nombre && !d.empresaId);
      if (!isGeneral) return false;
      return String(d.ownerId || '').trim() === ownerId;
    });

    let max = -1;
    for (const d of generalForOwner) {
      const raw = String(d.funcionId || '').trim();
      if (!/^[0-9]+$/.test(raw)) continue;
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }

    const next = max + 1;
    return this.formatNumericFuncionId(next, params.padLength ?? 4);
  }

  static buildFuncionDocId(funcionId: string, nombre: string): string {
    return `${String(funcionId).trim()}_${normalizeDocIdPart(nombre)}`;
  }

  static async listFuncionesGeneralesAs(actor: {
    ownerIds: string[];
    role?: string;
  }): Promise<Array<{ docId: string } & FuncionGeneralDoc>> {
    const all = await FirestoreService.getAll(this.COLLECTION_NAME);
    const docs = (Array.isArray(all) ? all : []) as Array<any>;

    const general = docs.filter((d) => d && (d.type === 'general' || (d.funcionId && d.nombre && !d.empresaId)));

    const role = String(actor.role || '').trim().toLowerCase();
    if (role === 'superadmin' || role === 'admin') {
      return general.map((d) => ({ docId: String(d.id), ...(d as FuncionGeneralDoc) }));
    }

    const allowed = new Set((actor.ownerIds || []).map((x) => String(x)));
    return general
      .filter((d) => {
        const ownerId = String(d.ownerId || '');
        if (!ownerId) return false;
        if (allowed.size === 0) return true;
        return allowed.has(ownerId);
      })
      .map((d) => ({ docId: String(d.id), ...(d as FuncionGeneralDoc) }));
  }

  static async upsertFuncionGeneral(params: {
    previousDocId?: string | null;
    ownerId: string;
    funcionId: string;
    nombre: string;
    descripcion?: string;
    reminderTimeCr?: string;
    audience?: FuncionAudience;
    empresaIds?: string[];
    createdAt?: string;
  }): Promise<{ docId: string } & FuncionGeneralDoc> {
    const nowIso = new Date().toISOString();
    const createdAt = params.createdAt || nowIso;

    const audience = normalizeAudience(params.audience);
    const empresaIds = audience === 'DELIKOR' ? normalizeEmpresaIds(params.empresaIds) : [];

    const doc: FuncionGeneralDoc = {
      type: 'general',
      ownerId: String(params.ownerId || '').trim(),
      funcionId: String(params.funcionId || '').trim(),
      nombre: String(params.nombre || '').trim(),
      descripcion: params.descripcion ? String(params.descripcion).trim() : '',
      reminderTimeCr: params.reminderTimeCr ? String(params.reminderTimeCr).trim() : undefined,
      audience,
      empresaIds: empresaIds.length > 0 ? empresaIds : undefined,
      createdAt,
      updatedAt: nowIso,
    };

    const nextDocId = this.buildFuncionDocId(doc.funcionId, doc.nombre);

    // If renaming changed docId, create new doc and delete old.
    const prevDocId = params.previousDocId ? String(params.previousDocId) : '';
    if (prevDocId && prevDocId !== nextDocId) {
      await FirestoreService.addWithId(this.COLLECTION_NAME, nextDocId, doc);
      await FirestoreService.delete(this.COLLECTION_NAME, prevDocId);
      return { docId: nextDocId, ...doc };
    }

    // If doc exists, update; otherwise set.
    // IMPORTANT: overwrite the entire doc so fields removed in the UI (e.g. empresaIds)
    // are actually deleted in Firestore. updateDoc() would keep old fields.
    await FirestoreService.addWithId(this.COLLECTION_NAME, nextDocId, doc);

    return { docId: nextDocId, ...doc };
  }

  static async deleteFuncionGeneral(docId: string): Promise<void> {
    await FirestoreService.delete(this.COLLECTION_NAME, docId);
  }

  static async ensureEmpresaDoc(params: {
    ownerId: string;
    empresaId: string;
  }): Promise<void> {
    const empresaId = String(params.empresaId || '').trim();
    if (!empresaId) return;

    const existing = await FirestoreService.getById(this.COLLECTION_NAME, empresaId);
    if (existing) return;

    const doc: FuncionesEmpresaDoc = {
      type: 'empresa',
      ownerId: String(params.ownerId || '').trim(),
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
    const empresaId = String(params.empresaId || '').trim();
    if (!empresaId) return null;

    const doc = await FirestoreService.getById(this.COLLECTION_NAME, empresaId);
    if (!doc) return null;

    if (doc.type !== 'empresa') {
      throw new Error('El documento de funciones por empresa no es válido (type != empresa).');
    }

    const typed = doc as FuncionesEmpresaDoc;
    const funciones = Array.isArray((typed as any).funciones)
      ? (typed as any).funciones.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];

    return {
      docId: empresaId,
      ...typed,
      mode: 0,
      funciones,
    };
  }

  static async upsertEmpresaFunciones(params: {
    ownerId: string;
    empresaId: string;
    funciones: string[];
  }): Promise<void> {
    const ownerId = String(params.ownerId || '').trim();
    const empresaId = String(params.empresaId || '').trim();
    if (!ownerId) throw new Error('ownerId requerido para guardar funciones por empresa.');
    if (!empresaId) throw new Error('empresaId requerido para guardar funciones por empresa.');

    await this.ensureEmpresaDoc({ ownerId, empresaId });

    const existing = await FirestoreService.getById(this.COLLECTION_NAME, empresaId);
    if (existing && existing.type !== 'empresa') {
      throw new Error('No se puede guardar: el docId de empresa colisiona con otro tipo de documento.');
    }

    const funciones = Array.from(
      new Set((params.funciones || []).map((x) => String(x).trim()).filter(Boolean))
    );

    // Overwrite the doc to keep a single source of truth.
    const nextDoc: FuncionesEmpresaDoc = {
      type: 'empresa',
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
    const funcionId = String(params.funcionId || '').trim();
    if (!funcionId) return;

     const removalKeys = new Set(getFuncionIdLookupKeys(funcionId));
     // Also remove exact raw value just in case.
     removalKeys.add(funcionId);

    const empresaIds = Array.from(new Set((params.empresaIds || []).map((x) => String(x).trim()).filter(Boolean)));
    await Promise.all(
      empresaIds.map(async (empresaId) => {
        const doc = await FirestoreService.getById(this.COLLECTION_NAME, empresaId);
        if (!doc) return;
        if (doc.type !== 'empresa') return;

        const currentFuncionesRaw = Array.isArray((doc as any).funciones)
          ? ((doc as any).funciones as unknown[]).map((x) => String(x).trim()).filter(Boolean)
          : [];

        const nextFunciones = currentFuncionesRaw.filter((x) => !removalKeys.has(String(x)));

        const changed = nextFunciones.length !== currentFuncionesRaw.length;
        if (!changed) return;

        // Overwrite doc.
        const nextDoc: FuncionesEmpresaDoc = {
          type: 'empresa',
          ownerId: String(doc.ownerId || params.ownerId || '').trim(),
          empresaId: String(doc.empresaId || empresaId).trim(),
          mode: 0,
          funciones: nextFunciones,
          updatedAt: new Date().toISOString(),
        };

        await FirestoreService.addWithId(this.COLLECTION_NAME, empresaId, nextDoc);
      })
    );
  }
}

export function getFuncionIdLookupKeys(rawFuncionId: string): string[] {
  const base = String(rawFuncionId || '').trim();
  if (!base) return [];

  const keys: string[] = [];
  const add = (k: string) => {
    const kk = String(k || '').trim();
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
  rawFuncionId: string
): T | undefined {
  const raw = String(rawFuncionId || '').trim();
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
  if (raw.includes('_')) {
    const prefix = raw.split('_')[0]?.trim();
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
