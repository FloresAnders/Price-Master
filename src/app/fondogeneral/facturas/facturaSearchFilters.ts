import type { FacturaMovement } from "@/services/facturas";

export type FacturaViewFilter =
  | "pending-credit"
  | "pending-credit-note"
  | "paid"
  | "partial"
  | "discounted"
  | null;

export type FacturaAppliedSearchFilters = {
  providerCode: string | "all";
  paymentType: string | "all";
  invoiceNumber: string;
  notesQuery: string;
  view: FacturaViewFilter;
};

export const EMPTY_FACTURA_APPLIED_SEARCH_FILTERS: FacturaAppliedSearchFilters = {
  providerCode: "all",
  paymentType: "all",
  invoiceNumber: "",
  notesQuery: "",
  view: null,
};

export const normalizeFacturaAppliedSearchFilters = (
  filters: FacturaAppliedSearchFilters,
): FacturaAppliedSearchFilters => ({
  providerCode: filters.providerCode.trim() || "all",
  paymentType: filters.paymentType.trim() || "all",
  invoiceNumber: filters.invoiceNumber.trim(),
  notesQuery: filters.notesQuery.trim(),
  view: filters.view,
});

export const resolveFacturaSearchPaymentTypes = (
  movements: FacturaMovement[],
): string[] => {
  const types = new Set(["PENDIENTE", "COMPRA INVENTARIO"]);
  for (const movement of movements) {
    const paymentType = String(movement.paymentType || "").trim();
    if (paymentType) types.add(paymentType);
  }
  return Array.from(types).sort((left, right) => left.localeCompare(right));
};

const roundMoney2 = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

export const resolveFacturaPaidAmount = (movement: FacturaMovement): number => {
  const amount = Math.max(0, roundMoney2(movement.amount));
  if (String(movement.invoiceDocType || "").trim().toUpperCase() === "FCO") {
    return amount;
  }
  const paidAmount = Math.max(0, roundMoney2(movement.paidAmount));
  return Math.min(amount, paidAmount);
};

export const resolveFacturaBalance = (movement: FacturaMovement): number => {
  const amount = Math.max(0, roundMoney2(movement.amount));
  if (String(movement.invoiceDocType || "").trim().toUpperCase() === "FCO") {
    return 0;
  }
  const paidAmount = resolveFacturaPaidAmount(movement);
  const balanceDue = Math.max(0, roundMoney2(movement.balanceDue));
  if (balanceDue > 0) return Math.min(amount, balanceDue);
  return Math.max(0, amount - paidAmount);
};

export const resolveFacturaStatus = (
  movement: FacturaMovement,
): "PENDIENTE" | "PARCIAL" | "PAGADA" => {
  const docType = String(movement.invoiceDocType || "").trim().toUpperCase();
  if (
    docType === "NC" &&
    Math.max(0, roundMoney2(movement.amount)) === 0 &&
    !["PAGADA", "REBAJADA"].includes(
      String(movement.paymentStatus || "PENDIENTE").toUpperCase(),
    )
  ) {
    return "PENDIENTE";
  }
  if (docType === "FCO") return "PAGADA";
  if (movement.paymentStatus === "PAGADA") return "PAGADA";
  if (movement.paymentStatus === "PARCIAL") return "PARCIAL";
  return resolveFacturaBalance(movement) > 0 &&
    resolveFacturaPaidAmount(movement) > 0
    ? "PARCIAL"
    : resolveFacturaBalance(movement) === 0
      ? "PAGADA"
      : "PENDIENTE";
};

export const resolveFacturaStatusLabel = (
  movement: FacturaMovement,
): string => {
  const status = resolveFacturaStatus(movement);
  return status === "PAGADA" &&
    String(movement.invoiceDocType || "").trim().toUpperCase() === "NC"
    ? "REBAJADA"
    : status;
};

const matchesView = (
  movement: FacturaMovement,
  view: FacturaViewFilter,
): boolean => {
  if (!view) return true;
  const status = resolveFacturaStatus(movement);
  const docType = String(movement.invoiceDocType || "").trim().toUpperCase();

  if (view === "pending-credit") {
    return status === "PENDIENTE" && docType === "FCR";
  }
  if (view === "pending-credit-note") {
    return status === "PENDIENTE" && docType === "NC";
  }
  if (view === "paid") {
    return status === "PAGADA" && (docType === "FCR" || docType === "FCO");
  }
  if (view === "partial") return status === "PARCIAL";
  return resolveFacturaStatusLabel(movement) === "REBAJADA";
};

export const matchesFacturaAppliedFilters = (
  movement: FacturaMovement,
  filters: FacturaAppliedSearchFilters,
): boolean => {
  if (
    filters.providerCode !== "all" &&
    movement.providerCode !== filters.providerCode
  ) {
    return false;
  }
  if (
    filters.paymentType !== "all" &&
    movement.paymentType !== filters.paymentType
  ) {
    return false;
  }

  const invoiceNumber = filters.invoiceNumber.trim().toLowerCase();
  if (
    invoiceNumber &&
    String(movement.invoiceNumber || "").trim().toLowerCase() !== invoiceNumber
  ) {
    return false;
  }

  const notesQuery = filters.notesQuery.trim().toLowerCase();
  if (
    notesQuery &&
    !String(movement.notes || "").toLowerCase().includes(notesQuery)
  ) {
    return false;
  }

  return matchesView(movement, filters.view);
};
