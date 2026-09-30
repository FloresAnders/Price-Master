import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const extensionRoot = resolve("extensions/EncabezadoImpresion");

function readPngDimensions(relativePath: string) {
  const png = readFileSync(resolve(extensionRoot, relativePath));
  expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe("paquete Encabezado de impresión", () => {
  it("habilita Tucán y el generador fijo de Junta sin permisos opcionales", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(extensionRoot, "manifest.json"), "utf8"),
    );

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["storage", "fontSettings"]);
    expect(manifest.host_permissions).toEqual([
      "https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/*",
      "https://puntosventa.jpsenlinea.go.cr/*",
    ]);
    expect(manifest.host_permissions).not.toContain("<all_urls>");
    expect(manifest).not.toHaveProperty("optional_host_permissions");
    expect(manifest.content_scripts[0]).toMatchObject({
      matches: [
        "https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/*",
        "https://puntosventa.jpsenlinea.go.cr/PS.ODB.ODBHandlers/Receipt/Generate*",
      ],
      js: ["settings-core.js", "print-core.js", "print-content.js"],
      css: ["print-content.css"],
      run_at: "document_start",
      match_about_blank: true,
    });
  });

  it("incluye todos los archivos referenciados y un icono 128 por 128", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(extensionRoot, "manifest.json"), "utf8"),
    );
    const referenced = [
      manifest.action.default_popup,
      manifest.action.default_icon["128"],
      ...manifest.content_scripts.flatMap(
        (entry: { js?: string[]; css?: string[] }) => [
          ...(entry.js || []),
          ...(entry.css || []),
        ],
      ),
      "image-core.js",
      "popup.css",
      "README.txt",
    ];

    for (const relativePath of referenced) {
      expect(existsSync(resolve(extensionRoot, relativePath))).toBe(true);
    }
    expect(readPngDimensions("icon128.png")).toEqual({
      width: 128,
      height: 128,
    });
    expect(existsSync(resolve(extensionRoot, "site-access.js"))).toBe(false);
  });

  it("documenta el acceso fijo de Junta y los límites de validación real", () => {
    const readme = readFileSync(
      resolve(extensionRoot, "README.txt"),
      "utf8",
    );
    const normalized = readme.replace(/\s+/g, " ");

    expect(readme).toContain("puntosventa.jpsenlinea.go.cr");
    expect(readme).not.toContain("Autorizar sitio de Junta");
    expect(readme).toContain("about:blank");
    expect(readme).toContain("impresora térmica");
    expect(normalized).toContain("condiciones no verificadas");
  });
});
