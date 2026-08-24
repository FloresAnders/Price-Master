export const BCR_RECEIPTS_WRITE_PERMISSION = "bcr.receipts.write" as const;

export type BcrReceiptInput = {
  receiptId: string;
  monto: number;
  paidAt: Date;
};

export type BcrReceiptAction = "created" | "already_exists";

export interface BcrReceiptRecord extends Record<string, unknown> {
  receiptId: string;
  monto: number;
  paidAt: Date;
  receivedAt: unknown;
  updatedAt: Date;
  deviceId: string;
  source: "bcr";
}

export class BcrReceiptError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "BcrReceiptError";
    this.status = status;
    this.code = code;
  }
}

function invalid(code: string, field: string): never {
  throw new BcrReceiptError(400, code, `Invalid ${field}.`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseBcrReceipt(body: unknown): BcrReceiptInput {
  if (!isPlainObject(body)) invalid("invalid_body", "body");

  const receiptId =
    typeof body.receiptId === "string" ? body.receiptId.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{64}$/.test(receiptId)) {
    invalid("invalid_receipt_id", "receiptId");
  }

  if (
    typeof body.monto !== "number" ||
    !Number.isFinite(body.monto) ||
    body.monto <= 0 ||
    body.monto > 1_000_000_000_000
  ) {
    invalid("invalid_monto", "monto");
  }

  if (typeof body.paidAt !== "string") invalid("invalid_paid_at", "paidAt");
  const paidAt = new Date(body.paidAt);
  if (!Number.isFinite(paidAt.getTime())) invalid("invalid_paid_at", "paidAt");

  return { receiptId, monto: body.monto, paidAt };
}

export function readBcrBearerToken(authorization: string | null): string {
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    throw new BcrReceiptError(
      401,
      "missing_or_invalid_authorization",
      "Invalid authorization header.",
    );
  }
  return match[1];
}

export function mergeBcrReceipt(
  existing: Record<string, unknown> | undefined,
  receipt: BcrReceiptInput,
  deviceId: string,
  now: Date,
): { action: BcrReceiptAction; record?: BcrReceiptRecord } {
  if (existing) return { action: "already_exists" };
  return {
    action: "created",
    record: {
      receiptId: receipt.receiptId,
      monto: receipt.monto,
      paidAt: receipt.paidAt,
      receivedAt: now,
      updatedAt: now,
      deviceId,
      source: "bcr",
    },
  };
}
