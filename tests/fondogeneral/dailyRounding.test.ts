import { describe, expect, it } from "vitest";

import {
  calculateFondoGeneralDailyRounding,
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
});
