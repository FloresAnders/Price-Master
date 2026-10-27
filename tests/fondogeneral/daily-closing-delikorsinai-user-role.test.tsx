// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ copyToClipboard: vi.fn(async () => true) }),
}));

import DailyClosingModal from "@/app/fondogeneral/components/modals/DailyClosingModal";

const DELIKOR_SINAI_USER = {
  company: "DELIKOR SINAI",
  role: "user" as const,
  manager: "ARIANNA",
  turno: "N" as const,
};

const CRC_CLOSING =
  'TIME_MASTER:{"currency":"CRC","bills":{"25":0,"50":0,"100":0,"500":0,"1000":195,"2000":0,"5000":0,"10000":0,"20000":0}}';
const USD_CLOSING =
  'TIME_MASTER:{"currency":"USD","bills":{"1":88,"5":0,"10":0,"20":0,"50":0,"100":0}}';
const NOTES =
  "CIERRE SIN DATOS PROPORCIONADOS PARA REALIZAR CORRECTAMENTE";
const SINGLE_CLOSING_REASON =
  "NO HUBO CIERRE DIURNO POR FALTA DE DATOS";

describe("cierre diario del rol user de DELIKOR SINAI", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("guarda el cierre unico nocturno exacto del dia operativo 19/20", async () => {
    const onConfirm = vi.fn(async () => null);

    render(
      <DailyClosingModal
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        employees={[DELIKOR_SINAI_USER.manager]}
        loadingEmployees={false}
        managerReadonly={DELIKOR_SINAI_USER.role === "user"}
        currentBalanceCRC={195_000}
        currentBalanceUSD={88}
        turno={DELIKOR_SINAI_USER.turno}
        requireTurnoSelection={false}
        requireSingleClosingReason
        cierreFondoVentasMinutesBeforeEnd={0}
        cierreFondoVentasMinutesAfterEnd={0}
        systemVerificationEnabled
        initialValues={{
          closingDate: "2026-10-20T06:13:13.264Z",
          manager: DELIKOR_SINAI_USER.manager,
          notes: "",
          totalCRC: 0,
          totalUSD: 0,
          breakdownCRC: {},
          breakdownUSD: {},
          turno: DELIKOR_SINAI_USER.turno,
          r08: 0,
          t11: 0,
          tucanCumulative: 0,
          tiemposCumulative: 0,
        }}
      />,
    );

    const manager = screen.getByRole("combobox");
    expect(manager).toHaveProperty("disabled", true);
    expect(screen.queryByText("Seleccionar turno")).toBeNull();

    fireEvent.paste(screen.getByLabelText("Cantidad 1000 colones"), {
      clipboardData: { getData: () => CRC_CLOSING },
    });
    fireEvent.paste(screen.getByLabelText("Cantidad 1 d\u00f3lares"), {
      clipboardData: { getData: () => USD_CLOSING },
    });

    const verification = screen
      .getByText("Verificacion Contica / Tucan / Tiempos")
      .closest("section")!;
    const verificationInputs = within(verification).getAllByRole("textbox");
    fireEvent.paste(verificationInputs[0], {
      clipboardData: {
        getData: () => "200000\n200000\n200000\n200000",
      },
    });

    fireEvent.change(screen.getByPlaceholderText("Notas adicionales del cierre"), {
      target: { value: NOTES },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe el motivo/), {
      target: { value: SINGLE_CLOSING_REASON },
    });
    const saveButton = screen.getByRole("button", { name: "Guardar cierre" });
    expect({
      disabled: (saveButton as HTMLButtonElement).disabled,
      reason: screen.queryByRole("tooltip")?.textContent,
    }).toEqual({ disabled: false, reason: undefined });
    fireEvent.click(saveButton);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    expect(onConfirm).toHaveBeenCalledWith({
      closingDate: "2026-10-20T06:13:13.264Z",
      manager: DELIKOR_SINAI_USER.manager,
      notes: NOTES,
      singleClosingReason: SINGLE_CLOSING_REASON,
      noMovements: false,
      noMovementsReason: "",
      totalCRC: 195_000,
      totalUSD: 88,
      breakdownCRC: {
        20_000: 0,
        10_000: 0,
        5_000: 0,
        2_000: 0,
        1_000: 195,
        500: 0,
        100: 0,
        50: 0,
        25: 0,
      },
      breakdownUSD: {
        100: 0,
        50: 0,
        20: 0,
        10: 0,
        5: 0,
        1: 88,
      },
      turno: "N",
      r08: 200_000,
      t11: 200_000,
      tucanCumulative: 200_000,
      tiemposCumulative: 200_000,
    });
  });

  it("conserva el turno automatico N despues de limpiar y volver a llenar", async () => {
    const onConfirm = vi.fn(async () => null);

    render(
      <DailyClosingModal
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        employees={[DELIKOR_SINAI_USER.manager]}
        loadingEmployees={false}
        managerReadonly
        currentBalanceCRC={30_000}
        currentBalanceUSD={88}
        turno="N"
        requireTurnoSelection={false}
        requireSingleClosingReason
        cierreFondoVentasMinutesBeforeEnd={0}
        cierreFondoVentasMinutesAfterEnd={0}
        systemVerificationEnabled
        initialValues={{
          closingDate: "2026-10-21T05:46:24.590Z",
          manager: DELIKOR_SINAI_USER.manager,
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

    fireEvent.click(screen.getByRole("button", { name: "Limpiar conteo" }));
    fireEvent.paste(screen.getByLabelText("Cantidad 10000 colones"), {
      clipboardData: {
        getData: () =>
          'TIME_MASTER:{"currency":"CRC","bills":{"25":0,"50":0,"100":0,"500":0,"1000":0,"2000":0,"5000":0,"10000":3,"20000":0}}',
      },
    });
    fireEvent.paste(screen.getByLabelText("Cantidad 1 d\u00f3lares"), {
      clipboardData: {
        getData: () =>
          'TIME_MASTER:{"currency":"USD","bills":{"1":8,"5":0,"10":0,"20":4,"50":0,"100":0}}',
      },
    });

    const verification = screen
      .getByText("Verificacion Contica / Tucan / Tiempos")
      .closest("section")!;
    const verificationInputs = within(verification).getAllByRole("textbox");
    fireEvent.paste(verificationInputs[0], {
      clipboardData: {
        getData: () => "85023\n21600\n85023\n21600",
      },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe el motivo/), {
      target: { value: "FONDOS INSUFICIENTES TURNO DIURNO" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar cierre" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
      turno: "N",
      manager: DELIKOR_SINAI_USER.manager,
      totalCRC: 30_000,
      totalUSD: 88,
    });
  });

  it("bloquea el guardado cuando no existe turno aunque el selector este oculto", () => {
    render(
      <DailyClosingModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn(async () => null)}
        employees={[DELIKOR_SINAI_USER.manager]}
        loadingEmployees={false}
        managerReadonly
        currentBalanceCRC={30_000}
        currentBalanceUSD={88}
        requireTurnoSelection={false}
        cierreFondoVentasMinutesBeforeEnd={0}
        cierreFondoVentasMinutesAfterEnd={0}
        systemVerificationEnabled={false}
        initialValues={{
          closingDate: "2026-10-21T05:46:24.590Z",
          manager: DELIKOR_SINAI_USER.manager,
          notes: "",
          totalCRC: 0,
          totalUSD: 0,
          breakdownCRC: {},
          breakdownUSD: {},
          r08: 0,
          t11: 0,
          tucanCumulative: 0,
          tiemposCumulative: 0,
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Cantidad 10000 colones"), {
      target: { value: "3" },
    });

    expect(screen.getByRole("button", { name: "Guardar cierre" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("muestra en el bloqueo los acumulados digitados y no los del turno D", () => {
    const closingDate = "2026-10-21T05:46:24.590Z";
    window.localStorage.setItem(
      "fondogeneral-daily-closing-tucan-turno-d-2026-10-21",
      "10001",
    );
    window.localStorage.setItem(
      "fondogeneral-daily-closing-tiempos-turno-d-2026-10-21",
      "10001",
    );

    render(
      <DailyClosingModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn(async () => null)}
        employees={[DELIKOR_SINAI_USER.manager]}
        loadingEmployees={false}
        managerReadonly
        currentBalanceCRC={5_000}
        currentBalanceUSD={0}
        turno="N"
        requireTurnoSelection={false}
        cierreFondoVentasMinutesBeforeEnd={0}
        cierreFondoVentasMinutesAfterEnd={0}
        systemVerificationEnabled
        initialValues={{
          closingDate,
          manager: DELIKOR_SINAI_USER.manager,
          notes: "",
          totalCRC: 5_000,
          totalUSD: 0,
          breakdownCRC: { 5_000: 1 },
          breakdownUSD: {},
          turno: "N",
          r08: 5_000,
          t11: 5_000,
          tucanCumulative: 5_000,
          tiemposCumulative: 5_000,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Guardar cierre" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("tooltip").textContent).toBe(
      "REPORTE ACUMULADO ACTUAL NO PUEDE SER MENOR AL ANTERIOR.\n" +
        "El acumulado de tiempos no puede ser ₡ 5\u00a0000\n" +
        "El acumulado de tucan no puede ser ₡ 5\u00a0000\n" +
        "REVISAR LOS ACUMULADOS EN LAS PAGINAS CORRESPONDIENTES.",
    );
    expect(screen.getByRole("tooltip").textContent).not.toContain("10\u00a0001");
  });

  it("usa el encargado autoritativo cuando el campo es de solo lectura", () => {
    window.localStorage.setItem(
      "fondogeneral-daily-closing-modal-draft",
      JSON.stringify({ manager: "ARIANNA" }),
    );

    render(
      <DailyClosingModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn(async () => null)}
        employees={["ARIANNA", "FABIAN"]}
        loadingEmployees={false}
        managerReadonly
        currentBalanceCRC={30_000}
        currentBalanceUSD={88}
        turno="N"
        requireTurnoSelection={false}
        cierreFondoVentasMinutesBeforeEnd={0}
        cierreFondoVentasMinutesAfterEnd={0}
        systemVerificationEnabled={false}
        initialValues={{
          closingDate: "2026-10-21T05:46:24.590Z",
          manager: "FABIAN",
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

    expect(screen.getByRole("combobox")).toHaveProperty("value", "FABIAN");
  });
});
