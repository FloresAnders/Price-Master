import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useVersion", () => ({
  useVersion: () => ({ version: "test", isLocalNewer: false }),
}));

import sitemap from "@/app/sitemap";
import AboutTimeMasterPage from "@/app/about/page";
import GmailSinpePrivacyPage from "@/app/privacy/gmail-sinpe/page";
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

  it("explica el propósito de Gmail y excluye explícitamente AI NCII", () => {
    const aboutHtml = renderToStaticMarkup(<AboutTimeMasterPage />);
    const privacyHtml = renderToStaticMarkup(<GmailSinpePrivacyPage />);

    expect(aboutHtml).toContain("Propósito del acceso a las APIs de Google");
    expect(aboutHtml).toContain("únicamente para detectar correos");
    expect(aboutHtml).toContain("AI NCII");
    expect(aboutHtml).toContain("imágenes o videos íntimos no consensuados");
    expect(privacyHtml).toContain("AI NCII");
    expect(privacyHtml).toContain("imágenes o videos íntimos no consensuados");
  });
});
