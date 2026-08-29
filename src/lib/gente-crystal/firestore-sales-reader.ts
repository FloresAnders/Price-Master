import type { Firestore } from "firebase-admin/firestore";
import {
  buildGenteCrystalDailyResult,
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

export class FirestoreGenteCrystalSalesQueryReader
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

export function shouldUseGenteCrystalDailyReads(
  env: Record<string, string | undefined>,
): boolean {
  return env.GENTE_CRYSTAL_DAILY_READS_ENABLED === "true";
}

export function createGenteCrystalSalesReader(
  firestore: Firestore,
  env: Record<string, string | undefined>,
): GenteCrystalSalesReader {
  return shouldUseGenteCrystalDailyReads(env)
    ? new FirestoreGenteCrystalDailySalesReader(firestore)
    : new FirestoreGenteCrystalSalesQueryReader(firestore);
}
