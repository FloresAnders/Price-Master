"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CashCounterData } from "../types";
import type { FondoAccountTab } from "@/lib/fondoAccountTabs";
import type { MovementAccountKey } from "@/services/movimientos-fondos";
import { reconcileAccountCashCounters } from "../accountCounters";
import {
  areCashCounterSnapshotsEqual,
  createCashCounterUndoHistory,
  resolveCashCounterUndoShortcut,
} from "../undoHistory";
import {
  createLatestCashCounterSaveQueue,
  type LatestCashCounterSaveQueue,
} from "../saveQueue";
import {
  clearCashCounterSnapshot,
  createDefaultCashCounterSnapshot,
  getOrCreateCashCounterSnapshot,
  normalizeCashCounterSnapshot,
  saveCashCounterSnapshot,
} from "@/services/cashCounterDb";

const LEGACY_STORAGE_KEY = "cashCounters";
const UNDO_HISTORY_LIMIT = 30;

type PendingCashCounterSave = {
  counters: CashCounterData[];
  activeTab: number;
};

function snapshotFromState(
  counters: CashCounterData[],
  activeTab: number,
  revision: number,
) {
  return normalizeCashCounterSnapshot({
    counters,
    activeTab,
    lastSaved: new Date().toISOString(),
    revision,
  });
}

export function useCashCounter(
  activeAccounts: readonly FondoAccountTab[] = [],
  requestedAccountId?: MovementAccountKey,
) {
  const [data, setData] = useState<CashCounterData[]>([]);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [active, setActive] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [canAutoSave, setCanAutoSave] = useState(false);
  const revisionRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const initialActiveAccountsRef = useRef(activeAccounts);
  const appliedRequestedAccountIdRef = useRef<MovementAccountKey | undefined>(
    undefined,
  );
  const undoHistoryRef = useRef<ReturnType<
    typeof createCashCounterUndoHistory
  > | null>(null);
  const undoHistory = undoHistoryRef.current
    ?? (undoHistoryRef.current = createCashCounterUndoHistory(UNDO_HISTORY_LIMIT));

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        let snapshot = await getOrCreateCashCounterSnapshot();

        const counters = reconcileAccountCashCounters(
          snapshot.counters,
          initialActiveAccountsRef.current,
        );
        if (counters !== snapshot.counters) {
          snapshot = { ...snapshot, counters };
          snapshot = await saveCashCounterSnapshot(snapshot);
        }

        if (cancelled) return;
        revisionRef.current = snapshot.revision;
        dataRef.current = snapshot.counters;
        setData(snapshot.counters);
        setActive(snapshot.activeTab);
        setLastSaved(snapshot.lastSaved ? new Date(snapshot.lastSaved).toLocaleTimeString() : null);
        setCanAutoSave(true);
      } catch {
        if (cancelled) return;
        const snapshot = createDefaultCashCounterSnapshot();
        revisionRef.current = snapshot.revision;
        dataRef.current = snapshot.counters;
        setData(snapshot.counters);
        setActive(snapshot.activeTab);
        setCanAutoSave(false);
        alert("Error al cargar datos de caja. Se conservó un contador inicial.");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const current = dataRef.current;
    const reconciled = reconcileAccountCashCounters(current, activeAccounts);
    if (reconciled === current) return;

    undoHistory.clear();
    dataRef.current = reconciled;
    setCanAutoSave(true);
    setData(reconciled);
  }, [activeAccounts, hydrated, undoHistory]);

  useEffect(() => {
    if (!requestedAccountId) {
      appliedRequestedAccountIdRef.current = undefined;
      return;
    }
    if (
      !hydrated ||
      appliedRequestedAccountIdRef.current === requestedAccountId
    ) return;
    const requestedIndex = data.findIndex(
      (counter) => counter.accountId === requestedAccountId,
    );
    if (requestedIndex >= 0) {
      appliedRequestedAccountIdRef.current = requestedAccountId;
      setActive(requestedIndex);
    }
  }, [data, hydrated, requestedAccountId]);

  const persistQueuedSave = useCallback(async ({
    counters,
    activeTab,
  }: PendingCashCounterSave) => {
    const snapshot = snapshotFromState(
      counters,
      activeTab,
      revisionRef.current,
    );
    const saved = await saveCashCounterSnapshot(snapshot);
    revisionRef.current = saved.revision;
    setLastSaved(new Date(saved.lastSaved).toLocaleTimeString());
  }, []);

  const handleQueuedSaveError = useCallback(async (error: unknown) => {
    if (
      error instanceof Error &&
      error.message === "CASH_COUNTER_SNAPSHOT_CHANGED"
    ) {
      try {
        const latest = await getOrCreateCashCounterSnapshot();
        revisionRef.current = latest.revision;
        undoHistory.clear();
        dataRef.current = latest.counters;
        setCanAutoSave(false);
        setData(latest.counters);
        setActive(latest.activeTab);
        setLastSaved(
          latest.lastSaved
            ? new Date(latest.lastSaved).toLocaleTimeString()
            : null,
        );
        alert("El contador cambió en otra ventana. Se cargó la versión más reciente.");
      } catch {
        alert("Error al recargar el contador actualizado.");
      }
    } else {
      alert("Error al guardar.");
    }
  }, [undoHistory]);

  const saveQueueRef = useRef<
    LatestCashCounterSaveQueue<PendingCashCounterSave> | null
  >(null);
  if (!saveQueueRef.current) {
    saveQueueRef.current = createLatestCashCounterSaveQueue(
      persistQueuedSave,
      handleQueuedSaveError,
    );
  }

  const save = useCallback((counters: CashCounterData[], activeTab: number) => {
    const requestId = ++saveRequestIdRef.current;
    setSaving(true);
    const queue = saveQueueRef.current;
    if (!queue) return;

    queue.enqueue({ counters, activeTab });
    void queue.whenIdle().finally(() => {
      if (saveRequestIdRef.current === requestId) setSaving(false);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || !canAutoSave || data.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      save(data, active);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [data, active, hydrated, canAutoSave, save]);

  const add = useCallback(() => {
    const current = dataRef.current;
    const n = { name: `Contador ${current.length + 1}`, bills: {}, extraAmount: 0, currency: "CRC" as const, aperturaCaja: 0, ventaActual: 0 };
    const next = [...current, n];
    undoHistory.clear();
    dataRef.current = next;
    setCanAutoSave(true);
    setData(next);
    setActive(current.length);
  }, [undoHistory]);

  const del = useCallback((i: number) => {
    const current = dataRef.current;
    if (current[i]?.accountId) return;
    if (current.length <= 1) { alert("No puedes eliminar el último."); return; }
    const d = current.filter((_, j) => j !== i);
    let a = active;
    if (active === i) a = 0;
    else if (active > i) a = active - 1;
    undoHistory.clear();
    dataRef.current = d;
    setCanAutoSave(true);
    setData(d);
    setActive(a);
  }, [active, undoHistory]);

  const upd = useCallback((i: number, d: CashCounterData, group?: string) => {
    const current = dataRef.current;
    const currentCounter = current[i];
    if (!currentCounter) return;

    const nextCounter = currentCounter.accountId
      ? {
          ...d,
          accountId: currentCounter.accountId,
          name: currentCounter.name,
        }
      : d;
    if (areCashCounterSnapshotsEqual(currentCounter, nextCounter)) return;

    undoHistory.record(i, currentCounter, group);
    const next = [...current];
    next[i] = nextCounter;
    dataRef.current = next;
    setCanAutoSave(true);
    setData(next);
  }, [undoHistory]);

  const replace = useCallback((i: number, d: CashCounterData) => {
    const current = dataRef.current;
    const currentCounter = current[i];
    if (!currentCounter) return;

    const nextCounter = currentCounter.accountId
      ? {
          ...d,
          accountId: currentCounter.accountId,
          name: currentCounter.name,
        }
      : d;
    undoHistory.clear(i);
    if (areCashCounterSnapshotsEqual(currentCounter, nextCounter)) return;

    const next = [...current];
    next[i] = nextCounter;
    dataRef.current = next;
    setCanAutoSave(true);
    setData(next);
  }, [undoHistory]);

  const undo = useCallback((i: number) => {
    const current = dataRef.current;
    const currentCounter = current[i];
    if (!currentCounter) return;

    const previous = undoHistory.undo(i, currentCounter);
    if (!previous) return;

    const next = [...current];
    next[i] = previous;
    dataRef.current = next;
    setCanAutoSave(true);
    setData(next);
  }, [undoHistory]);

  const redo = useCallback((i: number) => {
    const current = dataRef.current;
    const currentCounter = current[i];
    if (!currentCounter) return;

    const following = undoHistory.redo(i, currentCounter);
    if (!following) return;

    const next = [...current];
    next[i] = following;
    dataRef.current = next;
    setCanAutoSave(true);
    setData(next);
  }, [undoHistory]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const action = resolveCashCounterUndoShortcut(event);
      if (!action) return;

      event.preventDefault();
      if (action === "undo") undo(active);
      else redo(active);
    };

    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [active, redo, undo]);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const hDS = useCallback((e: React.DragEvent, i: number) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", "");
    const img = document.createElement("div");
    img.textContent = data[i].name;
    img.style.cssText = "position:absolute;top:-1000px;background:#050816;padding:8px 16px;border-radius:9999px;font-size:14px;color:white;border:2px solid #555";
    document.body.appendChild(img);
    e.dataTransfer.setDragImage(img, 50, 20);
    setTimeout(() => document.body.removeChild(img), 0);
  }, [data]);

  const hDO = useCallback((e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIdx !== i) setOverIdx(i);
  }, [dragIdx]);

  const hDL = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverIdx(null);
  }, []);

  const hDrop = useCallback((e: React.DragEvent, drop: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === drop) { setDragIdx(null); setOverIdx(null); return; }
    const n = [...data];
    const t = n[dragIdx];
    n.splice(dragIdx, 1);
    n.splice(drop, 0, t);
    let a = active;
    if (active === dragIdx) a = drop;
    else if (active > dragIdx && active <= drop) a = active - 1;
    else if (active < dragIdx && active >= drop) a = active + 1;
    undoHistory.clear();
    dataRef.current = n;
    setCanAutoSave(true);
    setData(n);
    setActive(a);
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, data, active, undoHistory]);

  const hDE = useCallback(() => { setDragIdx(null); setOverIdx(null); }, []);

  const exp = useCallback(() => {
    try {
      const b = new Blob([JSON.stringify({ version: "1.0", counters: data, activeTab: active }, null, 2)], { type: "application/json" });
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = `cash-counter-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(u);
    } catch { alert("Error."); }
  }, [data, active]);

  const imp = useCallback(() => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = normalizeCashCounterSnapshot(JSON.parse(ev.target?.result as string));
          const snapshot = {
            ...imported,
            counters: reconcileAccountCashCounters(imported.counters, activeAccounts),
          };
          undoHistory.clear();
          dataRef.current = snapshot.counters;
          setCanAutoSave(true);
          setData(snapshot.counters);
          setActive(snapshot.activeTab);
          alert(`✅ ${snapshot.counters.length} cargados.`);
        } catch { alert("❌ Error."); }
      };
      reader.readAsText(f);
    };
    inp.click();
  }, [activeAccounts, undoHistory]);

  const storageInfo = useCallback(() => {
    try {
      const payload = JSON.stringify({ counters: data, activeTab: active });
      return `${data.length} contadores • ${(new Blob([payload]).size / 1024).toFixed(2)} KB`;
    } catch { return "Error"; }
  }, [data, active]);

  const clear = useCallback(() => {
    if (confirm(`⚠️ ¿Borrar todos?\n\n${storageInfo()}`)) {
      void (async () => {
        try {
          await saveQueueRef.current?.whenIdle();
          await clearCashCounterSnapshot();
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
          const initial = createDefaultCashCounterSnapshot();
          revisionRef.current = initial.revision;
          const snapshot = {
            ...initial,
            counters: reconcileAccountCashCounters(initial.counters, activeAccounts),
          };
          undoHistory.clear();
          dataRef.current = snapshot.counters;
          setCanAutoSave(true);
          setData(snapshot.counters);
          setActive(snapshot.activeTab);
          alert("✅ Restablecido.");
        } catch { alert("❌ Error."); }
      })();
    }
  }, [activeAccounts, storageInfo, undoHistory]);

  return {
    data, active, setActive, lastSaved, saving, save,
    add, del, upd, replace,
    dragIdx, overIdx, hDS, hDO, hDL, hDrop, hDE,
    exp, imp, clear, storageInfo,
  };
}
