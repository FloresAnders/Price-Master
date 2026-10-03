import { describe, expect, it } from "vitest";

import {
  calculateFondoGeneralDailyRounding,
  resolveIndividualMovementRoundingAdjustment,
  resolveTotalMovementRoundingAdjustment,
} from "@/app/fondogeneral/utils/fondo/dailyRounding";
import type { FondoEntry } from "@/app/fondogeneral/types";
import { sanitizeFondoEntries } from "@/app/fondogeneral/utils/helpers";

const movement = (
  id: string,
  createdAt: string,
  roundingAdjustment: number,
): FondoEntry =>
  ({
    id,
    empresa: "EMPRESA PRUEBA",
    accountId: "FondoGeneral",
    providerCode: "0018",
    invoiceNumber: id,
    invoiceDocType: "FCO",
    paymentType: "COMPRA",
    amountEgreso: 0,
    amountIngreso: 10_000,
    manager: "Encargado",
    notes: "",
    createdAt,
    currency: "CRC",
    roundingAdjustment,
  }) as FondoEntry;

describe("redondeo diario del Fondo General", () => {
  it("calcula el día actual desde los movimientos cargados por la UI", () => {
    const result = calculateFondoGeneralDailyRounding(
      [
        movement("mov-1", "2026-10-02T18:00:00.000Z", -766),
        movement("mov-2", "2026-10-03T05:30:00.000Z", 234),
        movement("mov-old", "2026-10-01T18:00:00.000Z", 900),
      ],
      "2026-10-02",
    );

    expect(result).toEqual({ total: -532, movementCount: 2 });
  });

  it("cuenta como negativo el redondeo absorbido de un pago FCR", () => {
    const fcrPayment = {
      ...movement("fcr-pago-1", "2026-10-02T18:00:00.000Z", 0),
      invoiceDocType: "FCR" as const,
      amountEgreso: 5_000,
      amountIngreso: 0,
      roundingAdjustment: undefined,
      roundingAbsorbed: 766,
    };

    const result = calculateFondoGeneralDailyRounding(
      [fcrPayment],
      "2026-10-02",
    );

    expect(result).toEqual({
      total: -766,
      movementCount: 1,
    });
  });

  it("reconstruye el redondeo de un egreso FCO anterior al nuevo campo", () => {
    const legacyExpense = {
      ...movement("mov-legacy", "2026-10-02T20:00:00.000Z", 0),
      amountEgreso: 15_766,
      amountIngreso: 0,
      amountPayment: 15_000,
      roundingAdjustment: undefined,
    };

    const result = calculateFondoGeneralDailyRounding(
      [legacyExpense],
      "2026-10-02",
    );

    expect(result).toEqual({
      total: -766,
      movementCount: 1,
    });
  });

  it("conserva el ajuste firmado al hidratar movimientos guardados", () => {
    const [entry] = sanitizeFondoEntries([
      movement("mov-saved", "2026-10-02T20:00:00.000Z", -220),
    ]);

    expect(entry.roundingAdjustment).toBe(-220);
  });

  it("incluye la corrección aplicada al redondear el total del grupo", () => {
    const groupedEntry = {
      ...movement("mov-group", "2026-10-02T20:00:00.000Z", 454.86),
      totalRoundingAdjustment: -1_000,
    };

    const result = calculateFondoGeneralDailyRounding(
      [groupedEntry],
      "2026-10-02",
    );

    expect(result).toEqual({
      total: -545.14,
      movementCount: 1,
    });
  });

  it("separa el redondeo individual de la corrección del total en la tarjeta", () => {
    const groupedEntry = {
      ...movement("3333", "2026-10-03T17:38:00.000Z", 454.86),
      amountEgreso: 85_545.14,
      amountIngreso: 0,
      amountPayment: 87_000,
      totalRoundingAdjustment: 1_000,
    };

    expect(resolveIndividualMovementRoundingAdjustment(groupedEntry)).toBe(
      454.86,
    );
    expect(resolveTotalMovementRoundingAdjustment(groupedEntry)).toBe(1_000);
    expect(
      calculateFondoGeneralDailyRounding([groupedEntry], "2026-10-03"),
    ).toEqual({
      total: 1_454.86,
      movementCount: 1,
    });
  });

  it("explica el ajuste global asignado a una factura redondeada a cero", () => {
    const groupedEntry = {
      ...movement("0001", "2026-10-03T18:41:00.000Z", -500),
      amountEgreso: 500,
      amountIngreso: 0,
      amountPayment: 2_000,
      totalRoundingAdjustment: 2_000,
    };

    expect(resolveIndividualMovementRoundingAdjustment(groupedEntry)).toBe(-500);
    expect(resolveTotalMovementRoundingAdjustment(groupedEntry)).toBe(2_000);
    expect(
      calculateFondoGeneralDailyRounding([groupedEntry], "2026-10-03"),
    ).toEqual({
      total: 1_500,
      movementCount: 1,
    });
  });
});
