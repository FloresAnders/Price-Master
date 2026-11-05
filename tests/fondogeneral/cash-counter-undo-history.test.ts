import { describe, expect, it } from "vitest";
import {
  areCashCounterSnapshotsEqual,
  createCashCounterUndoHistory,
  resolveCashCounterUndoShortcut,
  type CashCounterUndoSnapshot,
} from "@/components/business/cash-counter-tabs/undoHistory";

function snapshot(count: number): CashCounterUndoSnapshot {
  return {
    name: "Caja",
    bills: { 1000: count },
    extraAmount: 0,
    currency: "CRC",
    aperturaCaja: 0,
    ventaActual: 0,
  };
}

describe("historial de cambios del contador de efectivo", () => {
  it("conserva solo los ultimos 30 estados", () => {
    const history = createCashCounterUndoHistory(30);

    for (let count = 0; count < 31; count += 1) {
      history.record(0, snapshot(count));
    }

    let current = snapshot(31);
    for (let step = 0; step < 30; step += 1) {
      current = history.undo(0, current) ?? current;
    }

    expect(current.bills[1000]).toBe(1);
    expect(history.undo(0, current)).toBeNull();
  });

  it("mantiene historiales independientes por contador", () => {
    const history = createCashCounterUndoHistory(30);
    history.record(0, snapshot(1));
    history.record(1, snapshot(8));

    expect(history.undo(0, snapshot(2))?.bills[1000]).toBe(1);
    expect(history.undo(1, snapshot(9))?.bills[1000]).toBe(8);
  });

  it("rehace el ultimo cambio y borra rehacer cuando aparece un cambio nuevo", () => {
    const history = createCashCounterUndoHistory(30);
    history.record(0, snapshot(1));

    const undone = history.undo(0, snapshot(2));
    expect(history.redo(0, undone ?? snapshot(-1))?.bills[1000]).toBe(2);

    history.undo(0, snapshot(2));
    history.record(0, snapshot(5));
    expect(history.redo(0, snapshot(6))).toBeNull();
  });

  it("agrupa actualizaciones consecutivas de una misma pulsacion sostenida", () => {
    const history = createCashCounterUndoHistory(30);
    history.record(0, snapshot(1), "hold-1");
    history.record(0, snapshot(2), "hold-1");
    history.record(0, snapshot(3), "hold-1");

    const undone = history.undo(0, snapshot(4));
    expect(undone?.bills[1000]).toBe(1);
    expect(history.undo(0, undone ?? snapshot(-1))).toBeNull();
  });

  it("resuelve Ctrl+Z y Ctrl+Shift+Z sin tomar entradas editables", () => {
    expect(resolveCashCounterUndoShortcut({ key: "z", ctrlKey: true })).toBe(
      "undo",
    );
    expect(
      resolveCashCounterUndoShortcut({
        key: "Z",
        ctrlKey: true,
        shiftKey: true,
      }),
    ).toBe("redo");
    expect(
      resolveCashCounterUndoShortcut({
        key: "z",
        metaKey: true,
        target: { tagName: "INPUT" },
      }),
    ).toBeNull();
  });

  it("trata mapas sin denominacion y con denominacion en cero como iguales", () => {
    expect(
      areCashCounterSnapshotsEqual(
        { ...snapshot(0), bills: {} },
        snapshot(0),
      ),
    ).toBe(true);
    expect(areCashCounterSnapshotsEqual(snapshot(0), snapshot(1))).toBe(false);
  });
});
