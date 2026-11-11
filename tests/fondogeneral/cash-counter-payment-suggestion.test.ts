import { describe, expect, it } from "vitest";
import type { CashCounterSnapshot } from "@/services/cashCounterDb";
import {
  applyFondoGeneralPaymentSuggestionToSnapshot,
  buildFondoGeneralPaymentSuggestion,
} from "@/components/business/cash-counter-tabs/paymentSuggestion";

const snapshot = (bills: Record<number, number>): CashCounterSnapshot => ({
  counters: [
    {
      accountId: "FondoGeneral",
      name: "Fondo General",
      currency: "CRC",
      bills,
      extraAmount: 0,
      aperturaCaja: 0,
      ventaActual: 0,
    },
  ],
  activeTab: 0,
  lastSaved: "2026-11-09T12:00:00.000Z",
  revision: 0,
});

describe("sugerencia de billetes para pagos del Fondo General", () => {
  it("recomienda de mayor a menor solo el multiplo de mil debitado", () => {
    const current = snapshot({
      25: 0,
      50: 160,
      100: 100,
      500: 0,
      1000: 40,
      2000: 0,
      5000: 51,
      10000: 81,
      20000: 12,
    });

    const suggestion = buildFondoGeneralPaymentSuggestion({
      snapshot: current,
      currentBalance: 1_363_000,
      paymentAmount: 27_000,
    });

    expect(suggestion).toMatchObject({
      accountId: "FondoGeneral",
      expectedCounterTotal: 1_363_000,
      amount: 27_000,
      bills: { 20000: 1, 5000: 1, 1000: 2 },
    });
  });

  it("no sugiere cuando el contador no coincide con el saldo del Fondo General", () => {
    expect(
      buildFondoGeneralPaymentSuggestion({
        snapshot: snapshot({ 20000: 1, 5000: 1, 1000: 2 }),
        currentBalance: 28_000,
        paymentAmount: 27_000,
      }),
    ).toBeNull();
  });

  it("encuentra una combinacion exacta sin recomendar billetes inexistentes", () => {
    const suggestion = buildFondoGeneralPaymentSuggestion({
      snapshot: snapshot({ 5000: 1, 2000: 3 }),
      currentBalance: 11_000,
      paymentAmount: 6_000,
    });

    expect(suggestion?.bills).toEqual({ 2000: 3 });
  });

  it("sugiere el subtotal inferior mas cercano e indica cuanto debe cambiar", () => {
    const current = snapshot({ 20000: 1, 10000: 1 });

    const suggestion = buildFondoGeneralPaymentSuggestion({
      snapshot: current,
      currentBalance: 30_000,
      paymentAmount: 25_000,
    });

    expect(suggestion).toMatchObject({
      amount: 25_000,
      suggestedAmount: 20_000,
      changeRequired: 5_000,
      bills: { 20000: 1 },
    });

    const result = applyFondoGeneralPaymentSuggestionToSnapshot(
      current,
      suggestion!,
    );
    expect(result.applied).toBe(true);
    expect(result.snapshot.counters[0].bills).toEqual({
      20000: 0,
      10000: 1,
    });
  });

  it("permite sugerir billetes para total con diferencia menor a mil", () => {
    const current = snapshot({ 20000: 1, 10000: 1, 2000: 2 });

    const suggestion = buildFondoGeneralPaymentSuggestion({
      snapshot: current,
      currentBalance: 34_000,
      paymentAmount: 4_100,
    });

    expect(suggestion).toMatchObject({
      amount: 4_100,
      suggestedAmount: 4_000,
      changeRequired: 100,
      bills: { 2000: 2 },
    });
  });

  it("descuenta exactamente la sugerencia y conserva cientos y monedas", () => {
    const current = snapshot({
      50: 160,
      100: 100,
      1000: 40,
      5000: 51,
      10000: 81,
      20000: 12,
    });
    const suggestion = buildFondoGeneralPaymentSuggestion({
      snapshot: current,
      currentBalance: 1_363_000,
      paymentAmount: 27_000,
    });

    expect(suggestion).not.toBeNull();
    const result = applyFondoGeneralPaymentSuggestionToSnapshot(
      current,
      suggestion!,
    );

    expect(result.applied).toBe(true);
    expect(result.snapshot.counters[0].bills).toEqual({
      50: 160,
      100: 100,
      1000: 38,
      5000: 50,
      10000: 81,
      20000: 11,
    });
  });

  it("rechaza un conteo cuyas denominaciones cambiaron aunque conserve el mismo total", () => {
    const original = snapshot({ 20000: 2, 10000: 1 });
    const suggestion = buildFondoGeneralPaymentSuggestion({
      snapshot: original,
      currentBalance: 50_000,
      paymentAmount: 20_000,
    });
    const sameTotalWithDifferentBills = snapshot({ 20000: 1, 10000: 3 });

    expect(suggestion).not.toBeNull();
    expect(
      applyFondoGeneralPaymentSuggestionToSnapshot(
        sameTotalWithDifferentBills,
        suggestion!,
      ).applied,
    ).toBe(false);
  });
});
