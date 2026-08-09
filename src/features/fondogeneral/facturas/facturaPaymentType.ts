export type FacturaPaymentStatus =
  | "PENDIENTE"
  | "PARCIAL"
  | "PAGADA"
  | "REBAJADA";

export const FACTURA_PENDING_PAYMENT_TYPE = "PENDIENTE";
export const FACTURA_PAID_PAYMENT_TYPE = "COMPRA INVENTARIO";

export const resolveFacturaPaymentType = (
  status: FacturaPaymentStatus | string,
): string => {
  const normalizedStatus = String(status || "")
    .trim()
    .toUpperCase();

  return normalizedStatus === "PAGADA" || normalizedStatus === "REBAJADA"
    ? FACTURA_PAID_PAYMENT_TYPE
    : FACTURA_PENDING_PAYMENT_TYPE;
};
