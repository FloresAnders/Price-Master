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

  it("limpia un contador sin registrar la operacion en el historial", () => {
    const onUpdate = vi.fn();
    const onReplace = vi.fn();
    render(
      <RightPanel
        data={{
          name: "Caja",
          bills: { 1000: 4 },
          extraAmount: 500,
          currency: "CRC",
          aperturaCaja: 1000,
          ventaActual: 2000,
        }}
        showExtra={false}
        setShowExtra={vi.fn()}
        showBD={false}
        setShowBD={vi.fn()}
        onUpdate={onUpdate}
        onReplace={onReplace}
        onCurrencyOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    const confirmations = screen.getAllByRole("button", { name: "Limpiar" });
    fireEvent.click(confirmations[confirmations.length - 1]);

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("importa un contador mediante reemplazo estructural", async () => {
    const onUpdate = vi.fn();
    const onReplace = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    const { container } = render(
      <RightPanel
        data={{
          name: "Caja",
          bills: {},
          extraAmount: 0,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        }}
        showExtra={false}
        setShowExtra={vi.fn()}
        showBD={false}
        setShowBD={vi.fn()}
        onUpdate={onUpdate}
        onReplace={onReplace}
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
        bills: { 1000: 3 },
        extraAmount: 250,
        currency: "CRC",
        aperturaCaja: 1000,
        ventaActual: 2000,
      }),
    ], "contador.json", { type: "application/json" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput as HTMLInputElement);

    await waitFor(() => expect(onReplace).toHaveBeenCalledOnce());
    expect(onUpdate).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
