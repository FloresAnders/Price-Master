"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, MinusCircle, Banknote } from "lucide-react";
import type { CashCounterProps } from "../types";
import { badgeColor, badgeLabel, denomsByCurrency, calcBDBreakdown, fmtCurrency, calcTotal } from "../utils";

export function CashCounter({ id, data, showBD, onUpdate }: CashCounterProps) {
  const denoms = denomsByCurrency(data.currency);
  const bills = data.bills;
  const extra = data.extraAmount;
  const cur = data.currency;
  const ap = data.aperturaCaja;
  const vt = data.ventaActual;
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const ntf = (b: Record<number, number>, e: number, c: "CRC" | "USD", a?: number, v?: number) =>
    onUpdate(id, { ...data, bills: b, extraAmount: e, currency: c, aperturaCaja: a ?? data.aperturaCaja, ventaActual: v ?? data.ventaActual });

  const inc = (v: number) => ntf({ ...bills, [v]: (bills[v] || 0) + 1 }, extra, cur);
  const dec = (v: number) => {
    const n = Math.max((bills[v] || 0) - 1, 0);
    ntf({ ...bills, [v]: n }, extra, cur);
  };
  const manual = (v: number, s: string) => {
    const p = parseInt(s.replace(/^0+/, ""), 10);
    ntf({ ...bills, [v]: isNaN(p) || p < 0 ? 0 : p }, extra, cur);
  };

  const t = calcTotal(bills, extra);

  const kd = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    const d = denoms[i];
    if (e.key === "+" || e.key === "ArrowRight") { e.preventDefault(); inc(d.value); return; }
    if (e.key === "-" || e.key === "ArrowLeft") { e.preventDefault(); dec(d.value); return; }
    if (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowDown") {
      e.preventDefault();
      if (e.shiftKey && (e.key === "Enter" || e.key === "Tab")) {
        const p = i - 1;
        refs.current[p >= 0 ? p : denoms.length - 1]?.focus();
      } else {
        const n = i + 1;
        refs.current[n < denoms.length ? n : 0]?.focus();
      }
    }
    if (e.key === "ArrowUp") { e.preventDefault(); const p = i - 1; refs.current[p >= 0 ? p : denoms.length - 1]?.focus(); }
  };

  useEffect(() => { refs.current = refs.current.slice(0, denoms.length); }, [denoms.length]);

  const diffMsg = (cn = "") => {
    if (ap === 0 && vt === 0) return null;
    const r = t - vt, d = Math.abs(r - ap);
    const type = r > ap ? "sobrante" : r < ap ? "faltante" : "equilibrio";
    const cl = type === "sobrante" ? "text-emerald-400" : type === "faltante" ? "text-red-400" : "text-white/30";
    const msg = type === "sobrante" ? `Sobrante: ${fmtCurrency(d, cur)}` : type === "faltante" ? `Faltante: ${fmtCurrency(d, cur)}` : "Sin diferencia";
    return <span className={`${cl} font-medium text-xs ${cn}`}>{msg}</span>;
  };

  const denomGridCols = "grid-cols-1 md:grid-cols-[minmax(140px,1fr)_160px_minmax(140px,1fr)] lg:grid-cols-[minmax(200px,1fr)_220px_minmax(250px,1fr)]";

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/15 border border-cyan-400/25 shadow-[0_10px_30px_rgba(6,182,212,0.12)] flex items-center justify-center">
            <Banknote className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white/90 tracking-tight">{data.name}</h3>
            <p className="text-[11px] text-white/35 tracking-wide">{cur === "CRC" ? "Colones" : "Dólares"}</p>
          </div>
        </div>
      </div>

      {ap > 0 && vt > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/10 bg-[#0d1117] p-4 mb-5">
          <div className="flex items-center justify-around text-xs">
            <div className="text-center">
              <p className="text-white/30 uppercase tracking-wider mb-1">Apertura</p>
              <p className="font-semibold text-white/80">{fmtCurrency(ap, cur)}</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-white/30 uppercase tracking-wider mb-1">Venta</p>
              <p className="font-semibold text-white/80">{fmtCurrency(vt, cur)}</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-white/30 uppercase tracking-wider mb-1">Estado</p>
              <p className="font-semibold">{diffMsg("")}</p>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showBD && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
            <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-3 grid grid-cols-2 gap-2 text-xs">
              {calcBDBreakdown(bills, cur).map((i) => (
                <div key={i.l} className="p-2.5 bg-[#0d1117] rounded-xl text-center border border-white/10">
                  <p className="text-white/30 mb-0.5">{i.l}</p>
                  <p className="font-medium text-white/70">{fmtCurrency(i.v, cur)}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border border-white/10 bg-[#0d1117] overflow-hidden">
        <div className={`grid ${denomGridCols} items-center gap-3 px-4 sm:px-5 py-3 border-b border-white/10`}>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-medium">Denominación</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-200/75 font-semibold text-center">Cantidad</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-medium text-right">Subtotal</p>
        </div>
        <div className="space-y-1.5 p-2 sm:p-3">
          {denoms.map((den, i) => {
            const cnt = bills[den.value] || 0;
            const sub = den.value * cnt;
            const pct = t > 0 ? (sub / t) * 100 : 0;
            return (
              <motion.div key={den.value} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                className={`relative rounded-xl border transition-all duration-200 ${
                  cnt > 0
                    ? "bg-[#0d1117] border-white/10 hover:border-cyan-400/25 hover:shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
                    : "bg-[#0d1117] border-white/10 opacity-55"
                }`}>
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-400/60 via-cyan-400/55 to-blue-400/45" />
                </div>
                <div className={`relative p-3 sm:p-3.5 grid ${denomGridCols} items-center gap-3`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-16 h-12 rounded-lg flex items-center justify-center text-[11px] font-bold border flex-shrink-0 ${cnt > 0 ? badgeColor(den.value) : "bg-[#151f31] text-white/25 border-white/10"}`}>
                      <Banknote className="w-4 h-4 mr-1 text-white/70" />
                      {badgeLabel(den.value)}
                    </div>
                    <p className="text-sm text-white/85 font-medium whitespace-nowrap">{den.label}</p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
                      onClick={() => dec(den.value)}
                      className="w-9 h-9 rounded-full bg-[#0d1117] border border-white/30 hover:border-rose-300/55 hover:bg-rose-500/15 flex items-center justify-center transition-all shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                      aria-label={`-${den.label}`}>
                      <MinusCircle className="w-[18px] h-[18px] text-rose-200" />
                    </motion.button>
                    <input ref={(el) => { refs.current[i] = el; }} type="text" inputMode="numeric"
                      value={cnt === 0 ? "" : String(cnt)} onChange={(e) => manual(den.value, e.target.value)}
                      onKeyDown={(e) => kd(e, i)}
                      className="w-14 text-center bg-[#050816] border border-white/10 rounded-xl py-2 text-white text-sm font-semibold focus:ring-1 focus:ring-cyan-400/35 focus:border-cyan-400/35 outline-none transition-all placeholder-white/10"
                      placeholder="0" />
                    <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
                      onClick={() => inc(den.value)}
                      className="w-9 h-9 rounded-full bg-[#0d1117] border border-white/30 hover:border-emerald-300/55 hover:bg-emerald-500/15 flex items-center justify-center transition-all shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                      aria-label={`+${den.label}`}>
                      <PlusCircle className="w-[18px] h-[18px] text-emerald-200" />
                    </motion.button>
                  </div>
                  <div className="w-full text-right min-w-[5.5rem]">
                    <div className="flex items-center justify-end gap-2">
                      <p className={`text-base font-semibold tracking-tight ${cnt > 0 ? "text-white" : "text-white/20"}`}>{fmtCurrency(sub, cur)}</p>
                      <p className="text-xs text-white/45 min-w-8">{pct.toFixed(1)}%</p>
                    </div>
                    <div className="mt-1 h-1.5 w-28 bg-white/10 rounded-full overflow-hidden ml-auto">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.55, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-cyan-300/70 to-emerald-300/65" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
