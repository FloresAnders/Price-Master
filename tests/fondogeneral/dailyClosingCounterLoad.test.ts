import { describe, expect, it } from "vitest";

import { resolveFondoGeneralCounterLoad } from "@/app/fondogeneral/utils/closing/dailyClosingCounterLoad";

describe("resolveFondoGeneralCounterLoad", () => {
  it("returns the denomination counts from the linked Fondo General counter", () => {
    const result = resolveFondoGeneralCounterLoad(
      [
        {
          name: "Contador libre",
          bills: { 1000: 99 },
          extraAmount: 0,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        },
        {
          accountId: "FondoGeneral",
          name: "Fondo General",
          bills: { 20000: 3, 1000: 4 },
          extraAmount: 250,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        },
      ],
      { CRC: 64250, USD: 0 },
    );

    expect(result).toEqual({
      currency: "CRC",
      counts: {
        20000: "3",
        10000: "",
        5000: "",
        2000: "",
        1000: "4",
        500: "",
        100: "",
        50: "",
        25: "",
      },
    });
  });

  it("returns null when the linked Fondo General counter does not exist", () => {
    expect(
      resolveFondoGeneralCounterLoad(
        [
          {
            name: "Contador libre",
            bills: {},
            extraAmount: 0,
            currency: "CRC",
            aperturaCaja: 0,
            ventaActual: 0,
          },
        ],
        { CRC: 0, USD: 0 },
      ),
    ).toBeNull();
  });

  it("returns null when the linked counter total and Fondo General balance differ", () => {
    expect(
      resolveFondoGeneralCounterLoad(
        [
          {
            accountId: "FondoGeneral",
            name: "Fondo General",
            bills: { 20000: 3, 1000: 4 },
            extraAmount: 250,
            currency: "CRC",
            aperturaCaja: 0,
            ventaActual: 0,
          },
        ],
        { CRC: 64000, USD: 0 },
      ),
    ).toBeNull();
  });
});
