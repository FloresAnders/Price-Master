import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";

export type ClosingTimeExtensionStatus =
  | "pending"
  | "approved"
  | "used"
  | "expired"
  | "rejected";

export type ClosingTimeExtensionTurno = "D" | "N";

export type ClosingTimeExtensionRecord = {
  id?: string;
  company: string;
  companyKey: string;
  operationalDateKey: string;
  turno: ClosingTimeExtensionTurno;
  extraMinutes: number;
  status: ClosingTimeExtensionStatus;
  reason: string;
  requestedBy?: string | null;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  usedBy?: string | null;
  createdAt?: unknown;
  approvedAt?: unknown;
  rejectedAt?: unknown;
  usedAt?: unknown;
  rejectionReason?: string | null;
  expiresAt?: string | null;
};

const COLLECTION_NAME = "closingTimeExtensions";

export const normalizeClosingTimeExtensionCompanyKey = (company: string) =>
  company.trim().toLowerCase();

export const buildClosingTimeExtensionId = (
  company: string,
  operationalDateKey: string,
  turno: ClosingTimeExtensionTurno,
) =>
  `${encodeURIComponent(normalizeClosingTimeExtensionCompanyKey(company))}__${operationalDateKey}__${turno}`;

const sanitizeExtraMinutes = (value: unknown) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.trunc(minutes);
};

export const isApprovedClosingTimeExtensionUsable = (
  extension: Pick<
    ClosingTimeExtensionRecord,
    "status" | "extraMinutes" | "expiresAt"
  > | null | undefined,
  nowISO: string = new Date().toISOString(),
) => {
  if (!extension || extension.status !== "approved") return false;
  if (sanitizeExtraMinutes(extension.extraMinutes) <= 0) return false;
  const expiresAt = String(extension.expiresAt || "").trim();
  if (!expiresAt) return true;
  const expiresMs = Date.parse(expiresAt);
  const nowMs = Date.parse(nowISO);
  if (!Number.isFinite(expiresMs) || !Number.isFinite(nowMs)) return false;
  return nowMs <= expiresMs;
};

export const getEffectiveMinutesAfterEnd = (
  baseMinutes: number,
  extension?: Pick<
    ClosingTimeExtensionRecord,
    "status" | "extraMinutes" | "expiresAt"
  > | null,
  nowISO: string = new Date().toISOString(),
) => {
  const base = Math.max(0, Math.trunc(Number(baseMinutes) || 0));
  if (!isApprovedClosingTimeExtensionUsable(extension, nowISO)) return base;
  return base + sanitizeExtraMinutes(extension?.extraMinutes);
};

const sanitizeRecord = (
  id: string,
  data: Record<string, unknown>,
): ClosingTimeExtensionRecord | null => {
  const company = String(data.company || "").trim();
  const companyKey =
    String(data.companyKey || "").trim() ||
    normalizeClosingTimeExtensionCompanyKey(company);
  const operationalDateKey = String(data.operationalDateKey || "").trim();
  const turno = data.turno === "D" || data.turno === "N" ? data.turno : null;
  const status = String(data.status || "") as ClosingTimeExtensionStatus;
  const extraMinutes = sanitizeExtraMinutes(data.extraMinutes);
  if (!company || !operationalDateKey || !turno || extraMinutes <= 0) return null;
  if (
    status !== "pending" &&
    status !== "approved" &&
    status !== "used" &&
    status !== "expired" &&
    status !== "rejected"
  ) {
    return null;
  }
  return {
    id,
    company,
    companyKey,
    operationalDateKey,
    turno,
    extraMinutes,
    status,
    reason: String(data.reason || "").trim(),
    requestedBy:
      typeof data.requestedBy === "string" ? data.requestedBy : null,
    approvedBy:
      typeof data.approvedBy === "string" ? data.approvedBy : null,
    rejectedBy:
      typeof data.rejectedBy === "string" ? data.rejectedBy : null,
    usedBy: typeof data.usedBy === "string" ? data.usedBy : null,
    createdAt: data.createdAt,
    approvedAt: data.approvedAt,
    rejectedAt: data.rejectedAt,
    usedAt: data.usedAt,
    rejectionReason:
      typeof data.rejectionReason === "string" ? data.rejectionReason : null,
    expiresAt:
      typeof data.expiresAt === "string" ? data.expiresAt : null,
  };
};

export class ClosingTimeExtensionsService {
  static async requestExtension(payload: {
    company: string;
    operationalDateKey: string;
    turno: ClosingTimeExtensionTurno;
    extraMinutes: number;
    reason: string;
    requestedBy?: string | null;
  }): Promise<string> {
    const id = buildClosingTimeExtensionId(
      payload.company,
      payload.operationalDateKey,
      payload.turno,
    );
    const ref = doc(db, COLLECTION_NAME, id);
    const company = payload.company.trim();
    const companyKey = normalizeClosingTimeExtensionCompanyKey(company);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists()
        ? sanitizeRecord(id, snap.data() as Record<string, unknown>)
        : null;
      if (
        existing &&
        existing.status !== "pending" &&
        existing.status !== "rejected" &&
        existing.status !== "expired"
      ) {
        throw new Error("Ya existe una extension aprobada o usada para este turno.");
      }
      tx.set(
        ref,
        {
          company,
          companyKey,
          operationalDateKey: payload.operationalDateKey,
          turno: payload.turno,
          extraMinutes: sanitizeExtraMinutes(payload.extraMinutes),
          status: "pending",
          reason: payload.reason.trim(),
          requestedBy: payload.requestedBy ?? null,
          createdAt: existing?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    const verify = await getDoc(ref);
    if (!verify.exists()) {
      throw new Error("No se pudo verificar la solicitud de tiempo.");
    }
    return id;
  }

  static async requestNightExtension(payload: {
    company: string;
    operationalDateKey: string;
    extraMinutes: number;
    reason: string;
    requestedBy?: string | null;
  }): Promise<string> {
    return this.requestExtension({ ...payload, turno: "N" });
  }

  static async approveExtension(payload: {
    company: string;
    operationalDateKey: string;
    turno: ClosingTimeExtensionTurno;
    extraMinutes: number;
    expiresAt: string;
    approvedBy?: string | null;
  }): Promise<void> {
    const id = buildClosingTimeExtensionId(
      payload.company,
      payload.operationalDateKey,
      payload.turno,
    );
    const ref = doc(db, COLLECTION_NAME, id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists()
        ? sanitizeRecord(id, snap.data() as Record<string, unknown>)
        : null;
      if (existing && existing.status !== "pending") {
        throw new Error("Solo se puede aprobar una solicitud pendiente.");
      }
      tx.set(
        ref,
        {
          company: existing?.company ?? payload.company.trim(),
          companyKey:
            existing?.companyKey ??
            normalizeClosingTimeExtensionCompanyKey(payload.company),
          operationalDateKey:
            existing?.operationalDateKey ?? payload.operationalDateKey,
          turno: existing?.turno ?? payload.turno,
          extraMinutes: sanitizeExtraMinutes(payload.extraMinutes),
          status: "approved",
          reason: existing?.reason ?? "",
          requestedBy: existing?.requestedBy ?? null,
          approvedBy: payload.approvedBy ?? null,
          approvedAt: serverTimestamp(),
          expiresAt: payload.expiresAt,
        },
        { merge: true },
      );
    });
  }

  static async approveNightExtension(payload: {
    company: string;
    operationalDateKey: string;
    extraMinutes: number;
    expiresAt: string;
    approvedBy?: string | null;
  }): Promise<void> {
    return this.approveExtension({ ...payload, turno: "N" });
  }

  static async getApprovedExtensionForClosingWindow(args: {
    company: string;
    operationalDateKey: string | null | undefined;
    turno: ClosingTimeExtensionTurno;
    nowISO: string;
  }): Promise<ClosingTimeExtensionRecord | null> {
    if (!args.operationalDateKey) return null;
    const id = buildClosingTimeExtensionId(
      args.company,
      args.operationalDateKey,
      args.turno,
    );
    const snap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!snap.exists()) return null;
    const record = sanitizeRecord(id, snap.data() as Record<string, unknown>);
    if (!isApprovedClosingTimeExtensionUsable(record, args.nowISO)) return null;
    return record;
  }

  static async getPendingNightExtensionsByCompany(
    company: string,
  ): Promise<ClosingTimeExtensionRecord[]> {
    const companyKey = normalizeClosingTimeExtensionCompanyKey(company);
    if (!companyKey) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where("companyKey", "==", companyKey),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((item) => sanitizeRecord(item.id, item.data() as Record<string, unknown>))
      .filter((item): item is ClosingTimeExtensionRecord => Boolean(item));
  }

  static async getPendingExtensions(): Promise<ClosingTimeExtensionRecord[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((item) => sanitizeRecord(item.id, item.data() as Record<string, unknown>))
      .filter((item): item is ClosingTimeExtensionRecord => Boolean(item));
  }

  static async getPendingExtensionsByCompany(
    company: string,
  ): Promise<ClosingTimeExtensionRecord[]> {
    return this.getPendingNightExtensionsByCompany(company);
  }

  static async rejectExtension(args: {
    company: string;
    operationalDateKey: string;
    turno: ClosingTimeExtensionTurno;
    rejectedBy?: string | null;
    rejectionReason?: string | null;
  }): Promise<void> {
    const id = buildClosingTimeExtensionId(
      args.company,
      args.operationalDateKey,
      args.turno,
    );
    const ref = doc(db, COLLECTION_NAME, id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const record = sanitizeRecord(id, snap.data() as Record<string, unknown>);
      if (record?.status !== "pending") return;
      tx.set(
        ref,
        {
          status: "rejected",
          rejectedBy: args.rejectedBy ?? null,
          rejectionReason: args.rejectionReason ?? null,
          rejectedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  }

  static async rejectNightExtension(args: {
    company: string;
    operationalDateKey: string;
    rejectedBy?: string | null;
    rejectionReason?: string | null;
  }): Promise<void> {
    return this.rejectExtension({ ...args, turno: "N" });
  }

  static async markUsed(args: {
    company: string;
    operationalDateKey: string | null | undefined;
    turno: ClosingTimeExtensionTurno;
    usedBy?: string | null;
  }): Promise<void> {
    if (!args.operationalDateKey) return;
    const id = buildClosingTimeExtensionId(
      args.company,
      args.operationalDateKey,
      args.turno,
    );
    const ref = doc(db, COLLECTION_NAME, id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const record = sanitizeRecord(id, snap.data() as Record<string, unknown>);
      if (record?.status !== "approved") return;
      tx.set(
        ref,
        {
          status: "used",
          usedBy: args.usedBy ?? null,
          usedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  }
}
