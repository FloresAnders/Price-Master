// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { StrictMode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { useCashCounter } from "@/components/business/cash-counter-tabs/hooks/useCashCounter";
import { CashCounter } from "@/components/business/cash-counter-tabs/components/CashCounter";
import { RightPanel } from "@/components/business/cash-counter-tabs/components/RightPanel";

describe("atajos del historial del contador de efectivo", () => {
  beforeAll(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    window.localStorage.clear();
  });

  it("deshace, rehace y trata una pulsacion sostenida como un cambio", async () => {
    const { result } = renderHook(() => useCashCounter(), {
      wrapper: StrictMode,
    });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    const updateCount = (count: number, group?: string) => {
      const current = result.current.data[0];
      result.current.upd(
        0,
        { ...current, bills: { ...current.bills, 1000: count } },
        group,
      );
    };

    act(() => updateCount(1));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
    })));
    expect(result.current.data[0].bills[1000]).toBeUndefined();

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey: true,
    })));
    expect(result.current.data[0].bills[1000]).toBe(1);

    act(() => updateCount(2, "hold-1"));
    act(() => updateCount(3, "hold-1"));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
    })));
    expect(result.current.data[0].bills[1000]).toBe(1);

    act(() => result.current.upd(0, {
      ...result.current.data[0],
      bills: { 1000: 2 },
    }));
    act(() => result.current.replace(0, {
      ...result.current.data[0],
      bills: { 1000: 9 },
    }));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
    })));
    expect(result.current.data[0].bills[1000]).toBe(9);
  });

  it("envia el mismo grupo durante toda una pulsacion sostenida", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const { unmount } = render(
      <CashCounter
        id={0}
        data={{
          name: "Caja",
          bills: {},
          extraAmount: 0,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        }}
        showBD={false}
        onUpdate={onUpdate}
      />,
    );

    const increase = screen.getAllByRole("button", { name: /^\+/ })[0];
    fireEvent.pointerDown(increase, {
      isPrimary: true,
      button: 0,
      pointerId: 1,
    });
    act(() => vi.advanceTimersByTime(650));
    fireEvent.pointerUp(window);

    expect(onUpdate.mock.calls.length).toBeGreaterThan(1);
    const groups = onUpdate.mock.calls.map((call) => call[2]);
    expect(groups[0]).toEqual(expect.any(String));
    expect(new Set(groups).size).toBe(1);

    unmount();
    vi.useRealTimers();
  });

  it("no publica cambios al decrementar una denominacion que ya esta en cero", () => {
    const onUpdate = vi.fn();
    render(
      <CashCounter
        id={0}
        data={{
          name: "Caja",
          bills: {},
          extraAmount: 0,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        }}
        showBD={false}
        onUpdate={onUpdate}
      />,
    );

    const decrease = screen.getAllByRole("button", { name: /^-/ })[0];
    fireEvent.pointerDown(decrease, {
      isPrimary: true,
      button: 0,
      pointerId: 2,
    });
    fireEvent.pointerUp(window);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("restaura con Ctrl+Z el contador despues de confirmar la limpieza", async () => {
    const { result, unmount: unmountHook } = renderHook(
      () => useCashCounter(),
      { wrapper: StrictMode },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    const original = {
      ...result.current.data[0],
      bills: { 1000: 4 },
      extraAmount: 500,
      currency: "CRC" as const,
      aperturaCaja: 1000,
      ventaActual: 2000,
    };
    act(() => result.current.upd(0, original));

    const { container, unmount: unmountPanel } = render(
      <RightPanel
        data={result.current.data[0]}
        showExtra={false}
        setShowExtra={vi.fn()}
        showBD={false}
        setShowBD={vi.fn()}
        onUpdate={(next) => result.current.upd(0, next)}
        onReplace={(next) => result.current.replace(0, next)}
        onCurrencyOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(within(container).getByRole("button", { name: "Limpiar" }));
    const confirmations = within(container).getAllByRole("button", {
      name: "Limpiar",
    });
    fireEvent.click(confirmations[confirmations.length - 1]);

    expect(result.current.data[0].bills[1000]).toBe(0);
    expect(result.current.data[0].extraAmount).toBe(0);
    expect(result.current.data[0].aperturaCaja).toBe(0);
    expect(result.current.data[0].ventaActual).toBe(0);

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
      ),
    );

    expect(result.current.data[0].bills).toEqual({ 1000: 4 });
    expect(result.current.data[0].extraAmount).toBe(500);
    expect(result.current.data[0].aperturaCaja).toBe(1000);
    expect(result.current.data[0].ventaActual).toBe(2000);

    unmountPanel();
    unmountHook();
  });

  it("restaura con Ctrl+Z el contador anterior a una importacion", async () => {
    const { result, unmount: unmountHook } = renderHook(
      () => useCashCounter(),
      { wrapper: StrictMode },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    const original = {
      ...result.current.data[0],
      bills: { 1000: 4 },
      extraAmount: 500,
      currency: "CRC" as const,
      aperturaCaja: 1000,
      ventaActual: 2000,
    };
    act(() => result.current.upd(0, original));

    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    const { container, unmount: unmountPanel } = render(
      <RightPanel
        data={result.current.data[0]}
        showExtra={false}
        setShowExtra={vi.fn()}
        showBD={false}
        setShowBD={vi.fn()}
        onUpdate={(next) => result.current.upd(0, next)}
        onReplace={(next) => result.current.replace(0, next)}
        onCurrencyOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(within(container).getByRole("button", { name: "Importar" }));
    const fileInput = clickSpy.mock.instances[0] as HTMLInputElement | undefined;
    expect(fileInput).toBeDefined();
    const file = new File([
      JSON.stringify({
        name: "Importada",
        bills: { 20: 3 },
        extraAmount: 250,
        currency: "USD",
        aperturaCaja: 100,
        ventaActual: 200,
      }),
    ], "contador.json", { type: "application/json" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput as HTMLInputElement);

    await waitFor(() => expect(result.current.data[0].currency).toBe("USD"));
    expect(result.current.data[0].bills).toEqual({ 20: 3 });
    expect(result.current.data[0].extraAmount).toBe(250);
    expect(result.current.data[0].aperturaCaja).toBe(100);
    expect(result.current.data[0].ventaActual).toBe(200);

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
      ),
    );

    expect(result.current.data[0]).toEqual(original);

    unmountPanel();
    unmountHook();
    clickSpy.mockRestore();
  });
});
