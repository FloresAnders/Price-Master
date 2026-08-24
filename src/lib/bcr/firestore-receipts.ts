import type { Firestore } from "firebase-admin/firestore";
import {
  BCR_RECEIPTS_WRITE_PERMISSION,
  BcrReceiptError,
  mergeBcrReceipt,
  type BcrReceiptAction,
  type BcrReceiptInput,
} from "./receipts.ts";

function readDocumentSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || normalized.includes("/")) {
    return null;
  }
  return normalized;
}

export interface BcrReceiptsRepository {
  sync(
    tokenHash: string,
    receipt: BcrReceiptInput,
    now: Date,
  ): Promise<{ action: BcrReceiptAction }>;
}

export class FirestoreBcrReceiptsRepository implements BcrReceiptsRepository {
  readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async sync(
    tokenHash: string,
    receipt: BcrReceiptInput,
    now: Date,
  ): Promise<{ action: BcrReceiptAction }> {
    if (!/^[a-f0-9]{64}$/.test(tokenHash)) {
      throw new BcrReceiptError(401, "invalid_device_token", "Invalid device token.");
    }

    const deviceReference = this.firestore.doc(
      `bcrIntegrationDevices/${tokenHash}`,
    );

    return this.firestore.runTransaction(async (transaction) => {
      const deviceSnapshot = await transaction.get(deviceReference);
      if (!deviceSnapshot.exists) {
        throw new BcrReceiptError(401, "invalid_device_token", "Invalid device token.");
      }

      const device = deviceSnapshot.data() ?? {};
      if (device.revokedAt) {
        throw new BcrReceiptError(401, "revoked_device_token", "The device token is revoked.");
      }

      const companyId = readDocumentSegment(device.companyId);
      const deviceId = readDocumentSegment(device.deviceId);
      if (!companyId || !deviceId) {
        throw new BcrReceiptError(401, "invalid_device", "Invalid device configuration.");
      }

      const permissions = Array.isArray(device.permissions) ? device.permissions : [];
      if (!permissions.includes(BCR_RECEIPTS_WRITE_PERMISSION)) {
        throw new BcrReceiptError(
          403,
          "missing_permission",
          "The device cannot write BCR receipts.",
        );
      }

      const receiptReference = this.firestore.doc(
        `bcrReceipts/${companyId}/receipts/${receipt.receiptId}`,
      );
      const receiptSnapshot = await transaction.get(receiptReference);
      const merged = mergeBcrReceipt(
        receiptSnapshot.exists ? receiptSnapshot.data() : undefined,
        receipt,
        deviceId,
        now,
      );

      if (merged.record) transaction.set(receiptReference, merged.record);
      transaction.set(deviceReference, { lastSeenAt: now }, { merge: true });
      return { action: merged.action };
    });
  }
}
