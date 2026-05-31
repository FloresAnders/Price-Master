"use client";

import { useState, useEffect, useCallback } from "react";
import type { CashCounterData } from "../types";

export function useCashCounter() {
  const [data, setData] = useState<CashCounterData[]>([]);
  const [active, setActive] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (d: CashCounterData[], i: number) => {
    setSaving(true);
    try {
      window.localStorage.setItem("cashCounters", JSON.stringify({ counters: d, activeTab: i, lastSaved: new Date().toISOString() }));
      setLastSaved(new Date().toLocaleTimeString());
      await new Promise((r) => setTimeout(r, 400));
    } catch { alert("Error al guardar."); }
    finally { setSaving(false); }
  }, []);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("cashCounters");
      if (s) {
        const p = JSON.parse(s);
        let c: CashCounterData[], a = 0;
        if (Array.isArray(p)) c = p;
        else if (p.counters) { c = p.counters; a = p.activeTab || 0; }
        else throw new Error("bad format");
        const n = c.map((item, i) => ({
          name: item.name || `Contador ${i + 1}`,
          bills: item.bills || {},
          extraAmount: item.extraAmount || 0,
          currency: (item.currency as "CRC" | "USD") || "CRC",
          aperturaCaja: item.aperturaCaja || 0,
          ventaActual: item.ventaActual || 0,
        }));
        setData(n);
        setActive(Math.min(a, n.length - 1));
      } else {
        const d = [{ name: "Contador 1", bills: {}, extraAmount: 0, currency: "CRC" as "CRC" | "USD", aperturaCaja: 0, ventaActual: 0 }];
        setData(d);
        setActive(0);
        save(d, 0);
      }
    } catch {
      const d = [{ name: "Contador 1", bills: {}, extraAmount: 0, currency: "CRC" as "CRC" | "USD", aperturaCaja: 0, ventaActual: 0 }];
      setData(d);
      setActive(0);
    }
  }, [save]);

  useEffect(() => { if (data.length > 0) save(data, active); }, [data, active, save]);

  const add = useCallback(() => {
    const n = { name: `Contador ${data.length + 1}`, bills: {}, extraAmount: 0, currency: "CRC" as "CRC" | "USD", aperturaCaja: 0, ventaActual: 0 };
    const d = [...data, n];
    setData(d);
    setActive(data.length);
    save(d, data.length);
  }, [data, save]);

  const del = useCallback((i: number) => {
    if (data.length <= 1) { alert("No puedes eliminar el último."); return; }
    const d = data.filter((_, j) => j !== i);
    let a = active;
    if (active === i) a = 0;
    else if (active > i) a = active - 1;
    setData(d);
    setActive(a);
    save(d, a);
  }, [data, active, save]);

  const upd = useCallback((i: number, d: CashCounterData) => {
    const n = [...data];
    n[i] = d;
    setData(n);
    save(n, active);
  }, [data, active, save]);

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
    setData(n);
    setActive(a);
    save(n, a);
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, data, active, save]);

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
      new FileReader().onload = (ev) => {
        try {
          const d = JSON.parse(ev.target?.result as string);
          if (d.counters && Array.isArray(d.counters)) {
            const n = d.counters.map((item: unknown, i: number) => {
              const ci = item as Record<string, unknown>;
              return {
                name: (typeof ci.name === "string" ? ci.name : null) || `C${i + 1}`,
                bills: (typeof ci.bills === "object" && ci.bills !== null ? ci.bills : {}) as Record<number, number>,
                extraAmount: (typeof ci.extraAmount === "number" ? ci.extraAmount : null) || 0,
                currency: (ci.currency === "CRC" || ci.currency === "USD" ? ci.currency : "CRC") as "CRC" | "USD",
                aperturaCaja: (typeof ci.aperturaCaja === "number" ? ci.aperturaCaja : null) || 0,
                ventaActual: (typeof ci.ventaActual === "number" ? ci.ventaActual : null) || 0,
              };
            });
            setData(n);
            setActive(0);
            save(n, 0);
            alert(`✅ ${n.length} cargados.`);
          } else alert("❌ Formato inválido.");
        } catch { alert("❌ Error."); }
      };
      new FileReader().readAsText(f);
    };
    inp.click();
  }, [save]);

  const storageInfo = useCallback(() => {
    try {
      const d = window.localStorage.getItem("cashCounters");
      if (d) return `${data.length} contadores • ${(new Blob([d]).size / 1024).toFixed(2)} KB`;
      return "Sin datos";
    } catch { return "Error"; }
  }, [data]);

  const clear = useCallback(() => {
    if (confirm(`⚠️ ¿Borrar todos?\n\n${storageInfo()}`)) {
      try {
        window.localStorage.removeItem("cashCounters");
        const d = [{ name: "Contador 1", bills: {}, extraAmount: 0, currency: "CRC" as "CRC" | "USD", aperturaCaja: 0, ventaActual: 0 }];
        setData(d);
        setActive(0);
        save(d, 0);
        alert("✅ Restablecido.");
      } catch { alert("❌ Error."); }
    }
  }, [storageInfo, save]);

  return {
    data, active, setActive, lastSaved, saving, save,
    add, del, upd,
    dragIdx, overIdx, hDS, hDO, hDL, hDrop, hDE,
    exp, imp, clear, storageInfo,
  };
}
