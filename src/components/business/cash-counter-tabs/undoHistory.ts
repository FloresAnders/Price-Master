import type { CashCounterData } from "./types";

export type CashCounterUndoSnapshot = CashCounterData;

type CounterHistory = {
  past: CashCounterUndoSnapshot[];
  future: CashCounterUndoSnapshot[];
  lastGroup?: string;
};

type UndoShortcutEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
  target?: EventTarget | { tagName?: string; isContentEditable?: boolean } | null;
};

export type CashCounterUndoShortcut = "undo" | "redo";

export function resolveCashCounterUndoShortcut(
  event: UndoShortcutEvent,
): CashCounterUndoShortcut | null {
  if (
    event.defaultPrevented ||
    event.altKey ||
    (!event.ctrlKey && !event.metaKey) ||
    event.key.toLowerCase() !== "z"
  ) {
    return null;
  }

  const target = event.target as
    | { tagName?: string; isContentEditable?: boolean }
    | null
    | undefined;
  const tagName = target?.tagName?.toLowerCase();
  if (
    target?.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  ) {
    return null;
  }

  return event.shiftKey ? "redo" : "undo";
}

function cloneSnapshot(
  snapshot: CashCounterUndoSnapshot,
): CashCounterUndoSnapshot {
  return {
    ...snapshot,
    bills: { ...snapshot.bills },
  };
}

export function areCashCounterSnapshotsEqual(
  left: CashCounterUndoSnapshot,
  right: CashCounterUndoSnapshot,
): boolean {
  if (
    left.accountId !== right.accountId ||
    left.name !== right.name ||
    left.extraAmount !== right.extraAmount ||
    left.currency !== right.currency ||
    left.aperturaCaja !== right.aperturaCaja ||
    left.ventaActual !== right.ventaActual
  ) {
    return false;
  }

  const denominations = new Set([
    ...Object.keys(left.bills),
    ...Object.keys(right.bills),
  ]);
  return [...denominations].every(
    (denomination) =>
      (left.bills[Number(denomination)] || 0) ===
      (right.bills[Number(denomination)] || 0),
  );
}

export function createCashCounterUndoHistory(limit: number) {
  const histories = new Map<number, CounterHistory>();

  const getHistory = (counterIndex: number) => {
    const existing = histories.get(counterIndex);
    if (existing) return existing;

    const created: CounterHistory = { past: [], future: [] };
    histories.set(counterIndex, created);
    return created;
  };

  return {
    record(
      counterIndex: number,
      previous: CashCounterUndoSnapshot,
      group?: string,
    ) {
      const history = getHistory(counterIndex);
      if (group && history.lastGroup === group) return;

      history.past.push(cloneSnapshot(previous));
      if (history.past.length > limit) history.past.shift();
      history.future = [];
      history.lastGroup = group;
    },

    undo(
      counterIndex: number,
      current: CashCounterUndoSnapshot,
    ): CashCounterUndoSnapshot | null {
      const history = getHistory(counterIndex);
      const previous = history.past.pop();
      if (!previous) return null;

      history.future.push(cloneSnapshot(current));
      if (history.future.length > limit) history.future.shift();
      history.lastGroup = undefined;
      return cloneSnapshot(previous);
    },

    redo(
      counterIndex: number,
      current: CashCounterUndoSnapshot,
    ): CashCounterUndoSnapshot | null {
      const history = getHistory(counterIndex);
      const next = history.future.pop();
      if (!next) return null;

      history.past.push(cloneSnapshot(current));
      if (history.past.length > limit) history.past.shift();
      history.lastGroup = undefined;
      return cloneSnapshot(next);
    },

    clear(counterIndex?: number) {
      if (counterIndex === undefined) histories.clear();
      else histories.delete(counterIndex);
    },
  };
}
