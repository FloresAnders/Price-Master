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
import { FacturasService, type FacturaMovement } from "@/services/facturas";

export type PendingInvoiceDeletionRequestStatus =
  | "pending"
  | "approved"
  | "rejected";

export type PendingInvoiceDeletionRequestRecord = {
  id?: string;
  company: string;
  companyKey: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDocType: "FCO" | "FCR" | "NC";
  paymentStatus: "PENDIENTE" | "PARCIAL" | "PAGADA" | "REBAJADA";
  amount: number;
  currency: string;
  providerCode: string;
  manager: string;
  status: PendingInvoiceDeletionRequestStatus;
  reason: string;
  requestedBy?: string | null;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  approvedAt?: unknown;
  rejectedAt?: unknown;
  responseSeenAt?: unknown;
};

const COLLECTION_NAME = "pendingInvoiceDeletionRequests";

export const normalizePendingInvoiceDeletionCompanyKey = (company: string) =>
  company.trim().toLowerCase();

export const buildPendingInvoiceDeletionRequestId = (
  company: string,
  invoiceId: string,
) =>
  `${encodeURIComponent(
    normalizePendingInvoiceDeletionCompanyKey(company),
  )}__${encodeURIComponent(String(invoiceId || "").trim())}`;

const normalizeInvoiceDocType = (value: unknown): "FCO" | "FCR" | "NC" => {
  if (value === "FCR") return "FCR";
  if (value === "NC") return "NC";
  return "FCO";
};

const normalizePaymentStatus = (
  value: unknown,
): "PENDIENTE" | "PARCIAL" | "PAGADA" | "REBAJADA" => {
  if (
    value === "PARCIAL" ||
    value === "PAGADA" ||
    value === "REBAJADA"
  ) {
    return value;
  }
  return "PENDIENTE";
};

const roundMoney2 = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const isPendingForDeletion = (invoice: Partial<FacturaMovement>): boolean =>
  normalizePaymentStatus(invoice.paymentStatus) === "PENDIENTE" &&
  Math.max(0, roundMoney2(invoice.paidAmount)) === 0;

const sanitizeRecord = (
  id: string,
  data: Record<string, unknown>,
): PendingInvoiceDeletionRequestRecord | null => {
  const company = String(data.company || "").trim();
  const invoiceId = String(data.invoiceId || "").trim();
  const status = String(data.status || "") as PendingInvoiceDeletionRequestStatus;
  if (!company || !invoiceId) return null;
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    return null;
  }

  return {
    id,
    company,
    companyKey:
      String(data.companyKey || "").trim() ||
      normalizePendingInvoiceDeletionCompanyKey(company),
    invoiceId,
    invoiceNumber: String(data.invoiceNumber || "").trim(),
    invoiceDocType: normalizeInvoiceDocType(data.invoiceDocType),
    paymentStatus: normalizePaymentStatus(data.paymentStatus),
    amount: roundMoney2(data.amount),
    currency: String(data.currency || "CRC").trim() || "CRC",
    providerCode: String(data.providerCode || "").trim(),
    manager: String(data.manager || "").trim(),
    status,
    reason: String(data.reason || "").trim(),
    requestedBy:
      typeof data.requestedBy === "string" ? data.requestedBy : null,
    approvedBy:
      typeof data.approvedBy === "string" ? data.approvedBy : null,
    rejectedBy:
      typeof data.rejectedBy === "string" ? data.rejectedBy : null,
    rejectionReason:
      typeof data.rejectionReason === "string" ? data.rejectionReason : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    approvedAt: data.approvedAt,
    rejectedAt: data.rejectedAt,
    responseSeenAt: data.responseSeenAt,
  };
};

const buildRequestPayload = (
  company: string,
  invoice: FacturaMovement,
  reason: string,
  requestedBy?: string | null,
) => ({
  company,
  companyKey: normalizePendingInvoiceDeletionCompanyKey(company),
  invoiceId: invoice.id,
  invoiceNumber: invoice.invoiceNumber,
  invoiceDocType: invoice.invoiceDocType,
  paymentStatus: normalizePaymentStatus(invoice.paymentStatus),
  amount: roundMoney2(invoice.originalAmount ?? invoice.amount),
  currency: invoice.currency,
  providerCode: invoice.providerCode,
  manager: invoice.manager,
  status: "pending" as const,
  reason: reason.trim(),
  requestedBy: requestedBy ?? null,
});

export class PendingInvoiceDeletionRequestsService {
  static async requestDeletion(payload: {
    company: string;
    invoice: FacturaMovement;
    reason?: string | null;
    requestedBy?: string | null;
  }): Promise<string> {
    const company = String(payload.company || "").trim();
    const invoiceId = String(payload.invoice?.id || "").trim();
    if (!company || !invoiceId) {
      throw new Error("Empresa y factura requeridas.");
    }
    if (
      payload.invoice.invoiceDocType !== "FCO" &&
      payload.invoice.invoiceDocType !== "FCR" &&
      payload.invoice.invoiceDocType !== "NC"
    ) {
      throw new Error("Tipo de factura no permitido.");
    }
    if (!isPendingForDeletion(payload.invoice)) {
      throw new Error("Solo se puede solicitar eliminacion de pendientes.");
    }

    const id = buildPendingInvoiceDeletionRequestId(company, invoiceId);
    const ref = doc(db, COLLECTION_NAME, id);
    const invoiceRef = FacturasService.buildMovementRef(company, invoiceId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists()
        ? sanitizeRecord(id, snap.data() as Record<string, unknown>)
        : null;
      if (existing?.status === "pending") {
        return;
      }
      const invoiceSnap = await tx.get(invoiceRef);
      if (!invoiceSnap.exists()) {
        throw new Error("La factura ya no existe.");
      }
      const invoice = {
        ...payload.invoice,
        ...(invoiceSnap.data() as Partial<FacturaMovement>),
        id: invoiceId,
      };
      if (!isPendingForDeletion(invoice)) {
        throw new Error("Solo se puede solicitar eliminacion de pendientes.");
      }
      tx.set(
        ref,
        {
          ...buildRequestPayload(
            company,
            invoice as FacturaMovement,
            payload.reason || "Solicitud de eliminacion",
            payload.requestedBy,
          ),
          createdAt: existing?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          responseSeenAt: null,
        },
        { merge: true },
      );
    });

    const verify = await getDoc(ref);
    if (!verify.exists()) {
      throw new Error("No se pudo verificar la solicitud de eliminacion.");
    }
    return id;
  }

  static async approveDeletion(args: {
    requestId: string;
    approvedBy?: string | null;
  }): Promise<void> {
    const requestId = String(args.requestId || "").trim();
    if (!requestId) return;
    const ref = doc(db, COLLECTION_NAME, requestId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const record = sanitizeRecord(
        requestId,
        snap.data() as Record<string, unknown>,
      );
      if (record?.status !== "pending") return;

      const invoiceRef = FacturasService.buildMovementRef(
        record.company,
        record.invoiceId,
      );
      const invoiceSnap = await tx.get(invoiceRef);
      if (!invoiceSnap.exists()) {
        tx.set(
          ref,
          {
            status: "approved",
            approvedBy: args.approvedBy ?? null,
            approvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            responseSeenAt: null,
          },
          { merge: true },
        );
        return;
      }

      const invoice = invoiceSnap.data() as FacturaMovement;
      if (!isPendingForDeletion(invoice)) {
        throw new Error("La factura ya no esta pendiente.");
      }

      tx.delete(invoiceRef);
      tx.set(
        ref,
        {
          status: "approved",
          approvedBy: args.approvedBy ?? null,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          responseSeenAt: null,
        },
        { merge: true },
      );
    });
  }

  static async rejectDeletion(args: {
    requestId: string;
    rejectedBy?: string | null;
    rejectionReason?: string | null;
  }): Promise<void> {
    const requestId = String(args.requestId || "").trim();
    if (!requestId) return;
    const ref = doc(db, COLLECTION_NAME, requestId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const record = sanitizeRecord(
        requestId,
        snap.data() as Record<string, unknown>,
      );
      if (record?.status !== "pending") return;
      tx.set(
        ref,
        {
          status: "rejected",
          rejectedBy: args.rejectedBy ?? null,
          rejectionReason: args.rejectionReason ?? "Rechazado",
          rejectedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          responseSeenAt: null,
        },
        { merge: true },
      );
    });
  }

  static async getPendingDeletionRequestsByCompany(
    company: string,
  ): Promise<PendingInvoiceDeletionRequestRecord[]> {
    const companyKey = normalizePendingInvoiceDeletionCompanyKey(company);
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
      .filter(
        (item): item is PendingInvoiceDeletionRequestRecord => Boolean(item),
      );
  }

  static async getPendingDeletionRequests(): Promise<
    PendingInvoiceDeletionRequestRecord[]
  > {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((item) => sanitizeRecord(item.id, item.data() as Record<string, unknown>))
      .filter(
        (item): item is PendingInvoiceDeletionRequestRecord => Boolean(item),
      );
  }

  static async getAnsweredDeletionRequestsByRequester(
    requester: string,
  ): Promise<PendingInvoiceDeletionRequestRecord[]> {
    const requestedBy = requester.trim();
    if (!requestedBy) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where("requestedBy", "==", requestedBy),
      where("status", "in", ["approved", "rejected"]),
      orderBy("updatedAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((item) => sanitizeRecord(item.id, item.data() as Record<string, unknown>))
      .filter(
        (item): item is PendingInvoiceDeletionRequestRecord => Boolean(item),
      );
  }

  static async markResponseSeen(args: { requestId: string }): Promise<void> {
    const requestId = String(args.requestId || "").trim();
    if (!requestId) return;
    const ref = doc(db, COLLECTION_NAME, requestId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const record = sanitizeRecord(
        requestId,
        snap.data() as Record<string, unknown>,
      );
      if (record?.status !== "approved" && record?.status !== "rejected") {
        return;
      }
      tx.set(ref, { responseSeenAt: serverTimestamp() }, { merge: true });
    });
  }
}
