import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { MovementAccountKey, MovementCurrencyKey } from "./movimientos-fondos";

export type FacturaMovement = {
  id: string;
  empresa: string;
  accountId: MovementAccountKey;
  amount: number;
  originalAmount?: number;
  amountDue?: number;
  amountEgreso: number;
  amountIngreso: number;
  amountPayment?: number;
  appliedCreditNotes?: AppliedCreditNote[];
  balanceDue?: number;
  createdAt: string;
  currency: MovementCurrencyKey;
  invoiceNumber: string;
  manager: string;
  manager2?: string;
  notes: string;
  invoiceDocType: "FCO" | "FCR" | "NC";
  paymentType: string;
  providerCode: string;
  paidAmount?: number;
  paymentStatus?: "PENDIENTE" | "PARCIAL" | "PAGADA" | "REBAJADA";
  updateAt?: string;
  zeroAmountEditCount?: number;
  zeroAmountEditedAt?: string;
};

export type AppliedCreditNote = {
  id: string;
  invoiceNumber: string;
  amount: number;
  appliedAmount: number;
  currency: MovementCurrencyKey;
  observation?: string;
};

const normalizeEmpresaDocId = (empresa: string): string => {
  const base = String(empresa || "").trim();
  if (!base) return "GLOBAL";
  // Keep it stable & URL-safe-ish.
  return base
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "-")
    .slice(0, 200);
};

const normalizeInvoiceDocType = (value: unknown): "FCO" | "FCR" | "NC" => {
  if (value === "FCR") return "FCR";
  if (value === "NC") return "NC";
  return "FCO";
};

const stripUndefinedDeep = <T>(value: T): T => {
  if (value === undefined) return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      const cleaned = stripUndefinedDeep(val);
      if (cleaned !== undefined) output[key] = cleaned;
    });
    return output as T;
  }

  return value;
};

const sanitizeFacturaMovement = (raw: unknown): FacturaMovement | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<FacturaMovement> & Record<string, unknown>;

  const id = typeof candidate.id === "string" ? candidate.id : "";
  const empresa = typeof candidate.empresa === "string" ? candidate.empresa : "";
  const providerCode = typeof candidate.providerCode === "string" ? candidate.providerCode : "";
  const invoiceNumber = typeof candidate.invoiceNumber === "string" ? candidate.invoiceNumber : "";
  const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : "";
  const manager = typeof candidate.manager === "string" ? candidate.manager : "";
  const manager2 = typeof candidate.manager2 === "string" ? candidate.manager2 : "";
  const notes = typeof candidate.notes === "string" ? candidate.notes : "";
  const currency: MovementCurrencyKey = candidate.currency === "USD" ? "USD" : "CRC";
  const accountId: MovementAccountKey =
    candidate.accountId === "FondoGeneral" ||
    candidate.accountId === "BCR" ||
    candidate.accountId === "BN" ||
    candidate.accountId === "BAC"
      ? candidate.accountId
      : "FondoGeneral";

  if (!id || !empresa || !providerCode || !invoiceNumber || !createdAt || !manager) {
    return null;
  }
  const roundMoney2 = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
  };

  const amountValue =
    candidate.amount !== undefined
      ? Number(candidate.amount)
      : Number(candidate.amountIngreso || 0) - Number(candidate.amountEgreso || 0);
  const amount = roundMoney2(amountValue || 0);
  const originalAmount =
    candidate.originalAmount !== undefined
      ? Math.max(0, roundMoney2(candidate.originalAmount))
      : undefined;
  const amountDue =
    candidate.amountDue !== undefined
      ? Math.max(0, roundMoney2(candidate.amountDue))
      : undefined;
  const amountEgreso = roundMoney2(candidate.amountEgreso);
  const amountIngreso = roundMoney2(candidate.amountIngreso);
  const amountPayment = roundMoney2(candidate.amountPayment);
  const appliedCreditNotes = Array.isArray(candidate.appliedCreditNotes)
    ? candidate.appliedCreditNotes
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const raw = item as Partial<AppliedCreditNote>;
          const noteId = typeof raw.id === "string" ? raw.id.trim() : "";
          const noteInvoice =
            typeof raw.invoiceNumber === "string"
              ? raw.invoiceNumber.trim()
              : "";
          const noteAmount = Math.max(0, roundMoney2(raw.amount));
          const appliedAmount = Math.max(
            0,
            roundMoney2(raw.appliedAmount),
          );
          const noteCurrency: MovementCurrencyKey =
            raw.currency === "USD" ? "USD" : "CRC";
          const observation =
            typeof raw.observation === "string"
              ? raw.observation.trim()
              : "";
          if (!noteId || appliedAmount <= 0) return null;
          return {
            id: noteId,
            invoiceNumber: noteInvoice,
            amount: noteAmount,
            appliedAmount,
            currency: noteCurrency,
            ...(observation ? { observation } : {}),
          };
        })
        .filter((item): item is AppliedCreditNote => Boolean(item))
    : undefined;
  const paidAmount = roundMoney2(candidate.paidAmount);
  const balanceDue = roundMoney2(candidate.balanceDue);
  const paymentStatus =
    candidate.paymentStatus === "PAGADA" ||
    candidate.paymentStatus === "PARCIAL" ||
    candidate.paymentStatus === "REBAJADA"
      ? candidate.paymentStatus
      : "PENDIENTE";
  const updateAt =
    typeof candidate.updateAt === "string" ? candidate.updateAt : "";
  const zeroAmountEditCount = Math.max(
    0,
    Math.trunc(Number(candidate.zeroAmountEditCount) || 0),
  );
  const zeroAmountEditedAt =
    typeof candidate.zeroAmountEditedAt === "string"
      ? candidate.zeroAmountEditedAt
      : "";

  return {
    id,
    empresa,
    accountId,
    amount,
    originalAmount,
    amountDue,
    amountEgreso,
    amountIngreso,
    amountPayment:
      candidate.amountPayment !== undefined
        ? Math.max(0, amountPayment)
        : undefined,
    appliedCreditNotes:
      appliedCreditNotes && appliedCreditNotes.length > 0
        ? appliedCreditNotes
        : undefined,
    createdAt,
    currency,
    invoiceNumber,
    manager,
    manager2,
    notes,
    invoiceDocType: normalizeInvoiceDocType(candidate.invoiceDocType),
    paidAmount: paidAmount > 0 ? paidAmount : undefined,
    balanceDue: balanceDue > 0 ? balanceDue : undefined,
    paymentStatus,
    paymentType: typeof candidate.paymentType === "string" ? candidate.paymentType : "",
    providerCode,
    updateAt: updateAt || undefined,
    zeroAmountEditCount:
      candidate.zeroAmountEditCount !== undefined
        ? zeroAmountEditCount
        : undefined,
    zeroAmountEditedAt: zeroAmountEditedAt || undefined,
  };
};

export class FacturasService {
  static readonly COLLECTION_NAME = "Facturas";
  static readonly MOVEMENTS_SUBCOLLECTION = "movements";

  static buildEmpresaDocId(empresa: string): string {
    return normalizeEmpresaDocId(empresa);
  }

  static buildMovementRef(empresa: string, movementId: string) {
    return doc(
      db,
      this.COLLECTION_NAME,
      this.buildEmpresaDocId(empresa),
      this.MOVEMENTS_SUBCOLLECTION,
      movementId,
    );
  }

  static async upsertMovement(empresa: string, movement: FacturaMovement): Promise<void> {
    const empresaId = this.buildEmpresaDocId(empresa);
    const ref = doc(
      db,
      this.COLLECTION_NAME,
      empresaId,
      this.MOVEMENTS_SUBCOLLECTION,
      movement.id,
    );

    // Guarantee required fields.
    const payload: FacturaMovement = {
      ...movement,
      empresa: String(movement.empresa || empresa).trim(),
      invoiceDocType: normalizeInvoiceDocType(movement.invoiceDocType),
      paymentType: String(movement.paymentType || "").trim(),
    };

    await setDoc(ref, stripUndefinedDeep(payload), { merge: true });
  }

  static async deleteMovement(empresa: string, movementId: string): Promise<void> {
    const cleanMovementId = String(movementId || "").trim();
    if (!cleanMovementId) return;
    await deleteDoc(this.buildMovementRef(empresa, cleanMovementId));
  }

  static async listMovementsByEmpresa(
    empresa: string,
    opts?: { limit?: number },
  ): Promise<FacturaMovement[]> {
    const empresaId = this.buildEmpresaDocId(empresa);
    const q = query(
      collection(db, this.COLLECTION_NAME, empresaId, this.MOVEMENTS_SUBCOLLECTION),
      orderBy("createdAt", "desc"),
      limit(Math.max(1, Math.min(2000, opts?.limit ?? 500))),
    );

    const snap = await getDocs(q);
    return snap.docs.reduce<FacturaMovement[]>((acc, d: QueryDocumentSnapshot<DocumentData>) => {
      const movement = sanitizeFacturaMovement({ id: d.id, ...(d.data() as any) });
      if (movement) acc.push(movement);
      return acc;
    }, []);
  }

  static async listMovementsByDateRange(
    empresa: string,
    opts?: { startIso?: string; endIso?: string; limit?: number },
  ): Promise<FacturaMovement[]> {
    const empresaId = this.buildEmpresaDocId(empresa);
    const constraints: QueryConstraint[] = [];

    if (opts?.startIso) {
      constraints.push(where("createdAt", ">=", opts.startIso));
    }
    if (opts?.endIso) {
      constraints.push(where("createdAt", "<", opts.endIso));
    }

    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(Math.max(1, Math.min(2000, opts?.limit ?? 500))));

    const q = query(
      collection(db, this.COLLECTION_NAME, empresaId, this.MOVEMENTS_SUBCOLLECTION),
      ...constraints,
    );

    const snap = await getDocs(q);
    return snap.docs.reduce<FacturaMovement[]>((acc, d: QueryDocumentSnapshot<DocumentData>) => {
      const movement = sanitizeFacturaMovement({ id: d.id, ...(d.data() as any) });
      if (movement) acc.push(movement);
      return acc;
    }, []);
  }
}
