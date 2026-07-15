import type { Timestamp } from "firebase/firestore";

export type AccountingPartyType = "cliente" | "proveedor";
export type AccountingInvoiceStatus =
  | "Pendiente"
  | "Parcial"
  | "Pagada"
  | "Vencida";
export type AccountingCurrency = "CRC" | "USD";
export type AccountingPaymentMethod =
  | "efectivo"
  | "transferencia"
  | "cheque";
export type AccountingDate = Timestamp | Date | string;

export interface AccountingAuditFields {
  ownerId: string;
  empresaId: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AccountingInvoice extends AccountingAuditFields {
  id: string;
  tipo: AccountingPartyType;
  numero: string;
  terceroId: string;
  terceroNombre: string;
  ruta?: string;
  departamento?: string;
  fechaEmision: Timestamp;
  fechaVencimiento: Timestamp;
  monto: number;
  pagado: number;
  saldo: number;
  estado: AccountingInvoiceStatus;
  moneda: AccountingCurrency;
  notas?: string;
}

export type CreateAccountingInvoiceInput = Omit<
  AccountingInvoice,
  "id" | "pagado" | "saldo" | "estado" | "createdAt" | "updatedAt" | "fechaEmision" | "fechaVencimiento"
> & {
  fechaEmision: AccountingDate;
  fechaVencimiento: AccountingDate;
  estado?: AccountingInvoiceStatus;
};

export interface AccountingPayment extends AccountingAuditFields {
  id: string;
  tipo: AccountingPartyType;
  facturaId: string;
  numeroFactura: string;
  terceroId: string;
  terceroNombre: string;
  monto: number;
  moneda: AccountingCurrency;
  metodo: AccountingPaymentMethod;
  fechaPago: Timestamp;
  notas?: string;
  comprobantePath?: string;
}

export interface ApplyAccountingPaymentInput {
  tipo: AccountingPartyType;
  facturaId: string;
  ownerId: string;
  empresaId: string;
  createdBy: string;
  monto: number;
  metodo: AccountingPaymentMethod;
  fechaPago: AccountingDate;
  notas?: string;
  comprobantePath?: string;
}

export interface AccountingTotals {
  total: number;
  vencido: number;
  venceHoy: number;
  proximoAVencer: number;
  pagado: number;
  cantidad: number;
}

export interface AccountingInvoiceFilters {
  tipo: AccountingPartyType;
  ownerId: string;
  empresaId: string;
  estado?: AccountingInvoiceStatus;
}

export interface AccountingCustomer extends AccountingAuditFields {
  id: string;
  nombre: string;
  identificacion?: string;
  correo?: string;
  telefono?: string;
  ruta?: string;
  departamento?: string;
  activo: boolean;
}

export type CreateAccountingCustomerInput = Omit<
  AccountingCustomer,
  "id" | "createdAt" | "updatedAt"
>;
