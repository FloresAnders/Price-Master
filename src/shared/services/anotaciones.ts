import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import type {
  Anotacion,
  AnotacionPriority,
  AnotacionStatus,
} from "@/shared/types/firestore";

export type AnotacionInput = Pick<
  Anotacion,
  "empresa" | "title" | "description" | "category" | "color" | "priority"
> &
  Partial<
    Pick<
      Anotacion,
      "ownerId" | "creatorId" | "creatorName" | "reminderAt" | "status"
    >
  >;

const stripUndefinedDeep = <T>(value: T): T => {
  if (value === undefined) return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      const cleaned = stripUndefinedDeep(val);
      if (cleaned !== undefined) out[key] = cleaned;
    });
    return out as T;
  }
  return value;
};

const stripUndefinedShallow = (value: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, val]) => val !== undefined),
  );

const normalizeEmpresaDocId = (empresa: string): string => {
  const base = String(empresa || "").trim();
  if (!base) return "GLOBAL";
  return base
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "-")
    .slice(0, 200);
};

const normalizeStatus = (value: unknown): AnotacionStatus => {
  if (value === "done" || value === "archived") return value;
  return "pending";
};

const normalizePriority = (value: unknown): AnotacionPriority => {
  if (value === "low" || value === "high" || value === "urgent") return value;
  return "medium";
};

const normalizeColor = (value: unknown): string => {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : "#2563eb";
};

const sanitizeAnotacion = (raw: unknown): Anotacion | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<Anotacion> & Record<string, unknown>;

  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const empresa =
    typeof candidate.empresa === "string" ? candidate.empresa.trim() : "";
  const title =
    typeof candidate.title === "string" ? candidate.title.trim() : "";
  const createdAt =
    typeof candidate.createdAt === "string" ? candidate.createdAt : "";
  const creatorId =
    typeof candidate.creatorId === "string" ? candidate.creatorId.trim() : "";

  if (!id || !empresa || !title || !createdAt || !creatorId) return null;

  return {
    id,
    empresa,
    empresaId:
      typeof candidate.empresaId === "string" && candidate.empresaId.trim()
        ? candidate.empresaId.trim()
        : normalizeEmpresaDocId(empresa),
    ownerId:
      typeof candidate.ownerId === "string" && candidate.ownerId.trim()
        ? candidate.ownerId.trim()
        : undefined,
    title,
    description:
      typeof candidate.description === "string" ? candidate.description : "",
    category:
      typeof candidate.category === "string" && candidate.category.trim()
        ? candidate.category.trim()
        : "General",
    color: normalizeColor(candidate.color),
    priority: normalizePriority(candidate.priority),
    status: normalizeStatus(candidate.status),
    creatorId,
    creatorName:
      typeof candidate.creatorName === "string" && candidate.creatorName.trim()
        ? candidate.creatorName.trim()
        : "Usuario",
    createdAt,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt
        ? candidate.updatedAt
        : createdAt,
    reminderAt:
      typeof candidate.reminderAt === "string" && candidate.reminderAt
        ? candidate.reminderAt
        : undefined,
    archivedAt:
      typeof candidate.archivedAt === "string" && candidate.archivedAt
        ? candidate.archivedAt
        : undefined,
    doneAt:
      typeof candidate.doneAt === "string" && candidate.doneAt
        ? candidate.doneAt
        : undefined,
  };
};

export class AnotacionesService {
  static readonly COLLECTION_NAME = "anotaciones";
  static readonly MOVEMENTS_SUBCOLLECTION = "movements";

  static buildEmpresaDocId(empresa: string): string {
    return normalizeEmpresaDocId(empresa);
  }

  static buildMovementRef(empresa: string, noteId: string) {
    return doc(
      db,
      this.COLLECTION_NAME,
      this.buildEmpresaDocId(empresa),
      this.MOVEMENTS_SUBCOLLECTION,
      noteId,
    );
  }

  static async create(input: AnotacionInput): Promise<Anotacion> {
    const empresa = String(input.empresa || "").trim();
    const title = String(input.title || "").trim();
    const creatorId = String(input.creatorId || "").trim();
    if (!empresa) throw new Error("Empresa requerida.");
    if (!title) throw new Error("Titulo requerido.");
    if (!creatorId) throw new Error("Usuario requerido.");

    const empresaId = this.buildEmpresaDocId(empresa);
    const ref = doc(
      collection(
        db,
        this.COLLECTION_NAME,
        empresaId,
        this.MOVEMENTS_SUBCOLLECTION,
      ),
    );
    const now = new Date().toISOString();
    const note: Anotacion = {
      id: ref.id,
      empresa,
      empresaId,
      ownerId: input.ownerId?.trim() || undefined,
      title,
      description: String(input.description || "").trim(),
      category: String(input.category || "General").trim() || "General",
      color: normalizeColor(input.color),
      priority: normalizePriority(input.priority),
      status: "pending",
      creatorId,
      creatorName: String(input.creatorName || "Usuario").trim() || "Usuario",
      createdAt: now,
      updatedAt: now,
      reminderAt: input.reminderAt?.trim() || undefined,
    };

    await setDoc(ref, stripUndefinedDeep(note));
    return note;
  }

  static async update(
    empresa: string,
    noteId: string,
    updates: Partial<Anotacion>,
  ): Promise<void> {
    const cleanNoteId = String(noteId || "").trim();
    if (!cleanNoteId) return;
    const payload: Record<string, any> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    ["reminderAt", "doneAt", "archivedAt"].forEach((key) => {
      if (payload[key] === "") payload[key] = deleteField();
    });
    await updateDoc(
      this.buildMovementRef(empresa, cleanNoteId),
      stripUndefinedShallow(payload),
    );
  }

  static async archive(empresa: string, noteId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.update(empresa, noteId, {
      status: "archived",
      archivedAt: now,
    });
  }

  static async delete(empresa: string, noteId: string): Promise<void> {
    const cleanNoteId = String(noteId || "").trim();
    if (!cleanNoteId) return;
    await deleteDoc(this.buildMovementRef(empresa, cleanNoteId));
  }

  static async listByEmpresa(
    empresa: string,
    opts?: {
      limit?: number;
      scope?: { role?: string; ownerId?: string; ownercompanie?: string };
    },
  ): Promise<Anotacion[]> {
    const empresaId = this.buildEmpresaDocId(empresa);
    const constraints: QueryConstraint[] = [];
    const role = String(opts?.scope?.role || "").trim();
    const ownerId = String(opts?.scope?.ownerId || "").trim();
    const ownercompanie = String(opts?.scope?.ownercompanie || "").trim();

    constraints.push(where("empresaId", "==", empresaId));

    if (role === "admin") {
      constraints.push(where("ownerId", "==", ownerId));
    } else if (role !== "superadmin") {
      constraints.push(where("empresa", "==", ownercompanie || empresa));
    }

    constraints.push(limit(Math.max(1, Math.min(2000, opts?.limit ?? 500))));

    const q = query(
      collection(
        db,
        this.COLLECTION_NAME,
        empresaId,
        this.MOVEMENTS_SUBCOLLECTION,
      ),
      ...constraints,
    );

    const snap = await getDocs(q);
    return snap.docs.reduce<Anotacion[]>(
      (acc, d: QueryDocumentSnapshot<DocumentData>) => {
        const note = sanitizeAnotacion({ id: d.id, ...(d.data() as any) });
        if (note) acc.push(note);
        return acc;
      },
      [],
    ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
