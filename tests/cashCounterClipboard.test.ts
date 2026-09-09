import { describe, expect, it } from "vitest";

import {
  parseCashCountClipboard,
  serializeCashCountClipboard,
} from "@/components/business/cash-counter-tabs/utils";

describe("transferencia de denominaciones del contador", () => {
  it("completa el bloque CRC con cantidades copiadas", () => {
    const payload = 'TIME_MASTER:{"currency":"CRC","bills":{"25":0,"50":0,"100":0,"500":0,"1000":4,"2000":0,"5000":3,"10000":0,"20000":2}}';
    expect(parseCashCountClipboard(payload)).toEqual({
      currency: "CRC",
      bills: {
        20000: 2,
        10000: 0,
        5000: 3,
        2000: 0,
        1000: 4,
        500: 0,
        100: 0,
        50: 0,
        25: 0,
      },
    });
  });

  it("conserva la moneda y todas las cantidades al copiar y pegar", () => {
    const copied = serializeCashCountClipboard("CRC", {
      20000: 2,
      10000: 0,
      5000: 3,
      2000: 1,
      1000: 4,
      500: 5,
      100: 6,
      50: 7,
      25: 8,
    });

    expect(parseCashCountClipboard(copied)).toEqual({
      currency: "CRC",
      bills: {
        20000: 2,
        10000: 0,
        5000: 3,
        2000: 1,
        1000: 4,
        500: 5,
        100: 6,
        50: 7,
        25: 8,
      },
    });
  });

  it("completa con cero las denominaciones omitidas", () => {
    const copied = serializeCashCountClipboard("USD", { 100: 2, 20: 4 });

    expect(parseCashCountClipboard(copied)).toEqual({
      currency: "USD",
      bills: { 100: 2, 50: 0, 20: 4, 10: 0, 5: 0, 1: 0 },
    });
  });

  it.each([
    "texto normal",
    "",
    'TIME_MASTER:{"currency":"EUR","bills":{"20":2}}',
    'TIME_MASTER:{"currency":"CRC","bills":{"20000":-1}}',
    'TIME_MASTER:{"currency":"USD","bills":{"2":4}}',
  ])("rechaza datos incompatibles sin convertirlos en cantidades: %s", (value) => {
    expect(parseCashCountClipboard(value)).toBeNull();
  });
});
