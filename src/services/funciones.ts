import { FirestoreService } from './firestore';

export type FuncionGeneralDoc = {
  type: 'general';
  ownerId: string;
  funcionId: string;
  nombre: string;
  descripcion?: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
};

export type FuncionesEmpresaDoc = {
  type: 'empresa';
  ownerId: string;
  empresaId: string;
  funciones: string[];
  updatedAt?: string; // ISO
};

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

    if (actor.role === 'superadmin') {
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
    createdAt?: string;
  }): Promise<{ docId: string } & FuncionGeneralDoc> {
    const nowIso = new Date().toISOString();
    const createdAt = params.createdAt || nowIso;

    const doc: FuncionGeneralDoc = {
      type: 'general',
      ownerId: String(params.ownerId || '').trim(),
      funcionId: String(params.funcionId || '').trim(),
      nombre: String(params.nombre || '').trim(),
      descripcion: params.descripcion ? String(params.descripcion).trim() : '',
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
    const exists = await FirestoreService.exists(this.COLLECTION_NAME, nextDocId);
    if (exists) {
      await FirestoreService.update(this.COLLECTION_NAME, nextDocId, doc);
    } else {
      await FirestoreService.addWithId(this.COLLECTION_NAME, nextDocId, doc);
    }

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
      funciones: [],
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.addWithId(this.COLLECTION_NAME, empresaId, doc);
  }

  static async removeFuncionFromEmpresas(params: {
    ownerId: string;
    empresaIds: string[];
    funcionId: string;
  }): Promise<void> {
    const funcionId = String(params.funcionId || '').trim();
    if (!funcionId) return;

    const empresaIds = Array.from(new Set((params.empresaIds || []).map((x) => String(x).trim()).filter(Boolean)));
    await Promise.all(
      empresaIds.map(async (empresaId) => {
        const doc = await FirestoreService.getById(this.COLLECTION_NAME, empresaId);
        if (!doc) return;
        if (doc.type !== 'empresa') return;
        const current = Array.isArray(doc.funciones) ? (doc.funciones as unknown[]).map((x) => String(x)) : [];
        const next = current.filter((x) => x !== funcionId);
        if (next.length === current.length) return;
        await FirestoreService.update(this.COLLECTION_NAME, empresaId, {
          funciones: next,
          updatedAt: new Date().toISOString(),
        });
      })
    );
  }
}
