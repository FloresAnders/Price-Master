import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useVersion", () => ({
  useVersion: () => ({ version: "test", isLocalNewer: false }),
}));

import sitemap from "@/app/sitemap";
import { isPublicRoute } from "@/components/auth/publicRoutes";
import Footer from "@/components/layout/Footer";

const LEGAL_PATHS = [
  "/about",
  "/privacy/gmail-sinpe",
  "/privacy/encabezado-impresion",
  "/terms",
];

describe("páginas públicas legales de TimeMaster", () => {
  it("permite abrir las páginas informativas sin iniciar sesión", () => {
    for (const path of LEGAL_PATHS) {
      expect(isPublicRoute(path)).toBe(true);
    }
    expect(isPublicRoute("/fondogeneral")).toBe(false);
  });

  it("publica las páginas legales en el sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain("https://www.timemaster.es/about");
    expect(urls).toContain("https://www.timemaster.es/privacy/gmail-sinpe");
    expect(urls).toContain(
      "https://www.timemaster.es/privacy/encabezado-impresion",
    );
    expect(urls).toContain("https://www.timemaster.es/terms");
  });

  it("ofrece enlaces visibles a las páginas legales en el pie", () => {
    const html = renderToStaticMarkup(<Footer />);

    expect(html).toContain('href="/about"');
    expect(html).toContain('href="/privacy/gmail-sinpe"');
    expect(html).toContain('href="/privacy/encabezado-impresion"');
    expect(html).toContain('href="/terms"');
  });
});
