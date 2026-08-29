import type { Firestore } from "firebase-admin/firestore";
import {
  readCompanyDocumentId,
  type GenteCrystalDailyResult,
  type GenteCrystalDayRange,
} from "./read-sales.ts";
import { buildGenteCrystalDailyResultFromDocument } from "./daily-sales.ts";

export interface GenteCrystalSalesReader {
  listDaily(
    companyId: string,
    range: GenteCrystalDayRange,
  ): Promise<GenteCrystalDailyResult>;
}

export class FirestoreGenteCrystalDailySalesReader
  implements GenteCrystalSalesReader
{
  constructor(readonly firestore: Firestore) {}

  async listDaily(
    companyId: string,
    range: GenteCrystalDayRange,
  ): Promise<GenteCrystalDailyResult> {
    const normalizedCompanyId = readCompanyDocumentId(companyId);
    const snapshot = await this.firestore
      .collection("genteCrystalSales")
      .doc(normalizedCompanyId)
      .collection("daily")
      .doc(range.date)
      .get();

    return buildGenteCrystalDailyResultFromDocument(
      snapshot.exists ? snapshot.data() : undefined,
    );
  }
}

export function createGenteCrystalSalesReader(
  firestore: Firestore,
): GenteCrystalSalesReader {
  return new FirestoreGenteCrystalDailySalesReader(firestore);
}
