// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CashCounter } from "@/components/business/cash-counter-tabs/components/CashCounter";

const { copyToClipboard } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ copyToClipboard }),
}));

const renderCounter = () =>
  render(
    <CashCounter
      id={0}
      data={{
        name: "Fondo General",
        bills: { 20000: 2 },
        extraAmount: 0,
        currency: "CRC",
        aperturaCaja: 40000,
        ventaActual: 0,
      }}
      showBD={false}
      onUpdate={vi.fn()}
    />,
  );

describe("CashCounter copy button", () => {
  beforeEach(() => {
    copyToClipboard.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows visible and accessible confirmation after copying denominations", async () => {
    copyToClipboard.mockResolvedValue(true);
    renderCounter();

    fireEvent.click(
      screen.getByRole("button", { name: "Copiar denominaciones" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Copiado");
    });
  });

  it("shows visible and accessible failure without replacing it with an alert", async () => {
    copyToClipboard.mockResolvedValue(false);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderCounter();

    fireEvent.click(
      screen.getByRole("button", { name: "Copiar denominaciones" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "No se pudo copiar",
      );
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
