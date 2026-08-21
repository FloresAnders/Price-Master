import { describe, expect, it } from "vitest";

import { validateSingleClosingReason } from "@/app/fondogeneral/utils/closing/singleClosingReason";

describe("validateSingleClosingReason", () => {
  it.each([
    "CXJDFHVCNVJFJC",
    "FHHFDNKJFDFJHFJFJGBGJGHKJKY",
    "XKZJCHKXCHXCHHKUCHDHDHCDBCBBC",
    "ggfdfddhfggfhghjhjkjhgjvgffgy",
    "JTJFHGRDDDDTDDRR",
  ])("rechaza texto aleatorio de una sola palabra: %s", (reason) => {
    expect(validateSingleClosingReason(reason).valid).toBe(false);
  });

  it.each([
    "jhjhjh cierre caja dinero",
    "dddd no se pudo cerrar la caja",
    "brt crj skl por caja",
    "cierre caja abcdefghijklmnop",
  ])("rechaza patrones que aparentan ser una frase: %s", (reason) => {
    expect(validateSingleClosingReason(reason).valid).toBe(false);
  });

  it.each([
    "Solo se realizó un cierre por falta de personal",
    "No hubo turno nocturno por incapacidad",
    "El local cerró temprano por feriado nacional",
    "NO PUDIMOS CERRAR CAJA Y SE TRABAJO SOLO CON UNA CAJA POR QUE HABIA MUCHO DINERO QUE PAGAR DE AGENTES Y NO HABIA SUFICIENTE EFECTIVO SE NECESITO EL DINERO DE FONDO DE CAJA POR ESO ESTA EN NEGATIVO",
  ])("acepta un motivo de cierre escrito en español: %s", (reason) => {
    expect(validateSingleClosingReason(reason).valid).toBe(true);
  });

  it("permite un nombre propio cuando el resto del motivo es reconocible", () => {
    expect(
      validateSingleClosingReason(
        "Se necesitó el efectivo para pagar al agente Talamanca",
      ).valid,
    ).toBe(true);
  });

  it.each(["", "cierre único", "solo caja"])(
    "rechaza motivos demasiado cortos: %s",
    (reason) => {
      expect(validateSingleClosingReason(reason).valid).toBe(false);
    },
  );
});
