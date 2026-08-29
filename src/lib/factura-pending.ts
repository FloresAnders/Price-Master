export type FacturaPendingProjectionInput = {
  invoiceDocType?: unknown;
  paymentStatus?: unknown;
  amount?: unknown;
  originalAmount?: unknown;
  paidAmount?: unknown;
  balanceDue?: unknown;
};

const pendingMoney = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const normalizeDocumentType = (value: unknown): "FCO" | "FCR" | "NC" => {
  if (value === "FCR") return "FCR";
  if (value === "NC") return "NC";
  return "FCO";
};

export function isFacturaPendingForClosing(
  movement: FacturaPendingProjectionInput,
): boolean {
  const documentType = normalizeDocumentType(movement.invoiceDocType);
  if (documentType === "FCO") return false;

  const status = String(movement.paymentStatus || "PENDIENTE").toUpperCase();
  if (status === "PAGADA" || status === "REBAJADA") return false;

  const rawTotal = movement.originalAmount ?? movement.amount;
  const total =
    documentType === "NC"
      ? Math.abs(pendingMoney(rawTotal))
      : Math.max(0, pendingMoney(rawTotal));
  const paid = Math.max(0, pendingMoney(movement.paidAmount));
  const balance = Math.max(
    0,
    pendingMoney(
      movement.balanceDue !== undefined
        ? movement.balanceDue
        : total - paid,
    ),
  );

  if (documentType === "FCR") return balance > 0;

  const rawAmount = Number(movement.amount);
  const isZeroAmountNote =
    Number.isFinite(rawAmount) && pendingMoney(rawAmount) === 0;
  return balance > 0 || isZeroAmountNote;
}

export function withFacturaPendingForClosing<
  T extends FacturaPendingProjectionInput,
>(movement: T): T & { isPendingForClosing: boolean } {
  return {
    ...movement,
    isPendingForClosing: isFacturaPendingForClosing(movement),
  };
}
