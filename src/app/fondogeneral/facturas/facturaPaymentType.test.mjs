import assert from "node:assert/strict";
import test from "node:test";

import { resolveFacturaPaymentType } from "./facturaPaymentType.ts";

test("unpaid FCR and NC use pending payment type until fully paid", () => {
  assert.equal(resolveFacturaPaymentType("PENDIENTE"), "PENDIENTE");
  assert.equal(resolveFacturaPaymentType("PARCIAL"), "PENDIENTE");
});

test("fully paid or rebajada FCR and NC use compra inventario payment type", () => {
  assert.equal(resolveFacturaPaymentType("PAGADA"), "COMPRA INVENTARIO");
  assert.equal(resolveFacturaPaymentType("REBAJADA"), "COMPRA INVENTARIO");
});
