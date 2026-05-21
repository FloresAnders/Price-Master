import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { MovementAccountKey, MovementCurrencyKey } from "./movimientos-fondos";

export type FacturaMovement = {
  id: string;
  empresa: string;
  accountId: MovementAccountKey;
  amountEgreso: number;
  amountIngreso: number;
  createdAt: string;
  currency: MovementCurrencyKey;
  invoiceNumber: string;
  manager: string;
  notes: string;
  invoiceDocType: "FCO" | "FCR";
  paymentType: string;
  providerCode: string;
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

const normalizeInvoiceDocType = (value: unknown): "FCO" | "FCR" =>
  value === "FCR" ? "FCR" : "FCO";

const sanitizeFacturaMovement = (raw: unknown): FacturaMovement | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<FacturaMovement> & Record<string, unknown>;

  const id = typeof candidate.id === "string" ? candidate.id : "";
  const empresa = typeof candidate.empresa === "string" ? candidate.empresa : "";
  const providerCode = typeof candidate.providerCode === "string" ? candidate.providerCode : "";
  const invoiceNumber = typeof candidate.invoiceNumber === "string" ? candidate.invoiceNumber : "";
  const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : "";
  const manager = typeof candidate.manager === "string" ? candidate.manager : "";
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

  const amountEgreso = Math.trunc(Number(candidate.amountEgreso) || 0);
  const amountIngreso = Math.trunc(Number(candidate.amountIngreso) || 0);

  return {
    id,
    empresa,
    accountId,
    amountEgreso,
    amountIngreso,
    createdAt,
    currency,
    invoiceNumber,
    manager,
    notes,
    invoiceDocType: normalizeInvoiceDocType(candidate.invoiceDocType),
    paymentType: typeof candidate.paymentType === "string" ? candidate.paymentType : "",
    providerCode,
  };
};

export class FacturasService {
  static readonly COLLECTION_NAME = "Facturas";
  static readonly MOVEMENTS_SUBCOLLECTION = "movements";

  static buildEmpresaDocId(empresa: string): string {
    return normalizeEmpresaDocId(empresa);
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
    };

    await setDoc(ref, payload, { merge: true });
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
}
