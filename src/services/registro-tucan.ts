import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { RegistroTucanRecord } from "../types/firestore";
import { buildRegistroTucanEmpresaDocId } from "../utils/registroTucan";

export type RegistroTucanInput = Omit<
  RegistroTucanRecord,
  "id" | "currency" | "createdAt" | "updatedAt"
>;

export class RegistroTucanService {
  static readonly COLLECTION_NAME = "registrotucan";
  static readonly RECORDS_SUBCOLLECTION = "records";

  static buildEmpresaDocId(empresa: string): string {
    return buildRegistroTucanEmpresaDocId(empresa);
  }

  private static recordsCollectionRef(empresa: string) {
    return collection(
      db,
      this.COLLECTION_NAME,
      this.buildEmpresaDocId(empresa),
      this.RECORDS_SUBCOLLECTION,
    );
  }

  static async createRecord(input: RegistroTucanInput): Promise<string> {
    const now = new Date();
    const docRef = await addDoc(this.recordsCollectionRef(input.empresa), {
      ...input,
      empresaId: this.buildEmpresaDocId(input.empresa),
      currency: "CRC",
      createdAt: now,
      updatedAt: now,
    } satisfies Omit<RegistroTucanRecord, "id">);
    return docRef.id;
  }

  static async getRecentRecords(
    empresa: string,
    limitCount = 20,
  ): Promise<RegistroTucanRecord[]> {
    const normalizedEmpresa = String(empresa || "").trim();
    if (!normalizedEmpresa) return [];

    const q = query(
      this.recordsCollectionRef(normalizedEmpresa),
      orderBy("dateKey", "desc"),
      limit(Math.max(1, Math.trunc(limitCount))),
    );
    const snap = await getDocs(q);

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<RegistroTucanRecord, "id">),
    }));
  }
}
