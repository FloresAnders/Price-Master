import type { AppliedCreditNote } from "@/services/facturas";
import type { MovementAccountKey } from "@/services/movimientos-fondos";

export type FondoMovementType = string;

export type FondoEntry = {
  id: string;
  providerCode: string;
  invoiceNumber: string;
  invoiceDocType?: "FCO" | "FCR";
  paymentType: FondoMovementType;
  amount?: number;
  originalAmount?: number;
  amountDue?: number;
  balanceDue?: number;
  amountEgreso: number;
  amountIngreso: number;
  amountPayment?: number;
  /** Efectivo realmente debitado por esta aplicación de FCR. */
  cashDebit?: number;
  /** Reducción total de la factura por esta aplicación (efectivo, NC y redondeo). */
  totalAppliedToInvoice?: number;
  /** Diferencia absorbida como redondeo en un pago de FCR (efectivo aplicado - efectivo debitado). */
  roundingAbsorbed?: number;
  /** Ajuste firmado aplicado al monto: redondeado - monto antes de redondear. */
  roundingAdjustment?: number;
  appliedCreditNotes?: AppliedCreditNote[];
  manager: string;
  manager2?: string;
  notes: string;
  createdAt: string;
  serverCreatedAt?: any;
  updateAt?: string;
  invoiceCreatedAt?: string;
  empresa?: string;
  accountId?: MovementAccountKey;
  currency?: "CRC" | "USD";
  breakdown?: Record<number, number>;
  openingBalanceCRC?: number;
  openingBalanceUSD?: number;
  openingPreviousBalanceCRC?: number;
  openingPreviousBalanceUSD?: number;
  openingBreakdownCRC?: Record<number, number>;
  openingBreakdownUSD?: Record<number, number>;
  closingBalanceCRC?: number;
  closingBalanceUSD?: number;
  isAudit?: boolean;
  originalEntryId?: string;
  auditDetails?: string;
  requiresOpening?: boolean;
  turno?: "D" | "N";
  sinTurno?: true;
};
