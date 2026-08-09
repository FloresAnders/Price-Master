import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import type { RegistroTiemposRecord } from "../types/firestore";
import { buildRegistroTiemposEmpresaDocId } from "../utils/registroTiempos";

export type RegistroTiemposInput = Omit<
  RegistroTiemposRecord,
  "id" | "currency" | "createdAt" | "updatedAt"
>;

export class RegistroTiemposService {
  static readonly COLLECTION_NAME = "registrotiempos";
  static readonly RECORDS_SUBCOLLECTION = "records";

  static buildEmpresaDocId(empresa: string): string {
    return buildRegistroTiemposEmpresaDocId(empresa);
  }

  private static recordsCollectionRef(empresa: string) {
    return collection(
      db,
      this.COLLECTION_NAME,
      this.buildEmpresaDocId(empresa),
      this.RECORDS_SUBCOLLECTION,
    );
  }

  private static recordDocRef(empresa: string, recordId: string) {
    return doc(
      db,
      this.COLLECTION_NAME,
      this.buildEmpresaDocId(empresa),
      this.RECORDS_SUBCOLLECTION,
      recordId,
    );
  }

  static async createRecord(input: RegistroTiemposInput): Promise<string> {
    const now = new Date();
    const docRef = await addDoc(this.recordsCollectionRef(input.empresa), {
      ...input,
      empresaId: this.buildEmpresaDocId(input.empresa),
      currency: "CRC",
      createdAt: now,
      updatedAt: now,
    } satisfies Omit<RegistroTiemposRecord, "id">);
    return docRef.id;
  }

  static async getRecentRecords(
    empresa: string,
    limitCount = 20,
  ): Promise<RegistroTiemposRecord[]> {
    const normalizedEmpresa = String(empresa || "").trim();
    if (!normalizedEmpresa) return [];

    const q = query(
      this.recordsCollectionRef(normalizedEmpresa),
      orderBy("dateKey", "desc"),
      orderBy("hora", "desc"),
      limit(Math.max(1, Math.trunc(limitCount))),
    );
    const snap = await getDocs(q);

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<RegistroTiemposRecord, "id">),
    }));
  }

  static async deleteRecord(empresa: string, recordId: string): Promise<void> {
    const normalizedEmpresa = String(empresa || "").trim();
    const normalizedRecordId = String(recordId || "").trim();
    if (!normalizedEmpresa || !normalizedRecordId) return;

    await deleteDoc(this.recordDocRef(normalizedEmpresa, normalizedRecordId));
  }
}
