import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type WebAppManifest = {
  id?: string;
  lang?: string;
  dir?: string;
  background_color?: string;
  categories?: string[];
  shortcuts?: Array<{
    name: string;
    short_name: string;
    description: string;
    url: string;
  }>;
  scope?: string;
};

async function loadManifest(): Promise<WebAppManifest> {
  const source = await readFile(
    resolve(process.cwd(), "public/site.webmanifest"),
    "utf8",
  );
  return JSON.parse(source) as WebAppManifest;
}

describe("Time Master web app manifest", () => {
  it("has stable identity and Spanish Costa Rica metadata", async () => {
    const manifest = await loadManifest();

    expect(manifest).toMatchObject({
      id: "/",
      lang: "es-CR",
      dir: "ltr",
      background_color: "#0d1117",
      categories: ["business", "finance", "productivity"],
    });
  });

  it("exposes only real in-scope shortcuts", async () => {
    const manifest = await loadManifest();

    expect(manifest.shortcuts).toEqual([
      {
        name: "Inicio",
        short_name: "Inicio",
        description: "Abrir el inicio de Time Master",
        url: "/home",
      },
      {
        name: "Fondo General",
        short_name: "Fondos",
        description: "Abrir la gestión de Fondo General",
        url: "/fondogeneral",
      },
    ]);
    expect(
      manifest.shortcuts?.every((shortcut) =>
        shortcut.url.startsWith(manifest.scope ?? "/"),
      ),
    ).toBe(true);
  });

  it("serves manifest updates with forced revalidation", async () => {
    const { default: nextConfig } = await import("../../next.config");
    const entries = await nextConfig.headers?.();

    expect(entries).toContainEqual({
      source: "/site.webmanifest",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, must-revalidate",
        },
      ],
    });
  });
});
