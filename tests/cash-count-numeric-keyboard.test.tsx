// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ copyToClipboard: vi.fn(async () => true) }),
}));

import DailyClosingModal from "@/app/fondogeneral/components/modals/DailyClosingModal";
import CashOpeningModal from "@/app/fondogeneral/components/modals/CashOpeningModal";
import { CashCounter } from "@/components/business/cash-counter-tabs/components/CashCounter";

describe("teclado numerico en los conteos de efectivo", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it("lo solicita en los inputs de denominaciones del contador", () => {
    render(
      <CashCounter
        id={0}
        data={{
          name: "Caja 1",
          currency: "CRC",
          bills: {},
          extraAmount: 0,
          aperturaCaja: 0,
          ventaActual: 0,
        }}
        showBD={false}
        onUpdate={vi.fn()}
      />,
    );

    const quantityInput = screen
      .getByRole("button", { name: "-₡ 20 000" })
      .parentElement?.querySelector("input");

    expect(quantityInput?.inputMode).toBe("numeric");
  });

  it("lo solicita en los inputs de denominaciones del cierre de Fondo General", () => {
    render(
      <DailyClosingModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn(async () => null)}
        employees={[]}
        loadingEmployees={false}
        currentBalanceCRC={0}
        currentBalanceUSD={0}
        cierreFondoVentasMinutesBeforeEnd={0}
        cierreFondoVentasMinutesAfterEnd={0}
        systemVerificationEnabled={false}
        turno="D"
      />,
    );

    expect(
      (screen.getByLabelText("Cantidad 20000 colones") as HTMLInputElement)
        .inputMode,
    ).toBe("numeric");
    expect(
      (screen.getByLabelText("Cantidad 100 dólares") as HTMLInputElement)
        .inputMode,
    ).toBe("numeric");
  });

  it("lo solicita en los inputs de denominaciones de la apertura de Fondo General", () => {
    render(
      <CashOpeningModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        employees={[]}
        loadingEmployees={false}
        currentBalanceCRC={0}
        currentBalanceUSD={0}
        persistDraft={false}
      />,
    );

    expect(
      (screen.getByLabelText("Cantidad 20000 colones") as HTMLInputElement)
        .inputMode,
    ).toBe("numeric");
    expect(
      (screen.getByLabelText("Cantidad 100 dólares") as HTMLInputElement)
        .inputMode,
    ).toBe("numeric");
  });
});
