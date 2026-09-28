import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifestPath = resolve(
  process.cwd(),
  "extensions/TimeMasterHerramientas/manifest.json",
);

describe("paquete TimeMaster Herramientas", () => {
  it("declara solo los permisos, hosts y recursos aprobados", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(manifest).toMatchObject({
      manifest_version: 3,
      name: "TimeMaster Herramientas",
      version: "1.0.0",
      permissions: ["storage"],
      icons: { "128": "icon128.png" },
      action: { default_popup: "popup.html" },
    });
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest).not.toHaveProperty("host_permissions");
    expect(manifest.content_scripts).toEqual([
      {
        matches: ["https://contica.app/app/modules/punto_de_venta/*"],
        js: ["settings-core.js", "cambiotab-core.js", "contica-content.js"],
        run_at: "document_idle",
      },
      {
        matches: [
          "https://gentecrystal.net/controllers/sales/SalesController.php*",
        ],
        js: [
          "settings-core.js",
          "sumatiempos-core.js",
          "moverenter-core.js",
          "gentecrystal-content.js",
        ],
        css: ["gentecrystal-content.css"],
        run_at: "document_idle",
      },
    ]);
    expect(
      manifest.content_scripts.flatMap((entry: { js: string[] }) => entry.js),
    ).not.toContainEqual(expect.stringMatching(/^https?:\/\//));
  });
});
