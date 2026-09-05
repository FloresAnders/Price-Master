import { describe, expect, it } from "vitest";
import {
  resolveFcrPaymentAmounts,
  roundFcrCashToThousandFloor,
} from "@/app/fondogeneral/utils/fondo/fcrPaymentAmounts";

describe("resolveFcrPaymentAmounts (abono / pago completo de FCR)", () => {
  it("redondea hacia abajo a la unidad de mil solo al saldar por completo (₡15,766 → ₡15,000 + ₡766 redondeo)", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15766,
      creditNotesTotal: 0,
      enteredAmount: 15766,
      mode: "full",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.isFullSettlement).toBe(true);
    expect(resolved.cashDebit).toBe(15000);
    expect(resolved.roundingAbsorbed).toBe(766);
    expect(resolved.totalAppliedToInvoice).toBe(15766);
  });

  it("permite pagar el saldo completo digitado como abono (monto = saldo): se salda con redondeo al guardar", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15766,
      creditNotesTotal: 0,
      enteredAmount: 15766,
      mode: "partial",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.isFullSettlement).toBe(true);
    expect(resolved.cashDebit).toBe(15000);
    expect(resolved.roundingAbsorbed).toBe(766);
    expect(resolved.totalAppliedToInvoice).toBe(15766);
  });

  it("abono de ₡5,766 sobre saldo ₡15,766: debita ₡5,000, absorbe ₡766 y deja el saldo en ₡10,000", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15766,
      creditNotesTotal: 0,
      enteredAmount: 5766,
      mode: "partial",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.isFullSettlement).toBe(false);
    expect(resolved.cashDebit).toBe(5000);
    expect(resolved.roundingAbsorbed).toBe(766);
    expect(resolved.totalAppliedToInvoice).toBe(5766);
    expect(15766 - resolved.totalAppliedToInvoice).toBe(10000);
  });

  it("abono mayor al múltiplo de 1.000 pero menor al saldo: redondea el efectivo y aplica el monto completo", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15766,
      creditNotesTotal: 0,
      enteredAmount: 15500,
      mode: "partial",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.isFullSettlement).toBe(false);
    expect(resolved.cashDebit).toBe(15000);
    expect(resolved.roundingAbsorbed).toBe(500);
    expect(resolved.totalAppliedToInvoice).toBe(15500);
  });

  it("un abono múltiplo de 1.000 no genera redondeo", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15766,
      creditNotesTotal: 0,
      enteredAmount: 5000,
      mode: "partial",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.isFullSettlement).toBe(false);
    expect(resolved.cashDebit).toBe(5000);
    expect(resolved.roundingAbsorbed).toBe(0);
    expect(resolved.totalAppliedToInvoice).toBe(5000);
  });

  it("no redondea pagos en USD", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15766,
      creditNotesTotal: 0,
      enteredAmount: 15766,
      mode: "full",
      currency: "USD",
      accountKey: "FondoGeneral",
    });

    expect(resolved.cashDebit).toBe(15766);
    expect(resolved.roundingAbsorbed).toBe(0);
    expect(resolved.totalAppliedToInvoice).toBe(15766);
  });

  it("no redondea cuentas distintas a FondoGeneral", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15766,
      creditNotesTotal: 0,
      enteredAmount: 15766,
      mode: "full",
      currency: "CRC",
      accountKey: "CajaNegra",
    });

    expect(resolved.cashDebit).toBe(15766);
    expect(resolved.roundingAbsorbed).toBe(0);
  });

  it("no deja redondeo cuando el saldo ya es múltiplo de 1.000", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15000,
      creditNotesTotal: 0,
      enteredAmount: 15000,
      mode: "full",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.cashDebit).toBe(15000);
    expect(resolved.roundingAbsorbed).toBe(0);
    expect(resolved.totalAppliedToInvoice).toBe(15000);
  });

  it("al pagar completo con notas de crédito solo redondea el efectivo restante", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 15766,
      creditNotesTotal: 766,
      enteredAmount: 15766,
      mode: "partial",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.isFullSettlement).toBe(true);
    expect(resolved.cashDebit).toBe(15000);
    expect(resolved.roundingAbsorbed).toBe(0);
    expect(resolved.totalAppliedToInvoice).toBe(15766);
  });

  it("toma en cuenta los decimales: saldo ₡14.999,9 pagado completo debita ₡14.000 y absorbe ₡999,9", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 14999.9,
      creditNotesTotal: 0,
      enteredAmount: 14999.9,
      mode: "full",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.isFullSettlement).toBe(true);
    expect(resolved.cashDebit).toBe(14000);
    expect(resolved.roundingAbsorbed).toBe(999.9);
    expect(resolved.totalAppliedToInvoice).toBe(14999.9);
  });

  it("un abono con decimales menor al saldo deja el residuo pendiente", () => {
    const resolved = resolveFcrPaymentAmounts({
      balance: 14999.9,
      creditNotesTotal: 0,
      enteredAmount: 14999,
      mode: "partial",
      currency: "CRC",
      accountKey: "FondoGeneral",
    });

    expect(resolved.isFullSettlement).toBe(false);
    expect(resolved.cashDebit).toBe(14000);
    expect(resolved.roundingAbsorbed).toBe(999);
    expect(resolved.totalAppliedToInvoice).toBe(14999);
    expect(14999.9 - resolved.totalAppliedToInvoice).toBeCloseTo(0.9);
  });

  it("redondeo a la unidad de mil respeta el tope y el redondeo hacia abajo", () => {
    expect(roundFcrCashToThousandFloor(15766, "CRC", "FondoGeneral")).toBe(15000);
    expect(roundFcrCashToThousandFloor(5766, "CRC", "FondoGeneral")).toBe(5000);
    expect(roundFcrCashToThousandFloor(17560, "CRC", "FondoGeneral")).toBe(17000);
    expect(roundFcrCashToThousandFloor(17560, "USD", "FondoGeneral")).toBe(17560);
    expect(roundFcrCashToThousandFloor(17560, "CRC", "BCR")).toBe(17560);
  });
});
