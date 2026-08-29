import { describe, expect, it } from "vitest";
import {
  isFacturaPendingForClosing,
  withFacturaPendingForClosing,
  type FacturaMovement,
} from "@/services/facturas";

const movement = (
  overrides: Partial<FacturaMovement> = {},
): FacturaMovement => ({
  id: "FAC-1",
  empresa: "ACME",
  accountId: "FondoGeneral",
  amount: 100,
  amountEgreso: 100,
  amountIngreso: 0,
  createdAt: "2026-08-29T10:00:00.000Z",
  currency: "CRC",
  invoiceNumber: "1001",
  manager: "Ana",
  notes: "",
  invoiceDocType: "FCR",
  paymentType: "COMPRA INVENTARIO",
  providerCode: "0001",
  paymentStatus: "PENDIENTE",
  ...overrides,
});

describe("pending invoice projection", () => {
  it("keeps unpaid and partially paid FCR documents pending", () => {
    expect(isFacturaPendingForClosing(movement())).toBe(true);
    expect(
      isFacturaPendingForClosing(
        movement({ paidAmount: 40, balanceDue: 60, paymentStatus: "PARCIAL" }),
      ),
    ).toBe(true);
  });

  it("closes paid and rebated FCR documents regardless of stale balances", () => {
    expect(
      isFacturaPendingForClosing(
        movement({ balanceDue: 100, paymentStatus: "PAGADA" }),
      ),
    ).toBe(false);
    expect(
      isFacturaPendingForClosing(
        movement({ balanceDue: 100, paymentStatus: "REBAJADA" }),
      ),
    ).toBe(false);
  });

  it("never indexes cash invoices", () => {
    expect(
      isFacturaPendingForClosing(movement({ invoiceDocType: "FCO" })),
    ).toBe(false);
  });

  it("indexes credit notes with balance and the zero-amount pending case", () => {
    expect(
      isFacturaPendingForClosing(
        movement({
          invoiceDocType: "NC",
          originalAmount: 100,
          paidAmount: 25,
          balanceDue: 75,
        }),
      ),
    ).toBe(true);
    expect(
      isFacturaPendingForClosing(
        movement({ invoiceDocType: "NC", amount: 0, originalAmount: 0 }),
      ),
    ).toBe(true);
  });

  it("treats negative credit-note amounts as their absolute balance", () => {
    expect(
      isFacturaPendingForClosing(
        movement({ invoiceDocType: "NC", amount: -100 }),
      ),
    ).toBe(true);
  });

  it("does not index malformed numeric FCR values", () => {
    expect(
      isFacturaPendingForClosing(
        movement({ amount: Number.NaN, originalAmount: Number.NaN }),
      ),
    ).toBe(false);
  });

  it("adds the derived flag without mutating the input", () => {
    const input = movement({ balanceDue: 0, paymentStatus: "PAGADA" });
    const projected = withFacturaPendingForClosing(input);

    expect(projected).toEqual({ ...input, isPendingForClosing: false });
    expect(input).not.toHaveProperty("isPendingForClosing");
  });
});
