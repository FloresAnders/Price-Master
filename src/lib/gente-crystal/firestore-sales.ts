import {
  FieldPath,
  FieldValue,
  type Firestore,
} from "firebase-admin/firestore";
import { planGenteCrystalDailyMutation } from "./daily-sales.ts";
import {
  GENTE_CRYSTAL_WRITE_PERMISSION,
  GenteCrystalSaleError,
  mergeGenteCrystalSale,
  type GenteCrystalSaleAction,
  type GenteCrystalSaleInput,
} from "./sales.ts";

function readDocumentSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || normalized.includes("/")) {
    return null;
  }
  return normalized;
}

export interface GenteCrystalSalesRepository {
  sync(
    tokenHash: string,
    sale: GenteCrystalSaleInput,
    now: Date,
  ): Promise<{ action: GenteCrystalSaleAction }>;
}

export class FirestoreGenteCrystalSalesRepository
  implements GenteCrystalSalesRepository
{
  readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async sync(
    tokenHash: string,
    sale: GenteCrystalSaleInput,
    now: Date,
  ): Promise<{ action: GenteCrystalSaleAction }> {
    if (!/^[a-f0-9]{64}$/.test(tokenHash)) {
      throw new GenteCrystalSaleError(
        401,
        "invalid_device_token",
        "Invalid device token.",
      );
    }

    const deviceReference = this.firestore.doc(
      `genteCrystalIntegrationDevices/${tokenHash}`,
    );

    return this.firestore.runTransaction(async (transaction) => {
      const deviceSnapshot = await transaction.get(deviceReference);
      if (!deviceSnapshot.exists) {
        throw new GenteCrystalSaleError(
          401,
          "invalid_device_token",
          "Invalid device token.",
        );
      }

      const device = deviceSnapshot.data() ?? {};
      if (device.revokedAt) {
        throw new GenteCrystalSaleError(
          401,
          "revoked_device_token",
          "The device token is revoked.",
        );
      }

      const companyId = readDocumentSegment(device.companyId);
      const deviceId = readDocumentSegment(device.deviceId);
      if (!companyId || !deviceId) {
        throw new GenteCrystalSaleError(
          401,
          "invalid_device",
          "Invalid device configuration.",
        );
      }

      const permissions = Array.isArray(device.permissions)
        ? device.permissions
        : [];
      if (!permissions.includes(GENTE_CRYSTAL_WRITE_PERMISSION)) {
        throw new GenteCrystalSaleError(
          403,
          "missing_permission",
          "The device cannot write Gente Crystal sales.",
        );
      }

      const saleReference = this.firestore.doc(
        `genteCrystalSales/${companyId}/sales/${sale.ticketId}`,
      );
      const saleSnapshot = await transaction.get(saleReference);
      const existingSale = saleSnapshot.exists
        ? saleSnapshot.data()
        : undefined;
      const merged = mergeGenteCrystalSale(
        existingSale,
        sale,
        deviceId,
        now,
      );

      if (merged.record) {
        const dailyMutation = planGenteCrystalDailyMutation(
          existingSale,
          merged.record,
        );
        transaction.set(saleReference, merged.record);
        transaction.set(deviceReference, { lastSeenAt: now }, { merge: true });

        if (dailyMutation.remove) {
          transaction.set(
            this.firestore.doc(
              `genteCrystalSales/${companyId}/daily/${dailyMutation.remove.date}`,
            ),
            {
              sales: {
                [dailyMutation.remove.ticketId]: FieldValue.delete(),
              },
            },
            {
              mergeFields: [
                new FieldPath("sales", dailyMutation.remove.ticketId),
              ],
            },
          );
        }

        if (dailyMutation.upsert) {
          transaction.set(
            this.firestore.doc(
              `genteCrystalSales/${companyId}/daily/${dailyMutation.upsert.date}`,
            ),
            {
              sales: {
                [dailyMutation.upsert.ticketId]: dailyMutation.upsert.entry,
              },
            },
            {
              mergeFields: [
                new FieldPath("sales", dailyMutation.upsert.ticketId),
              ],
            },
          );
        }
      }

      return { action: merged.action };
    });
  }
}
