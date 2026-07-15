import admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  applyPaymentAmounts,
  costaRicaDayContext,
  normalizeCurrency,
  PAYMENT_METHODS,
} from "./accounting-core.js";

const COLLECTIONS = {
  cliente: { invoices: "facturas_clientes", payments: "pagos_clientes" },
  proveedor: { invoices: "facturas_proveedores", payments: "pagos_proveedores" },
};

const getDb = () => admin.firestore().databaseId === "restauracion"
  ? admin.firestore()
  : admin.app().firestore("restauracion");

const clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);

const requireAuth = (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Autenticación requerida.");
  const role = clean(request.auth.token.role).toLowerCase();
  if (!["admin", "superadmin", "administrador", "contador"].includes(role)) {
    throw new HttpsError("permission-denied", "Rol sin acceso al módulo contable.");
  }
  return request.auth.uid;
};

const canAccessEmpresa = (token, empresaId) => {
  if (clean(token.empresaId, 128) === empresaId) return true;
  return Array.isArray(token.empresaIds) && token.empresaIds.some(
    (candidate) => clean(candidate, 128) === empresaId,
  );
};

export const applyAccountingPayment = onCall(
  { region: "us-central1" },
  async (request) => {
    const uid = requireAuth(request);
    const data = request.data ?? {};
    const tipo = data.tipo;
    if (!COLLECTIONS[tipo]) throw new HttpsError("invalid-argument", "Tipo de factura inválido.");
    const facturaId = clean(data.facturaId, 160);
    const empresaId = clean(data.empresaId, 128);
    const metodo = clean(data.metodo, 40).toLowerCase();
    if (!facturaId || !empresaId || !PAYMENT_METHODS.includes(metodo)) {
      throw new HttpsError("invalid-argument", "Factura, empresa y método son obligatorios.");
    }
    if (!canAccessEmpresa(request.auth.token, empresaId)) {
      throw new HttpsError("permission-denied", "Empresa fuera de sus permisos.");
    }
    const db = getDb();
    const invoiceRef = db.collection(COLLECTIONS[tipo].invoices).doc(facturaId);
    const paymentRef = db.collection(COLLECTIONS[tipo].payments).doc();
    try {
      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(invoiceRef);
        if (!snapshot.exists) throw new HttpsError("not-found", "La factura no existe.");
        const invoice = snapshot.data();
        const ownerId = clean(request.auth.token.ownerId, 128) || uid;
        if (invoice.ownerId !== ownerId || invoice.empresaId !== empresaId) {
          throw new HttpsError("permission-denied", "Factura fuera de su empresa.");
        }
        const dueAt = invoice.fechaVencimiento?.toDate?.() ?? invoice.fechaVencimiento;
        const next = applyPaymentAmounts({
          total: invoice.monto,
          paid: invoice.pagado,
          amount: data.monto,
          dueAt,
        });
        const paymentDate = data.fechaPago ? new Date(data.fechaPago) : new Date();
        if (Number.isNaN(paymentDate.getTime())) {
          throw new HttpsError("invalid-argument", "Fecha de pago inválida.");
        }
        tx.create(paymentRef, {
          tipo,
          facturaId,
          numeroFactura: clean(invoice.numero, 80),
          terceroId: clean(invoice.terceroId, 120),
          terceroNombre: clean(invoice.terceroNombre),
          ownerId,
          empresaId,
          createdBy: uid,
          monto: next.amount,
          moneda: normalizeCurrency(invoice.moneda),
          metodo,
          fechaPago: admin.firestore.Timestamp.fromDate(paymentDate),
          notas: clean(data.notas, 2000),
          comprobantePath: clean(data.comprobantePath, 500),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(invoiceRef, {
          pagado: next.paid,
          saldo: next.balance,
          estado: next.status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      return { success: true, paymentId: paymentRef.id };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (String(error?.message || "").includes("saldo")) {
        throw new HttpsError("failed-precondition", error.message);
      }
      console.error("[applyAccountingPayment]", error);
      throw new HttpsError("internal", "No se pudo aplicar el pago.");
    }
  },
);

export const refreshAccountingDueStatuses = onSchedule(
  { schedule: "every day 06:00", timeZone: "America/Costa_Rica", region: "us-central1" },
  async () => {
    const db = getDb();
    const now = new Date();
    const { dateKey, start } = costaRicaDayContext(now);
    const startTimestamp = admin.firestore.Timestamp.fromDate(start);
    for (const [tipo, names] of Object.entries(COLLECTIONS)) {
      const snapshot = await db.collection(names.invoices)
        .where("saldo", ">", 0)
        .where("fechaVencimiento", "<", startTimestamp)
        .get();
      let batch = db.batch();
      let count = 0;
      for (const invoice of snapshot.docs) {
        if (invoice.get("estado") !== "Vencida") {
          batch.update(invoice.ref, {
            estado: "Vencida",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          count += 1;
        }
        const alertId = `${tipo}_${invoice.id}_${dateKey}`;
        batch.set(db.collection("accounting_alertas").doc(alertId), {
          tipo,
          facturaId: invoice.id,
          ownerId: invoice.get("ownerId"),
          empresaId: invoice.get("empresaId"),
          mensaje: `Factura ${clean(invoice.get("numero"), 80)} vencida`,
          estado: "pendiente",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        count += 1;
        if (count >= 400) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    }
  },
);
