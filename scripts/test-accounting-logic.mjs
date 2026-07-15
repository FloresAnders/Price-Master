import assert from "node:assert/strict";
import {
  applyPaymentAmounts,
  calculateTotals,
  costaRicaDateKey,
  costaRicaDayContext,
  deriveInvoiceStatus,
  normalizeCurrency,
  validatePayment,
} from "../functions/accounting-core.js";

const now = new Date("2026-07-15T12:00:00-06:00");

assert.deepEqual(validatePayment({ amount: 25, balance: 100 }), { valid: true, amount: 25 });
assert.equal(validatePayment({ amount: 101, balance: 100 }).valid, false);
assert.equal(validatePayment({ amount: 0, balance: 100 }).valid, false);
assert.equal(normalizeCurrency("USD"), "USD");
assert.equal(normalizeCurrency("EUR"), "CRC");
assert.equal(deriveInvoiceStatus({ total: 100, paid: 100, dueAt: "2026-07-01", now }), "Pagada");
assert.equal(deriveInvoiceStatus({ total: 100, paid: 25, dueAt: "2026-07-20", now }), "Parcial");
assert.equal(deriveInvoiceStatus({ total: 100, paid: 0, dueAt: "2026-07-14", now }), "Vencida");
assert.equal(
  deriveInvoiceStatus({
    total: 100,
    paid: 0,
    dueAt: "2026-07-15",
    now: new Date("2026-07-16T05:59:59.999Z"),
  }),
  "Pendiente",
);
assert.equal(
  deriveInvoiceStatus({
    total: 100,
    paid: 0,
    dueAt: "2026-07-15",
    now: new Date("2026-07-16T06:00:00.000Z"),
  }),
  "Vencida",
);
assert.equal(costaRicaDateKey(new Date("2026-07-16T05:59:59.999Z")), "2026-07-15");
assert.deepEqual(costaRicaDayContext(new Date("2026-07-16T12:00:00Z")), {
  dateKey: "2026-07-16",
  start: new Date("2026-07-16T06:00:00.000Z"),
});

assert.deepEqual(
  applyPaymentAmounts({ total: 125, paid: 25, amount: 40, dueAt: "2026-07-20", now }),
  { amount: 40, paid: 65, balance: 60, status: "Parcial" },
);

assert.deepEqual(
  applyPaymentAmounts({ total: 0.3, paid: 0.1, amount: 0.2, dueAt: "2026-07-20", now }),
  { amount: 0.2, paid: 0.3, balance: 0, status: "Pagada" },
);
assert.equal(validatePayment({ amount: 100.001, balance: 100 }).valid, true);

assert.deepEqual(calculateTotals([
  { saldo: 100, pagado: 0, fechaVencimiento: "2026-07-14" },
  { saldo: 50, pagado: 50, fechaVencimiento: "2026-07-15" },
  { saldo: 75, pagado: 25, fechaVencimiento: "2026-07-18" },
], now), {
  total: 225,
  vencido: 100,
  venceHoy: 50,
  proximoAVencer: 75,
  pagado: 75,
  cantidad: 3,
});

console.log("Accounting logic: OK");
