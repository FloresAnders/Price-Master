/**
 * Reglas de montos al registrar un abono o un pago completo de una factura a
 * crédito (FCR) en el Fondo General (misma regla para cualquier pantalla).
 *
 * El fondo (efectivo) solo se debita en múltiplos de 1.000 (CRC en
 * FondoGeneral). El monto digitado se aplica SIEMPRE por completo a la factura:
 * la diferencia entre el monto digitado y su redondeo hacia abajo a la unidad
 * de mil queda absorbida como "redondeo" y reduce el saldo pendiente.
 *
 * Ejemplos (CRC, FondoGeneral, saldo ₡15,766):
 * - Abono de ₡5,766 → el fondo se debita ₡5,000, se absorben ₡766 de redondeo
 *   y el saldo pendiente queda en ₡10,000.
 * - Pago completo de ₡15,766 → el fondo se debita ₡15,000, se absorben ₡766 y
 *   la factura queda saldada.
 *
 * Este módulo NO importa servicios ni React para poder probarse en aislamiento.
 */

export type FcrPaymentMode = "partial" | "full";

export type FcrPaymentAmounts = {
  /** True cuando este pago salda por completo el saldo pendiente. */
  isFullSettlement: boolean;
  /** Monto que efectivamente se debita del fondo (el pago en efectivo). */
  cashDebit: number;
  /**
   * Diferencia entre el efectivo digitado y el múltiplo de 1.000 que sí se
   * debita. Se absorbe como "redondeo" y reduce el saldo pendiente de la
   * factura junto con el resto del pago.
   */
  roundingAbsorbed: number;
  /** Total aplicado a la factura (efectivo + notas de crédito + redondeo). */
  totalAppliedToInvoice: number;
};

export type ResolveFcrPaymentAmountsParams = {
  /** Saldo pendiente de la factura. */
  balance: number;
  /** Total de notas de crédito aplicadas en este pago. */
  creditNotesTotal: number;
  /** Efectivo digitado por el usuario (o 0 cuando el pago completo es automático). */
  enteredAmount: number;
  mode: FcrPaymentMode;
  currency: string;
  accountKey?: string;
};

const round2 = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const isCRCFondoGeneral = (currency: string, accountKey?: string): boolean =>
  String(currency || "")
    .trim()
    .toUpperCase() === "CRC" &&
  (!accountKey || accountKey === "FondoGeneral");

/** Redondea hacia abajo a la unidad de mil solo para CRC en FondoGeneral. */
export const roundFcrCashToThousandFloor = (
  amount: number,
  currency: string,
  accountKey?: string,
): number => {
  const normalized = Math.max(0, round2(amount));
  return isCRCFondoGeneral(currency, accountKey)
    ? Math.floor(normalized / 1000) * 1000
    : normalized;
};

export const resolveFcrPaymentAmounts = (
  params: ResolveFcrPaymentAmountsParams,
): FcrPaymentAmounts => {
  const balance = Math.max(0, round2(params.balance));
  const creditNotesTotal = Math.max(0, round2(params.creditNotesTotal));
  const cashRemainder = Math.max(0, round2(balance - creditNotesTotal));
  const enteredAmount = Math.max(0, round2(params.enteredAmount));

  const isFullSettlement =
    params.mode === "full" || enteredAmount >= cashRemainder;

  // Efectivo que se aplica a la factura: en pago completo cubre el saldo que
  // no pagan las notas de crédito; en un abono es lo que el usuario digitó.
  const cashApplied = isFullSettlement
    ? cashRemainder
    : Math.min(enteredAmount, cashRemainder);

  const cashDebit = roundFcrCashToThousandFloor(
    cashApplied,
    params.currency,
    params.accountKey,
  );
  const roundingAbsorbed = Math.max(0, round2(cashApplied - cashDebit));

  const totalAppliedToInvoice = round2(
    cashDebit + roundingAbsorbed + creditNotesTotal,
  );

  return {
    isFullSettlement,
    cashDebit,
    roundingAbsorbed,
    totalAppliedToInvoice,
  };
};
