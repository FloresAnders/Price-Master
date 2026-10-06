// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ copyToClipboard: vi.fn(async () => true) }),
}));

import DailyClosingModal from "@/app/fondogeneral/components/modals/DailyClosingModal";

describe("modal obligatorio de cierre nocturno pendiente", () => {
  afterEach(cleanup);

  it("no permite cerrarlo con Escape después del vencimiento", () => {
    const onClose = vi.fn();
    render(
      <DailyClosingModal
        open
        dismissible={false}
        onClose={onClose}
        onConfirm={vi.fn(async () => null)}
        employees={[]}
        loadingEmployees={false}
        currentBalanceCRC={0}
        currentBalanceUSD={0}
        cierreFondoVentasMinutesBeforeEnd={0}
        cierreFondoVentasMinutesAfterEnd={45}
        systemVerificationEnabled={false}
        turno="N"
        initialValues={{
          closingDate: "2026-10-06T04:43:23.045Z",
          manager: "MEGAN",
          notes: "",
          totalCRC: 0,
          totalUSD: 0,
          breakdownCRC: {},
          breakdownUSD: {},
          turno: "N",
          r08: 0,
          t11: 0,
          tucanCumulative: 0,
          tiemposCumulative: 0,
        }}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByText(/cierre N del día anterior está pendiente/i),
    ).toBeTruthy();
  });
});
