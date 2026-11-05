// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClosingBalanceDisplay } from "@/app/fondogeneral/components/ClosingBalanceDisplay";

afterEach(cleanup);

describe("saldo del cierre de Fondo General", () => {
  it("despliega las denominaciones y copia el bloque compatible con los contadores", async () => {
    const copyToClipboard = vi.fn().mockResolvedValue(true);

    render(
      <ClosingBalanceDisplay
        currencyEnabled={{ CRC: true, USD: true }}
        closingCRC={2500}
        closingUSD={20}
        breakdownCRC={{ 1000: 2, 500: 1 }}
        breakdownUSD={{ 20: 1 }}
        formatByCurrency={(currency, amount) => `${currency} ${amount}`}
        copyToClipboard={copyToClipboard}
      />,
    );

    const crcToggle = screen.getByRole("button", {
      name: "Desplegar denominaciones CRC",
    });
    expect(crcToggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("button", { name: "Copiar denominaciones CRC" }),
    ).toBeNull();

    fireEvent.click(crcToggle);

    expect(crcToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("500x1 · 1000x2")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Copiar denominaciones USD" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Copiar denominaciones CRC" }),
    );

    await waitFor(() =>
      expect(copyToClipboard).toHaveBeenCalledWith(
        'TIME_MASTER:{"currency":"CRC","bills":{"25":0,"50":0,"100":0,"500":1,"1000":2,"2000":0,"5000":0,"10000":0,"20000":0}}',
      ),
    );
    expect(screen.getByText("Copiado")).toBeTruthy();
  });

  it("no inventa un bloque de ceros cuando el cierre no tiene desglose guardado", () => {
    const copyToClipboard = vi.fn().mockResolvedValue(true);

    render(
      <ClosingBalanceDisplay
        currencyEnabled={{ CRC: true, USD: false }}
        closingCRC={2500}
        closingUSD={0}
        breakdownCRC={null}
        breakdownUSD={null}
        formatByCurrency={(currency, amount) => `${currency} ${amount}`}
        copyToClipboard={copyToClipboard}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Desplegar denominaciones CRC" }),
    );

    expect(screen.getByText("Denominaciones no disponibles")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Copiar denominaciones CRC" }),
    ).toBeNull();
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it("muestra el error cuando el portapapeles rechaza la copia", async () => {
    const copyToClipboard = vi
      .fn()
      .mockRejectedValue(new Error("clipboard denied"));
    const onCopyError = vi.fn();

    render(
      <ClosingBalanceDisplay
        currencyEnabled={{ CRC: true, USD: false }}
        closingCRC={1000}
        closingUSD={0}
        breakdownCRC={{ 1000: 1 }}
        breakdownUSD={{}}
        formatByCurrency={(currency, amount) => `${currency} ${amount}`}
        copyToClipboard={copyToClipboard}
        onCopyError={onCopyError}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Desplegar denominaciones CRC" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copiar denominaciones CRC" }),
    );

    await waitFor(() => expect(onCopyError).toHaveBeenCalledOnce());
    expect(screen.queryByText("Copiado")).toBeNull();
  });
});
