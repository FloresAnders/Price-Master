import type { Firestore } from "firebase-admin/firestore";
import {
  buildBcrDailyResult,
  readBcrCompanyDocumentId,
  type BcrDailyResult,
  type BcrDayRange,
} from "./read-receipts.ts";

export interface BcrReceiptsReader {
  listDaily(companyId: string, range: BcrDayRange): Promise<BcrDailyResult>;
}

export class FirestoreBcrReceiptsReader implements BcrReceiptsReader {
  readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async listDaily(companyId: string, range: BcrDayRange): Promise<BcrDailyResult> {
    const normalizedCompanyId = readBcrCompanyDocumentId(companyId);
    const snapshot = await this.firestore
      .collection("bcrReceipts")
      .doc(normalizedCompanyId)
      .collection("receipts")
      .where("paidAt", ">=", range.start)
      .where("paidAt", "<", range.end)
      .orderBy("paidAt", "desc")
      .get();
    return buildBcrDailyResult(snapshot.docs.map((document) => document.data()));
  }
}
