import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import app, { db, storage } from "@/config/firebase";
import type {
  AccountingDate,
  AccountingCustomer,
  AccountingInvoice,
  AccountingInvoiceFilters,
  AccountingInvoiceStatus,
  AccountingPartyType,
  AccountingPayment,
  AccountingTotals,
  ApplyAccountingPaymentInput,
  CreateAccountingInvoiceInput,
  CreateAccountingCustomerInput,
} from "@/types/accounting";

const INVOICE_COLLECTION = {
  cliente: "facturas_clientes",
  proveedor: "facturas_proveedores",
} as const;
const PAYMENT_COLLECTION = {
  cliente: "pagos_clientes",
  proveedor: "pagos_proveedores",
} as const;

const toTimestamp = (value: AccountingDate): Timestamp => {
  if (value instanceof Timestamp) return value;
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) throw new Error("Fecha no válida.");
  return Timestamp.fromDate(date);
};

const text = (value: unknown, max = 200): string =>
  String(value ?? "").trim().slice(0, max);

const positiveAmount = (value: unknown, label: string): number => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} debe ser mayor que cero.`);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const costaRicaDateKey = (value: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

export const deriveInvoiceStatus = (
  monto: number,
  pagado: number,
  fechaVencimiento: AccountingDate,
  now = new Date(),
): AccountingInvoiceStatus => {
  const total = Math.max(0, Number(monto) || 0);
  const paid = Math.max(0, Number(pagado) || 0);
  if (paid >= total && total > 0) return "Pagada";
  const due = toTimestamp(fechaVencimiento).toDate();
  if (costaRicaDateKey(due) < costaRicaDateKey(now)) return "Vencida";
  return paid > 0 ? "Parcial" : "Pendiente";
};

const invoiceFromDoc = (id: string, data: DocumentData): AccountingInvoice => ({
  ...(data as Omit<AccountingInvoice, "id">),
  id,
});

const paymentFromDoc = (id: string, data: DocumentData): AccountingPayment => ({
  ...(data as Omit<AccountingPayment, "id">),
  id,
});

export const subscribeInvoices = (
  filters: AccountingInvoiceFilters,
  onData: (invoices: AccountingInvoice[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const constraints = [
    where("ownerId", "==", filters.ownerId),
    where("empresaId", "==", filters.empresaId),
  ];
  if (filters.estado) constraints.push(where("estado", "==", filters.estado));
  const q = query(
    collection(db, INVOICE_COLLECTION[filters.tipo]),
    ...constraints,
    orderBy("fechaVencimiento", "asc"),
  );
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((item) => invoiceFromDoc(item.id, item.data()))),
    (error) => onError?.(error),
  );
};

export const subscribePayments = (
  filters: Pick<AccountingInvoiceFilters, "tipo" | "ownerId" | "empresaId"> & {
    terceroId?: string;
  },
  onData: (payments: AccountingPayment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const constraints = [
    where("ownerId", "==", filters.ownerId),
    where("empresaId", "==", filters.empresaId),
  ];
  if (filters.terceroId) constraints.push(where("terceroId", "==", filters.terceroId));
  const q = query(
    collection(db, PAYMENT_COLLECTION[filters.tipo]),
    ...constraints,
    orderBy("fechaPago", "desc"),
  );
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((item) => paymentFromDoc(item.id, item.data()))),
    (error) => onError?.(error),
  );
};

export const createInvoice = async (
  input: CreateAccountingInvoiceInput,
): Promise<string> => {
  const monto = positiveAmount(input.monto, "El monto");
  const fechaEmision = toTimestamp(input.fechaEmision);
  const fechaVencimiento = toTimestamp(input.fechaVencimiento);
  if (fechaVencimiento.toMillis() < fechaEmision.toMillis()) {
    throw new Error("La fecha de vencimiento no puede ser anterior a la emisión.");
  }
  if (!text(input.numero, 80) || !text(input.terceroId, 120) || !text(input.terceroNombre)) {
    throw new Error("Número y cliente/proveedor son obligatorios.");
  }
  const data = {
    tipo: input.tipo,
    ownerId: text(input.ownerId, 128),
    empresaId: text(input.empresaId, 128),
    createdBy: text(input.createdBy, 128),
    numero: text(input.numero, 80),
    terceroId: text(input.terceroId, 120),
    terceroNombre: text(input.terceroNombre),
    ruta: text(input.ruta, 120),
    departamento: text(input.departamento, 120),
    notas: text(input.notas, 2000),
    fechaEmision,
    fechaVencimiento,
    monto,
    pagado: 0,
    saldo: monto,
    estado: deriveInvoiceStatus(monto, 0, fechaVencimiento),
    moneda: input.moneda === "USD" ? "USD" : "CRC",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!data.ownerId || !data.empresaId || !data.createdBy) {
    throw new Error("Propietario, empresa y creador son obligatorios.");
  }
  const created = await addDoc(collection(db, INVOICE_COLLECTION[input.tipo]), data);
  return created.id;
};

export const updateInvoice = async (
  tipo: AccountingPartyType,
  id: string,
  patch: Partial<Pick<AccountingInvoice, "numero" | "terceroId" | "terceroNombre" | "ruta" | "departamento" | "fechaEmision" | "fechaVencimiento" | "notas">>,
): Promise<void> => {
  const data: DocumentData = { updatedAt: serverTimestamp() };
  for (const key of ["numero", "terceroId", "terceroNombre", "ruta", "departamento", "notas"] as const) {
    if (patch[key] !== undefined) data[key] = text(patch[key], key === "notas" ? 2000 : 200);
  }
  if (patch.fechaEmision) data.fechaEmision = toTimestamp(patch.fechaEmision);
  if (patch.fechaVencimiento) data.fechaVencimiento = toTimestamp(patch.fechaVencimiento);
  await updateDoc(doc(db, INVOICE_COLLECTION[tipo], id), data);
};

export const deleteInvoice = async (tipo: AccountingPartyType, id: string): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const invoiceRef = doc(db, INVOICE_COLLECTION[tipo], id);
    const snapshot = await tx.get(invoiceRef);
    if (!snapshot.exists()) return;
    if (Number(snapshot.data().pagado || 0) > 0) {
      throw new Error("No se puede eliminar una factura con pagos aplicados.");
    }
    tx.delete(invoiceRef);
  });
};

/** Pago seguro vía callable. Requiere Firebase Auth antes de habilitar pagos en UI. */
export const applyPaymentClient = async (
  input: ApplyAccountingPaymentInput,
): Promise<string> => {
  const call = httpsCallable<
    Omit<ApplyAccountingPaymentInput, "ownerId" | "createdBy" | "fechaPago"> & { fechaPago: string },
    { success: boolean; paymentId: string }
  >(getFunctions(app, "us-central1"), "applyAccountingPayment");
  const response = await call({
    tipo: input.tipo,
    facturaId: input.facturaId,
    empresaId: input.empresaId,
    monto: positiveAmount(input.monto, "El pago"),
    metodo: input.metodo,
    fechaPago: toTimestamp(input.fechaPago).toDate().toISOString(),
    notas: text(input.notas, 2000),
    comprobantePath: text(input.comprobantePath, 500),
  });
  return response.data.paymentId;
};

export const uploadPaymentReceipt = async (args: {
  ownerId: string;
  empresaId: string;
  tipo: AccountingPartyType;
  facturaId: string;
  file: Blob;
  fileName: string;
}): Promise<{ path: string; url: string }> => {
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160);
  const path = `accounting/${args.ownerId}/${args.empresaId}/${args.tipo}/${args.facturaId}/${Date.now()}-${safeName}`;
  const target = ref(storage, path);
  await uploadBytes(target, args.file, { contentType: args.file.type || "application/octet-stream" });
  return { path, url: await getDownloadURL(target) };
};

export const calculateAccountingTotals = (
  invoices: AccountingInvoice[],
  now = new Date(),
  upcomingDays = 7,
): AccountingTotals => {
  const today = costaRicaDateKey(now);
  const endDate = new Date(now.getTime() + upcomingDays * 86_400_000);
  const end = costaRicaDateKey(endDate);
  return invoices.reduce<AccountingTotals>((totals, invoice) => {
    const due = costaRicaDateKey(invoice.fechaVencimiento.toDate());
    totals.total += invoice.saldo;
    totals.pagado += invoice.pagado;
    totals.cantidad += 1;
    if (invoice.saldo > 0 && due < today) totals.vencido += invoice.saldo;
    if (invoice.saldo > 0 && due === today) totals.venceHoy += invoice.saldo;
    if (invoice.saldo > 0 && due > today && due <= end) totals.proximoAVencer += invoice.saldo;
    return totals;
  }, { total: 0, vencido: 0, venceHoy: 0, proximoAVencer: 0, pagado: 0, cantidad: 0 });
};

export const subscribeCustomers = (
  filters: { ownerId: string; empresaId: string },
  onData: (customers: AccountingCustomer[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(
    collection(db, "clientes"),
    where("ownerId", "==", filters.ownerId),
    where("empresaId", "==", filters.empresaId),
    orderBy("nombre", "asc"),
  );
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((item) => ({
      ...(item.data() as Omit<AccountingCustomer, "id">),
      id: item.id,
    })));
  }, (error) => onError?.(error));
};

export const createCustomer = async (input: CreateAccountingCustomerInput): Promise<string> => {
  const nombre = text(input.nombre);
  if (!nombre || !text(input.ownerId, 128) || !text(input.empresaId, 128) || !text(input.createdBy, 128)) {
    throw new Error("Nombre, propietario, empresa y creador son obligatorios.");
  }
  const created = await addDoc(collection(db, "clientes"), {
    ownerId: text(input.ownerId, 128),
    empresaId: text(input.empresaId, 128),
    createdBy: text(input.createdBy, 128),
    nombre,
    identificacion: text(input.identificacion, 80),
    correo: text(input.correo, 254),
    telefono: text(input.telefono, 40),
    ruta: text(input.ruta, 120),
    departamento: text(input.departamento, 120),
    activo: input.activo !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return created.id;
};

export const updateCustomer = async (
  id: string,
  patch: Partial<Pick<AccountingCustomer, "nombre" | "identificacion" | "correo" | "telefono" | "ruta" | "departamento" | "activo">>,
): Promise<void> => {
  const data: DocumentData = { updatedAt: serverTimestamp() };
  for (const key of ["nombre", "identificacion", "correo", "telefono", "ruta", "departamento"] as const) {
    if (patch[key] !== undefined) data[key] = text(patch[key], key === "correo" ? 254 : 200);
  }
  if (patch.activo !== undefined) data.activo = patch.activo;
  await updateDoc(doc(db, "clientes", id), data);
};

export const deleteCustomer = (id: string): Promise<void> =>
  deleteDoc(doc(db, "clientes", id));
