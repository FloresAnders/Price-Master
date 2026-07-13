"use client";

import { useState, useEffect, useCallback } from "react";
import type { CashCounterData } from "../types";
import {
  clearCashCounterSnapshot,
  createDefaultCashCounterSnapshot,
  getCashCounterSnapshot,
  normalizeCashCounterSnapshot,
  saveCashCounterSnapshot,
} from "@/services/cashCounterDb";

const LEGACY_STORAGE_KEY = "cashCounters";

function readLegacySnapshot(): unknown | undefined {
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function snapshotFromState(counters: CashCounterData[], activeTab: number) {
  return normalizeCashCounterSnapshot({
    counters,
    activeTab,
    lastSaved: new Date().toISOString(),
  });
}

export function useCashCounter() {
  const [data, setData] = useState<CashCounterData[]>([]);
  const [active, setActive] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [canAutoSave, setCanAutoSave] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        let snapshot = await getCashCounterSnapshot();

        if (!snapshot) {
          const legacy = readLegacySnapshot();
          snapshot = legacy
            ? normalizeCashCounterSnapshot(legacy)
            : createDefaultCashCounterSnapshot();

          await saveCashCounterSnapshot(snapshot);
          if (legacy) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }

        if (cancelled) return;
        setData(snapshot.counters);
        setActive(snapshot.activeTab);
        setLastSaved(snapshot.lastSaved ? new Date(snapshot.lastSaved).toLocaleTimeString() : null);
        setCanAutoSave(true);
      } catch {
        if (cancelled) return;
        const snapshot = createDefaultCashCounterSnapshot();
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

  const save = useCallback(async (counters: CashCounterData[], activeTab: number) => {
    setSaving(true);
    try {
      const snapshot = snapshotFromState(counters, activeTab);
      await saveCashCounterSnapshot(snapshot);
      setLastSaved(new Date(snapshot.lastSaved).toLocaleTimeString());
    } catch {
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !canAutoSave || data.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      void save(data, active);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [data, active, hydrated, canAutoSave, save]);

  const add = useCallback(() => {
    const n = { name: `Contador ${data.length + 1}`, bills: {}, extraAmount: 0, currency: "CRC" as const, aperturaCaja: 0, ventaActual: 0 };
    setCanAutoSave(true);
    setData((current) => [...current, n]);
    setActive(data.length);
  }, [data.length]);

  const del = useCallback((i: number) => {
    if (data.length <= 1) { alert("No puedes eliminar el último."); return; }
    const d = data.filter((_, j) => j !== i);
    let a = active;
    if (active === i) a = 0;
    else if (active > i) a = active - 1;
    setCanAutoSave(true);
    setData(d);
    setActive(a);
  }, [data, active]);

  const upd = useCallback((i: number, d: CashCounterData) => {
    setCanAutoSave(true);
    setData((current) => {
      const n = [...current];
      n[i] = d;
      return n;
    });
  }, []);

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
    setCanAutoSave(true);
    setData(n);
    setActive(a);
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, data, active]);

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
          const snapshot = normalizeCashCounterSnapshot(JSON.parse(ev.target?.result as string));
          setCanAutoSave(true);
          setData(snapshot.counters);
          setActive(snapshot.activeTab);
          alert(`✅ ${snapshot.counters.length} cargados.`);
        } catch { alert("❌ Error."); }
      };
      reader.readAsText(f);
    };
    inp.click();
  }, []);

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
          await clearCashCounterSnapshot();
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
          const snapshot = createDefaultCashCounterSnapshot();
          setCanAutoSave(true);
          setData(snapshot.counters);
          setActive(snapshot.activeTab);
          alert("✅ Restablecido.");
        } catch { alert("❌ Error."); }
      })();
    }
  }, [storageInfo]);

  return {
    data, active, setActive, lastSaved, saving, save,
    add, del, upd,
    dragIdx, overIdx, hDS, hDO, hDL, hDrop, hDE,
    exp, imp, clear, storageInfo,
  };
}
