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
  closingBalanceCRC?: number;
  closingBalanceUSD?: number;
  isAudit?: boolean;
  originalEntryId?: string;
  auditDetails?: string;
};
