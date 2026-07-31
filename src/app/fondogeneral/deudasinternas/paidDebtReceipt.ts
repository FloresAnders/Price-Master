import type { InternalDebt } from "@/services/internal-debts";

export interface PaidInternalDebtReceiptMovement {
  id: string;
  typeLabel: "Cargo" | "Abono";
  signedAmountPrefix: "+" | "-";
  amount: number;
  reason: string;
  reference: string;
  date: string;
  createdByName: string;
}

export interface PaidInternalDebtReceiptData {
  id: string;
  title: string;
  routeLabel: string;
  debtorName: string;
  creditorName: string;
  amountOriginal: number;
  balance: number;
  reason: string;
  reference: string;
  debtDate: string;
  statusLabel: "Pagada" | "Abierta";
  movements: PaidInternalDebtReceiptMovement[];
  exportedAtISO: string;
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeFileNamePart(value: string): string {
  const cleaned = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return cleaned || "sin_nombre";
}

export function buildPaidInternalDebtReceiptData(
  debt: InternalDebt,
  exportedAt = new Date(),
): PaidInternalDebtReceiptData {
  const balance = Number(debt.balance || 0);
  return {
    id: cleanText(debt.id),
    title: "Comprobante de deuda pagada",
    routeLabel: `${cleanText(debt.debtor.name)} debe a ${cleanText(
      debt.creditor.name,
    )}`,
    debtorName: cleanText(debt.debtor.name),
    creditorName: cleanText(debt.creditor.name),
    amountOriginal: Number(debt.amountOriginal || 0),
    balance,
    reason: cleanText(debt.reason),
    reference: cleanText(debt.reference),
    debtDate: cleanText(debt.date),
    statusLabel: debt.status === "paid" || balance <= 0 ? "Pagada" : "Abierta",
    movements: (debt.movements || []).map((movement) => ({
      id: cleanText(movement.id),
      typeLabel: movement.type === "payment" ? "Abono" : "Cargo",
      signedAmountPrefix: movement.type === "payment" ? "-" : "+",
      amount: Number(movement.amount || 0),
      reason: cleanText(movement.reason),
      reference: cleanText(movement.reference),
      date: cleanText(movement.date),
      createdByName: cleanText(movement.createdByName),
    })),
    exportedAtISO: exportedAt.toISOString(),
  };
}

export function buildPaidInternalDebtReceiptFileName(
  data: Pick<
    PaidInternalDebtReceiptData,
    "debtorName" | "creditorName" | "debtDate" | "exportedAtISO"
  >,
): string {
  const datePart = sanitizeFileNamePart(
    data.debtDate || data.exportedAtISO.slice(0, 10),
  );
  return `${[
    "DeudaInternaPagada",
    sanitizeFileNamePart(data.debtorName),
    sanitizeFileNamePart(data.creditorName),
    datePart,
  ].join("-")}.png`;
}

export function buildPaidInternalDebtReceiptStoragePath(
  fileName: string,
  timestamp = Date.now(),
): string {
  return `exports/internal-debts/${timestamp}_${fileName}`;
}
