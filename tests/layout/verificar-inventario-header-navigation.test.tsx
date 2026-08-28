/** @vitest-environment jsdom */

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/layout/Header";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
    href: string;
  }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        window.history.pushState({}, "", href);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

vi.mock("@/components/ui/FloatingActionsDock", () => ({
  useFloatingAction: () => undefined,
}));

vi.mock("@/services/layoutPrefsDb", () => ({
  getLayoutPref: vi.fn().mockResolvedValue(undefined),
  setLayoutPref: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("acceso móvil a verificar inventario", () => {
  it("notifica el cambio de hash cuando se abre desde el inicio", async () => {
    window.history.replaceState({}, "", "/");
    const onHashChange = vi.fn();
    window.addEventListener("hashchange", onHashChange, { once: true });

    render(<Header />);

    fireEvent.click(screen.getByTitle("Verificar inventario"));

    await waitFor(() => {
      expect(window.location.hash).toBe("#verificarinventario");
      expect(onHashChange).toHaveBeenCalledOnce();
    });
  });
});
