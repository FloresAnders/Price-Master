import type { Firestore } from "firebase-admin/firestore";
import {
  buildGenteCrystalDailyResult,
  readCompanyDocumentId,
  type GenteCrystalDailyResult,
  type GenteCrystalDayRange,
} from "./read-sales.ts";

export interface GenteCrystalSalesReader {
  listDaily(
    companyId: string,
    range: GenteCrystalDayRange,
  ): Promise<GenteCrystalDailyResult>;
}

export class FirestoreGenteCrystalSalesReader
  implements GenteCrystalSalesReader
{
  readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async listDaily(
    companyId: string,
    range: GenteCrystalDayRange,
  ): Promise<GenteCrystalDailyResult> {
    const normalizedCompanyId = readCompanyDocumentId(companyId);
    const snapshot = await this.firestore
      .collection("genteCrystalSales")
      .doc(normalizedCompanyId)
      .collection("sales")
      .where("saleAt", ">=", range.start)
      .where("saleAt", "<", range.end)
      .orderBy("saleAt", "desc")
      .get();

    return buildGenteCrystalDailyResult(
      snapshot.docs.map((document) => document.data()),
    );
  }
}
