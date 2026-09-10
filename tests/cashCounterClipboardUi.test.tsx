// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clipboard = vi.hoisted(() => ({
  copyToClipboard: vi.fn(async () => true),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ copyToClipboard: clipboard.copyToClipboard }),
}));

import DailyClosingModal from "@/app/fondogeneral/components/modals/DailyClosingModal";
import CashOpeningModal from "@/app/fondogeneral/components/modals/CashOpeningModal";
import { CashCounter } from "@/components/business/cash-counter-tabs/components/CashCounter";
import type { CashCounterData } from "@/components/business/cash-counter-tabs/types";

const counterData: CashCounterData = {
  name: "Caja 1",
  currency: "CRC",
  bills: { 20000: 1, 5000: 2 },
  extraAmount: 750,
  aperturaCaja: 10000,
  ventaActual: 15750,
};

describe("copiar y pegar denominaciones en el contador", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copia las cantidades y confirma la acción junto al estado", async () => {
    render(
      <CashCounter
        id={0}
        data={counterData}
        showBD={false}
        onUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Copiar denominaciones" }),
    );

    await waitFor(() => expect(clipboard.copyToClipboard).toHaveBeenCalledOnce());
    expect(clipboard.copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining("TIME_MASTER:"),
    );
    expect(screen.getByText("Copiado")).toBeTruthy();
  });

  it("reemplaza todas las cantidades al pegar datos de la misma moneda", () => {
    const onUpdate = vi.fn();
    render(
      <CashCounter
        id={3}
        data={counterData}
        showBD={false}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.paste(screen.getByLabelText("-₡ 20 000").parentElement!.querySelector("input")!, {
      clipboardData: {
        getData: () =>
          'TIME_MASTER:{"currency":"CRC","bills":{"25":8,"50":7,"100":6,"500":5,"1000":4,"2000":1,"5000":3,"10000":0,"20000":2}}',
      },
    });

    expect(onUpdate).toHaveBeenCalledWith(3, {
      ...counterData,
      bills: {
        20000: 2,
        10000: 0,
        5000: 3,
        2000: 1,
        1000: 4,
        500: 5,
        100: 6,
        50: 7,
        25: 8,
      },
    });
  });
});

describe("pegar denominaciones en el cierre diario", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reemplaza el bloque de la moneda copiada", () => {
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
        initialValues={{
          closingDate: "2026-09-09T12:00:00.000-06:00",
          manager: "Ana",
          notes: "",
          totalCRC: 90000,
          totalUSD: 0,
          breakdownCRC: { 20000: 4, 10000: 1 },
          breakdownUSD: {},
          turno: "D",
          r08: 0,
          t11: 0,
          tucanCumulative: 0,
          tiemposCumulative: 0,
        }}
      />,
    );

    fireEvent.paste(screen.getByLabelText("Cantidad 20000 colones"), {
      clipboardData: {
        getData: () =>
          'TIME_MASTER:{"currency":"CRC","bills":{"25":0,"50":0,"100":0,"500":0,"1000":4,"2000":0,"5000":3,"10000":0,"20000":2}}',
      },
    });

    expect(
      (screen.getByLabelText("Cantidad 20000 colones") as HTMLInputElement)
        .value,
    ).toBe("2");
    expect(
      (screen.getByLabelText("Cantidad 10000 colones") as HTMLInputElement)
        .value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Cantidad 5000 colones") as HTMLInputElement)
        .value,
    ).toBe("3");
    expect(
      (screen.getByLabelText("Cantidad 1000 colones") as HTMLInputElement)
        .value,
    ).toBe("4");
  });
});

describe("pegar denominaciones en la apertura de fondo", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reemplaza el bloque CRC con las cantidades copiadas de un contador", () => {
    render(
      <CashOpeningModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        employees={["Ana"]}
        loadingEmployees={false}
        currentBalanceCRC={0}
        currentBalanceUSD={0}
        persistDraft={false}
      />,
    );

    fireEvent.paste(screen.getByLabelText("Cantidad 20000 colones"), {
      clipboardData: {
        getData: () =>
          'TIME_MASTER:{"currency":"CRC","bills":{"25":200,"50":100,"100":300,"500":20,"1000":7,"2000":9,"5000":11,"10000":8,"20000":0}}',
      },
    });

    expect(
      (screen.getByLabelText("Cantidad 20000 colones") as HTMLInputElement)
        .value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Cantidad 10000 colones") as HTMLInputElement)
        .value,
    ).toBe("8");
    expect(
      (screen.getByLabelText("Cantidad 5000 colones") as HTMLInputElement)
        .value,
    ).toBe("11");
    expect(
      (screen.getByLabelText("Cantidad 25 colones") as HTMLInputElement)
        .value,
    ).toBe("200");
  });
});
