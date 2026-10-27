import { describe, expect, it } from "vitest";

import { reconcileClosing } from "@/domain/reconciliation";

const previousClosing = () =>
  reconcileClosing({
    r08: 1_000,
    t11: 2_000,
    tucanCumulative: 10_000,
    tiemposCumulative: 20_000,
    isFinalShift: false,
  });

describe("validacion de reportes acumulados del cierre", () => {
  it("identifica el valor digitado cuando solo Tiempos es menor al acumulado anterior", () => {
    expect(() =>
      reconcileClosing({
        r08: 1_000,
        t11: 2_000,
        tucanCumulative: 10_500,
        tiemposCumulative: 19_500,
        previous: previousClosing(),
        isFinalShift: true,
      }),
    ).toThrow(
      "REPORTE ACUMULADO ACTUAL NO PUEDE SER MENOR AL ANTERIOR.\n" +
        "El acumulado de tiempos no puede ser 19500\n" +
        "REVISAR LOS ACUMULADOS EN LAS PAGINAS CORRESPONDIENTES.",
    );
  });

  it("identifica el valor digitado cuando solo Tucan es menor al acumulado anterior", () => {
    expect(() =>
      reconcileClosing({
        r08: 1_000,
        t11: 2_000,
        tucanCumulative: 9_500,
        tiemposCumulative: 20_500,
        previous: previousClosing(),
        isFinalShift: true,
      }),
    ).toThrow(
      "REPORTE ACUMULADO ACTUAL NO PUEDE SER MENOR AL ANTERIOR.\n" +
        "El acumulado de tucan no puede ser 9500\n" +
        "REVISAR LOS ACUMULADOS EN LAS PAGINAS CORRESPONDIENTES.",
    );
  });

  it("muestra ambos valores digitados cuando Tiempos y Tucan son menores", () => {
    expect(() =>
      reconcileClosing({
        r08: 1_000,
        t11: 2_000,
        tucanCumulative: 9_500,
        tiemposCumulative: 19_500,
        previous: previousClosing(),
        isFinalShift: true,
      }),
    ).toThrow(
      "REPORTE ACUMULADO ACTUAL NO PUEDE SER MENOR AL ANTERIOR.\n" +
        "El acumulado de tiempos no puede ser 19500\n" +
        "El acumulado de tucan no puede ser 9500\n" +
        "REVISAR LOS ACUMULADOS EN LAS PAGINAS CORRESPONDIENTES.",
    );
  });
});
