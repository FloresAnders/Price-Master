import { createRequire } from "node:module";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const requireModule = createRequire(import.meta.url);
const corePath = resolve(
  "extensions/EncabezadoImpresion/settings-core.js",
);

describe("EncabezadoImpresion settings", () => {
  it("recupera una configuración corrupta con valores seguros", () => {
    const { normalizeSettings } = requireModule(corePath);

    expect(
      normalizeSettings({
        schemaVersion: 99,
        imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        maxCharacters: 20,
        lines: ["No conservar"],
        juntaOrigin: "https://junta.test",
      }),
    ).toEqual({
      schemaVersion: 1,
      imageDataUrl: "",
      maxCharacters: 40,
      lines: [],
      juntaOrigin: "",
    });
  });

  it("conserva el orden, recorta bordes y omite líneas vacías", () => {
    const { normalizeSettings } = requireModule(corePath);

    expect(
      normalizeSettings({
        maxCharacters: 20,
        lines: ["  Uno ", " ", "Dos"],
      }).lines,
    ).toEqual([
      { text: "Uno", fontFamily: "Arial", fontSize: 14 },
      { text: "Dos", fontFamily: "Arial", fontSize: 14 },
    ]);
  });

  it("conserva fuente y tamaño por línea dentro de los límites", () => {
    const { normalizeSettings } = requireModule(corePath);

    expect(
      normalizeSettings({
        maxCharacters: 40,
        lines: [
          { text: "  Título  ", fontFamily: "Segoe Script", fontSize: 24 },
          { text: "Teléfono", fontFamily: "", fontSize: 99 },
        ],
      }).lines,
    ).toEqual([
      { text: "Título", fontFamily: "Segoe Script", fontSize: 24 },
      { text: "Teléfono", fontFamily: "Arial", fontSize: 14 },
    ]);
  });

  it("rechaza límites y líneas que no caben", () => {
    const { validateDraft } = requireModule(corePath);

    expect(
      validateDraft({ maxCharacters: 4, lines: ["Cinco"] }),
    ).toMatchObject({
      ok: false,
      errors: ["La línea 1 supera el límite de 4 caracteres."],
    });
    expect(validateDraft({ maxCharacters: 201, lines: [] }).ok).toBe(false);
  });

  it("rechaza tamaños de fuente fuera del rango de impresión", () => {
    const { validateDraft } = requireModule(corePath);

    expect(
      validateDraft({
        maxCharacters: 40,
        lines: [{ text: "Título", fontFamily: "Arial", fontSize: 49 }],
      }),
    ).toMatchObject({
      ok: false,
      errors: ["El tamaño de la línea 1 debe estar entre 8 y 48 px."],
    });
  });

  it("solo conserva data URLs de PNG, JPEG y WebP", () => {
    const { normalizeSettings } = requireModule(corePath);

    expect(
      normalizeSettings({ imageDataUrl: "data:text/html;base64,WA==" })
        .imageDataUrl,
    ).toBe("");
    expect(
      normalizeSettings({
        imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }).imageDataUrl,
    ).toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});
