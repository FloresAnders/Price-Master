"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlusCircle, MinusCircle, XCircle, Trash2, Calculator as CalculatorIcon,
  DollarSign, Edit3, Inbox, Eraser, Download, Upload, Plus, RefreshCw,
  Smartphone, FolderOpen, Save, RotateCcw, Lock as LockIcon, GripVertical,
  Banknote, TrendingUp, Layers, Wallet, Coins, Search,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { hasPermission } from "../../utils/permissions";
import { safeLocalStorage } from "../../utils/client";
import { CalculatorModal } from "../modals";

/* ── Accent colors for denomination badges only ── */
const DENOM_ACCENTS: Record<string, string> = {
  "20000": "bg-orange-500/20 text-orange-400 border-orange-500/25",
  "10000": "bg-emerald-500/20 text-emerald-400 border-emerald-500/25",
  "5000":  "bg-amber-500/20 text-amber-400 border-amber-500/25",
  "2000":  "bg-blue-500/20 text-blue-400 border-blue-500/25",
  "1000":  "bg-rose-500/20 text-rose-400 border-rose-500/25",
  "500":   "bg-amber-500/20 text-amber-400 border-amber-500/25",
  "100":   "bg-amber-500/20 text-amber-400 border-amber-500/25",
  "50":    "bg-amber-500/20 text-amber-400 border-amber-500/25",
  "25":    "bg-amber-500/20 text-amber-400 border-amber-500/25",
  "1":     "bg-neutral-500/20 text-neutral-400 border-neutral-500/25",
};

function badgeColor(value: number): string {
  return DENOM_ACCENTS[value] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/25";
}

function badgeLabel(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  return String(value);
}

/* ── Types ── */
type BaseModalProps = { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode };

/* ── BaseModal ── */
function BaseModal({ isOpen, onClose, title, children }: BaseModalProps) {
  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: "spring", damping: 30, stiffness: 260 }}
        className="bg-[#0d1117] rounded-2xl shadow-2xl border border-white/10 w-full max-w-[24rem] p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/20 hover:text-white/50 transition-colors" aria-label="Cerrar">
          <XCircle className="w-5 h-5" />
        </button>
        <h2 className="text-center font-semibold mb-4 text-white/80 text-base">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ── SinpeModal ── */
type SinpeModalProps = { isOpen: boolean; onClose: () => void; currency: "CRC" | "USD" };
function SinpeModal({ isOpen, onClose, currency }: SinpeModalProps) {
  const [ma, setMa] = useState<number>(() => { const s = safeLocalStorage.getItem("sinpe-monto-actual"); if (!s) return 0; const p = parseFloat(s); return Number.isFinite(p) ? p : 0; });
  const [mr, setMr] = useState(0);
  useEffect(() => { safeLocalStorage.setItem("sinpe-monto-actual", ma.toString()); }, [ma]);
  const fmt = (n: number) => new Intl.NumberFormat(currency === "CRC" ? "es-CR" : "en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(n);
  useEffect(() => { if (!isOpen) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [isOpen, onClose]);
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Verificador SINPE">
      <div className="space-y-4">
        <div>
          <label className="block text-white/40 text-xs font-medium mb-1.5">Monto Actual <span className="text-white/20">(pegar aquí)</span></label>
          <div className="bg-[#0d1117] border border-white/10 rounded-xl p-3 flex items-center">
            <input type="number" min="0" step="0.01" value={ma || ""} onChange={(e) => setMa(e.target.value === "" ? 0 : Number(e.target.value))}
              onPaste={async (e) => { e.preventDefault(); try { const n = parseFloat(e.clipboardData.getData("text").replace(/[^\d.,]/g, "").replace(",", ".")); if (!isNaN(n)) setMa(n); } catch {} }}
              className="w-full bg-transparent text-white text-right text-base focus:outline-none placeholder-white/10" placeholder="0" />
          </div>
          <p className="text-xs text-white/20 mt-1">{fmt(ma)}</p>
        </div>
        <div>
          <label className="block text-white/40 text-xs font-medium mb-1.5">Monto a Recibir</label>
          <div className="bg-[#0d1117] border border-white/10 rounded-xl p-3 flex items-center">
            <input type="number" min="0" step="0.01" value={mr || ""} onChange={(e) => setMr(e.target.value === "" ? 0 : Number(e.target.value))}
              className="w-full bg-transparent text-white text-right text-base focus:outline-none placeholder-white/10" placeholder="0" />
          </div>
          <p className="text-xs text-white/20 mt-1">{fmt(mr)}</p>
        </div>
        <div className="bg-[#0d1117] rounded-xl p-4 border border-white/10 text-center">
          <p className="text-white/30 text-xs mb-1">Total Esperado</p>
          <p className="text-xl font-semibold text-white">{fmt(ma + mr)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setMa(ma + mr); setMr(0); }} disabled={ma + mr === 0}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${ma + mr > 0 ? "bg-white/10 hover:bg-white/15 text-white" : "bg-[#0d1117] text-white/20 cursor-not-allowed"}`}>
            <RefreshCw className="w-4 h-4" /> Recargar
          </button>
          <button onClick={() => { setMa(0); setMr(0); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#0d1117] hover:bg-[#0d1117] text-white/50 hover:text-white/70 transition-all duration-200">
            <Trash2 className="w-4 h-4" /> Limpiar
          </button>
        </div>
        <div className="text-xs text-white/25 text-center p-3 bg-[#0d1117] rounded-xl border border-white/10 leading-relaxed">
          💡 <span className="text-white/40">Instrucciones:</span><br />• Pega monto desde SINPE • Ingresa monto a recibir • Usa &ldquo;Recargar&rdquo;
        </div>
      </div>
    </BaseModal>
  );
}

type BillsMap = Record<number, number>;
type CashCounterData = { name: string; bills: BillsMap; extraAmount: number; currency: "CRC" | "USD"; aperturaCaja: number; ventaActual: number };
type CashCounterProps = { id: number; data: CashCounterData; onUpdate: (i: number, d: CashCounterData) => void; onDelete: (i: number) => void; onCurrencyOpen: () => void };

/* ════════════════════════════════════════
   CashCounter (Modified - Main Content Only)
   ════════════════════════════════════════ */
function CashCounter({ id, data, onUpdate, onDelete, onCurrencyOpen }: CashCounterProps) {
  const CRC_DENOMS = [
    { label: "₡ 20 000", value: 20000 }, { label: "₡ 10 000", value: 10000 },
    { label: "₡ 5 000", value: 5000 }, { label: "₡ 2 000", value: 2000 },
    { label: "₡ 1 000", value: 1000 }, { label: "₡ 500", value: 500 },
    { label: "₡ 100", value: 100 }, { label: "₡ 50", value: 50 }, { label: "₡ 25", value: 25 },
  ];
  const USD_DENOMS = [
    { label: "$ 100", value: 100 }, { label: "$ 50", value: 50 },
    { label: "$ 20", value: 20 }, { label: "$ 10", value: 10 },
    { label: "$ 5", value: 5 }, { label: "$ 1", value: 1 },
  ];
  const denoms = data.currency === "CRC" ? CRC_DENOMS : USD_DENOMS;
  const bills = data.bills;
  const extra = data.extraAmount;
  const cur = data.currency;
  const ap = data.aperturaCaja;
  const vt = data.ventaActual;

  const [showExtra, setShowExtra] = useState(false);
  const [nv, setNv] = useState(0);
  const [va, setVa] = useState(false);
  const [showBD, setShowBD] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const kd = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    const d = denoms[i];
    if (e.key === "+" || e.key === "ArrowRight") { e.preventDefault(); inc(d.value); return; }
    if (e.key === "-" || e.key === "ArrowLeft") { e.preventDefault(); dec(d.value); return; }
    if (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowDown") {
      e.preventDefault();
      if (e.shiftKey && (e.key === "Enter" || e.key === "Tab")) { const p = i - 1; refs.current[p >= 0 ? p : denoms.length - 1]?.focus(); }
      else { const n = i + 1; refs.current[n < denoms.length ? n : 0]?.focus(); }
    }
    if (e.key === "ArrowUp") { e.preventDefault(); const p = i - 1; refs.current[p >= 0 ? p : denoms.length - 1]?.focus(); }
  };
  useEffect(() => { refs.current = refs.current.slice(0, denoms.length); }, [denoms.length]);

  const ntf = (b: BillsMap, e: number, c: "CRC" | "USD", a?: number, v?: number) =>
    onUpdate(id, { ...data, bills: b, extraAmount: e, currency: c, aperturaCaja: a ?? data.aperturaCaja, ventaActual: v ?? data.ventaActual });
  const inc = (v: number) => ntf({ ...bills, [v]: (bills[v] || 0) + 1 }, extra, cur);
  const dec = (v: number) => { const n = Math.max((bills[v] || 0) - 1, 0); ntf({ ...bills, [v]: n }, extra, cur); };
  const manual = (v: number, s: string) => { const p = parseInt(s.replace(/^0+/, ""), 10); ntf({ ...bills, [v]: isNaN(p) || p < 0 ? 0 : p }, extra, cur); };
  const total = () => Object.entries(bills).reduce((a, [d, c]) => a + Number(d) * Number(c), 0) + extra;
  const fmt = (n: number) => new Intl.NumberFormat(cur === "CRC" ? "es-CR" : "en-US", { style: "currency", currency: cur, minimumFractionDigits: 0 }).format(n);
  const t = total();
  const diffMsg = (cn = "") => {
    if (ap === 0 && vt === 0) return null;
    const r = t - vt, d = Math.abs(r - ap);
    const type = r > ap ? "sobrante" : r < ap ? "faltante" : "equilibrio";
    const cl = type === "sobrante" ? "text-emerald-400" : type === "faltante" ? "text-red-400" : "text-white/30";
    const msg = type === "sobrante" ? `Sobrante: ${fmt(d)}` : type === "faltante" ? `Faltante: ${fmt(d)}` : "Sin diferencia";
    return <span className={`${cl} font-medium text-xs ${cn}`}>{msg}</span>;
  };

  const hEC = (e: React.ChangeEvent<HTMLInputElement>) => {
    let r = e.target.value;
    if (cur === "CRC") { r = r.replace(/\D/g, ""); ntf(bills, r === "" ? 0 : parseInt(r, 10), cur); }
    else { r = r.replace(/[^0-9.]/g, ""); const p = parseFloat(r); ntf(bills, isNaN(p) ? 0 : p, cur); }
  };
  const nKD = (e: React.KeyboardEvent<HTMLInputElement>, v: number, set: (v: number) => void, inc = 1) => {
    if (e.key === "+") { e.preventDefault(); set(v + inc); } else if (e.key === "-") { e.preventDefault(); set(Math.max(v - inc, 0)); }
  };

  const calcBD = () => {
    if (cur === "CRC") {
      const b20 = (bills[20000] || 0) * 20000 + (bills[10000] || 0) * 10000;
      const b25 = b20 + (bills[5000] || 0) * 5000;
      const b2 = (bills[2000] || 0) * 2000 + (bills[1000] || 0) * 1000;
      const mon = (bills[500] || 0) * 500 + (bills[100] || 0) * 100 + (bills[50] || 0) * 50 + (bills[25] || 0) * 25;
      return [{ l: "₡20k + ₡10k", v: b20 }, { l: "₡+ ₡5k", v: b25 }, { l: "₡2k + ₡1k", v: b2 }, { l: "Monedas", v: mon }];
    }
    const b20 = (bills[20] || 0) * 20 + (bills[10] || 0) * 10;
    return [{ l: "$20+$10", v: b20 }, { l: "$+$5", v: b20 + (bills[5] || 0) * 5 }, { l: "$1", v: (bills[1] || 0) * 1 }];
  };
  const denomGridCols = "grid-cols-1 md:grid-cols-[minmax(140px,1fr)_160px_minmax(140px,1fr)] lg:grid-cols-[minmax(200px,1fr)_220px_minmax(250px,1fr)]";

  return (
    <div className="relative">
      {/* ── Header ── */}
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

      {/* ── Stats Row (Compact Horizontal) ── */}
      {ap > 0 && vt > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/10 bg-[#0d1117] p-4 mb-5">
          <div className="flex items-center justify-around text-xs">
            <div className="text-center">
              <p className="text-white/30 uppercase tracking-wider mb-1">Apertura</p>
              <p className="font-semibold text-white/80">{fmt(ap)}</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-white/30 uppercase tracking-wider mb-1">Venta</p>
              <p className="font-semibold text-white/80">{fmt(vt)}</p>
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
              {calcBD().map((i) => (
                <div key={i.l} className="p-2.5 bg-[#0d1117] rounded-xl text-center border border-white/10">
                  <p className="text-white/30 mb-0.5">{i.l}</p>
                  <p className="font-medium text-white/70">{fmt(i.v)}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Denominations Table (Wider) ── */}
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
                    <p className={`text-base font-semibold tracking-tight ${cnt > 0 ? "text-white" : "text-white/20"}`}>{fmt(sub)}</p>
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

/* ════════════════════════════════════════
   CounterSidebar (New - Left Sidebar)
   ════════════════════════════════════════ */
type CounterSidebarProps = {
  data: CashCounterData[];
  active: number;
  onSelect: (i: number) => void;
  onRename: (i: number) => void;
  onAdd: () => void;
  onDelete: (i: number) => void;
  onCurrencyOpen: (i: number) => void;
  dragIdx: number | null;
  overIdx: number | null;
  onDragStart: (e: React.DragEvent, i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
};

function CounterSidebar({
  data, active, onSelect, onRename, onAdd, onDelete, onCurrencyOpen,
  dragIdx, overIdx, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
}: CounterSidebarProps) {
  const [search, setSearch] = useState("");
  const filtered = data.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full lg:w-[240px] flex-shrink-0 bg-[#0d1117] rounded-2xl border border-white/10 flex flex-col lg:h-[calc(100vh-120px)] h-auto overflow-hidden order-2 lg:order-1">
      {/* Title */}
      <div className="p-4 border-b border-white/10">
        <h3 className="text-[10px] font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent uppercase tracking-[0.2em] mb-3">Contadores</h3>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contador..."
            className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-white/10 rounded-xl text-white/70 text-xs placeholder-cyan-500/30 focus:outline-none focus:border-cyan-500/40 focus:shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all duration-300"
          />
        </div>
      </div>

      {/* Counter List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {filtered.map((tab, i) => (
          <div
            key={i}
            className={`relative group transition-all duration-300 ${overIdx === i && dragIdx !== i ? "scale-105" : ""} ${dragIdx === i ? "opacity-30" : ""}`}
            draggable={data.length > 1}
            onDragStart={(e: React.DragEvent<HTMLDivElement>) => onDragStart(e, i)}
            onDragOver={(e: React.DragEvent<HTMLDivElement>) => onDragOver(e, i)}
            onDragLeave={onDragLeave}
            onDrop={(e: React.DragEvent<HTMLDivElement>) => onDrop(e, i)}
            onDragEnd={onDragEnd}
          >
            <button
              onClick={() => onSelect(i)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                i === active
                  ? "bg-gradient-to-br from-cyan-500/20 to-teal-500/15 border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.5)] relative before:absolute before:inset-0 before:rounded-xl before:bg-cyan-500/5 before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100"
                  : "bg-transparent border-transparent hover:bg-[#0d1117]/60 hover:border-cyan-400/30 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
              }`}
            >
              <div className="flex items-center gap-3 relative">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  i === active
                    ? "bg-gradient-to-br from-cyan-500/25 to-teal-500/20 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "bg-[#0d1117] border border-white/10 group-hover:border-cyan-400/20"
                }`}>
                  <Wallet className={`w-5 h-5 ${i === active ? "text-cyan-300" : "text-white/30 group-hover:text-cyan-200/60"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate transition-colors duration-200 ${i === active ? "text-white" : "text-white/55 group-hover:text-white/80"}`}>{tab.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === active ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-white/20"}`} />
                    <span className={`text-[10px] transition-colors duration-200 ${i === active ? "text-emerald-400/80" : "text-white/30 group-hover:text-white/50"}`}>
                      {i === active ? "● Activo ahora" : "Inactivo"}
                    </span>
                  </div>
                </div>
                <div
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onRename(i); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/20 hover:text-cyan-300 rounded-lg hover:bg-cyan-500/10"
                  aria-label="Renombrar"
                >
                  <Edit3 className="w-3 h-3" />
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Add Button */}
      <div className="p-3 border-t border-white/10">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border border-dashed border-cyan-400/30 text-cyan-300/80 hover:bg-gradient-to-r hover:from-cyan-500/15 hover:to-teal-500/10 hover:border-cyan-400/50 hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo contador
        </motion.button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   RightPanel (New - Right Sidebar)
   ════════════════════════════════════════ */
type RightPanelProps = {
  data: CashCounterData;
  showExtra: boolean;
  setShowExtra: (v: boolean) => void;
  showBD: boolean;
  setShowBD: (v: boolean) => void;
  onUpdate: (d: CashCounterData) => void;
  onCurrencyOpen: () => void;
  onDelete: () => void;
};

function RightPanel({ data, showExtra, setShowExtra, showBD, setShowBD, onUpdate, onCurrencyOpen, onDelete }: RightPanelProps) {
  const bills = data.bills;
  const extra = data.extraAmount;
  const cur = data.currency;
  const t = Object.entries(bills).reduce((a, [d, c]) => a + Number(d) * Number(c), 0) + extra;
  const fmt = (n: number) => new Intl.NumberFormat(cur === "CRC" ? "es-CR" : "en-US", { style: "currency", currency: cur, minimumFractionDigits: 0 }).format(n);
  const denoms = cur === "CRC"
    ? [{ value: 20000 }, { value: 10000 }, { value: 5000 }, { value: 2000 }, { value: 1000 }, { value: 500 }, { value: 100 }, { value: 50 }, { value: 25 }]
    : [{ value: 100 }, { value: 50 }, { value: 20 }, { value: 10 }, { value: 5 }, { value: 1 }];

  const ntf = (b: BillsMap, e: number, c: "CRC" | "USD", a?: number, v?: number) =>
    onUpdate({ ...data, bills: b, extraAmount: e, currency: c, aperturaCaja: a ?? data.aperturaCaja, ventaActual: v ?? data.ventaActual });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  return (
    <div className="w-full lg:w-[19.5rem] flex-shrink-0 order-3 lg:order-3">
      <div className="lg:sticky lg:top-20 space-y-3">
        {/* Summary Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/15 border border-cyan-400/25 flex items-center justify-center mx-auto mb-4 shadow-[0_10px_35px_rgba(6,182,212,0.12)]">
            <Wallet className="w-7 h-7 text-cyan-400" />
          </div>
          <p className="text-[10px] text-white/30 uppercase tracking-[0.18em] mb-1.5">Resumen</p>
          <p className="text-[2rem] leading-none font-semibold text-white tracking-tight">{fmt(t)}</p>
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3 text-xs">
            <div className="text-center"><span className="text-white/45 block mb-0.5">Billetes</span><span className="text-white/90 font-medium">{fmt(t - extra)}</span></div>
            <div className="text-center"><span className="text-white/45 block mb-0.5">Total Billetes</span><span className="text-white/90 font-medium">{Object.values(bills).reduce((a, b) => a + b, 0)}</span></div>
            <div className="text-center"><span className="text-white/45 block mb-0.5">Extra</span><span className="text-white/90 font-medium">{fmt(extra)}</span></div>
            <div className="text-center"><span className="text-white/45 block mb-0.5">Activas</span><span className="text-white/90 font-medium">{Object.values(bills).filter((c) => c > 0).length}/{denoms.length}</span></div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-[0.16em] mb-3">Acciones rápidas</p>
          <div className="space-y-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowExtra(!showExtra)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/30 to-cyan-500/25 hover:from-emerald-500/40 hover:to-cyan-500/30 text-emerald-50 text-xs font-medium transition-all duration-200 border border-emerald-400/30">
              <Plus className="w-3.5 h-3.5" /> {showExtra ? "Cerrar Extra" : "Monto Adicional"}
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowBD(!showBD)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d1117] hover:bg-[#0d1117] text-white/75 hover:text-white text-xs font-medium transition-all duration-200 border border-white/10">
              <TrendingUp className="w-3.5 h-3.5" /> {showBD ? "Ocultar Desglose" : "Ver Desglose"}
            </motion.button>
          </div>
        </div>

        {/* Tools */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-[0.16em] mb-3">Herramientas</p>
          <div className="flex items-center justify-center gap-2">
            {[
              { icon: Eraser, label: "Limpiar", color: "text-amber-400 hover:text-amber-300", border: "border-amber-400/20 hover:border-amber-400/40", bg: "bg-amber-500/10 hover:bg-amber-500/20", action: () => setClearConfirmOpen(true) },
              { icon: Download, label: "Exportar", color: "text-emerald-400 hover:text-emerald-300", border: "border-emerald-400/20 hover:border-emerald-400/40", bg: "bg-emerald-500/10 hover:bg-emerald-500/20", action: () => { const c = JSON.stringify({ name: data.name, bills, extraAmount: extra, currency: cur, aperturaCaja: data.aperturaCaja, ventaActual: data.ventaActual }); const b = new Blob([c], { type: "application/json" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${data.name}.json`; a.click(); URL.revokeObjectURL(u); } },
              { icon: Upload, label: "Importar", color: "text-blue-400 hover:text-blue-300", border: "border-blue-400/20 hover:border-blue-400/40", bg: "bg-blue-500/10 hover:bg-blue-500/20", action: () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json"; inp.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return; new FileReader().onload = (e) => { try { const p = JSON.parse(e.target?.result as string); if (p && typeof p.name === "string" && typeof p.extraAmount === "number" && (p.currency === "CRC" || p.currency === "USD") && typeof p.bills === "object") { ntf(p.bills, p.extraAmount, p.currency, p.aperturaCaja || 0, p.ventaActual || 0); } else alert("JSON inválido."); } catch { alert("Error."); } }; (new FileReader()).readAsText(f); }; inp.click(); } },
              { icon: DollarSign, label: "Moneda", color: "text-yellow-400 hover:text-yellow-300", border: "border-yellow-400/20 hover:border-yellow-400/40", bg: "bg-yellow-500/10 hover:bg-yellow-500/20", action: onCurrencyOpen },
              { icon: Trash2, label: "Eliminar", color: "text-red-400 hover:text-red-300", border: "border-red-400/20 hover:border-red-400/40", bg: "bg-red-500/10 hover:bg-red-500/20", action: () => setConfirmOpen(true) },
            ].map((b) => (
              <button key={b.label} onClick={b.action} className={`w-8 h-8 rounded-lg ${b.bg} border ${b.border} flex items-center justify-center ${b.color} transition-all`} aria-label={b.label}>
                <b.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Extra Panel */}
        <AnimatePresence>
          {showExtra && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-white/10 bg-[#0d1117] p-3 space-y-2.5">
              <p className="text-[10px] text-white/35 uppercase tracking-[0.16em]">Extra</p>
              <div className="bg-[#050816] border border-white/10 rounded-xl p-2 flex items-center">
                <input type="text" inputMode="numeric" value={extra === 0 ? "" : fmt(extra)} onChange={(e) => {
                  let r = e.target.value;
                  if (cur === "CRC") { r = r.replace(/\D/g, ""); ntf(bills, r === "" ? 0 : parseInt(r, 10), cur); }
                  else { r = r.replace(/[^0-9.]/g, ""); const p = parseFloat(r); ntf(bills, isNaN(p) ? 0 : p, cur); }
                }}
                  className="w-full bg-transparent text-white text-right text-sm focus:outline-none placeholder-white/10" placeholder="0" />
                <button onClick={() => ntf(bills, 0, cur)} className="ml-2 text-white/20 hover:text-red-400/60 transition-colors"><Trash2 className="w-3 h-3" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {confirmOpen && (
            <BaseModal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmar eliminación">
              <p className="text-center text-white/80 mb-4">¿Estás seguro de eliminar este contador?</p>
              <div className="flex justify-end gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white">Cancelar</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { onDelete(); setConfirmOpen(false); }} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400"><Trash2 className="w-4 h-4" /> Eliminar</motion.button>
              </div>
            </BaseModal>
          )}
          {clearConfirmOpen && (
            <BaseModal isOpen={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} title="Confirmar limpieza">
              <p className="text-center text-white/80 mb-4">¿Estás seguro de limpiar este contador?</p>
              <div className="flex justify-end gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setClearConfirmOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white">Cancelar</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { const r: BillsMap = {}; denoms.forEach((d) => { r[d.value] = 0; }); ntf(r, 0, cur, 0, 0); setClearConfirmOpen(false); }} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"><Eraser className="w-4 h-4" /> Limpiar</motion.button>
              </div>
            </BaseModal>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Modales pequeñas ── */
function RenameModal({ isOpen, currentName, onSave, onClose }: { isOpen: boolean; currentName: string; onSave: (n: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isOpen && ref.current) setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 100); }, [isOpen]);
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Renombrar">
      <div className="bg-[#0d1117] border border-white/10 rounded-xl mb-3 flex items-center px-3 py-2">
        <input ref={ref} type="text" key={currentName} defaultValue={currentName} onKeyDown={(e) => { if (e.key === "Enter") { const v = e.currentTarget.value; onSave(v.trim() === "" ? currentName : v); onClose(); } }}
          className="w-full bg-transparent text-white text-right text-sm focus:outline-none placeholder-white/10" />
      </div>
      <button onClick={() => { const v = ref.current?.value ?? ""; onSave(v.trim() === "" ? currentName : v); onClose(); }}
        className="w-full bg-white/10 hover:bg-white/15 text-white rounded-xl py-2.5 text-sm font-medium transition-all duration-200">
        Guardar
      </button>
    </BaseModal>
  );
}

function CurrencyModal({ isOpen, currentCurrency, onSave, onClose }: { isOpen: boolean; currentCurrency: "CRC" | "USD"; onSave: (c: "CRC" | "USD") => void; onClose: () => void }) {
  const [sel, setSel] = useState(currentCurrency);
  const [touched, setTouched] = useState(false);
  const eff = touched ? sel : currentCurrency;
  return (
    <BaseModal isOpen={isOpen} onClose={() => { setTouched(false); setSel(currentCurrency); onClose(); }} title="Moneda">
      <div className="flex gap-3 mb-4">
        {(["CRC", "USD"] as const).map((opt) => (
          <button key={opt} onClick={() => { setTouched(true); setSel(opt); }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${eff === opt ? "bg-white/10 text-white border border-white/10" : "bg-[#0d1117] text-white/40 hover:text-white/60 border border-white/10"}`}>
            {opt === "CRC" ? "Colones" : "Dólares"}
          </button>
        ))}
      </div>
      <button onClick={() => { onSave(eff); setTouched(false); setSel(currentCurrency); onClose(); }}
        className="w-full bg-white/10 hover:bg-white/15 text-white rounded-xl py-2.5 text-sm font-medium transition-all duration-200">
        Guardar
      </button>
    </BaseModal>
  );
}

function MenuModal({ isOpen, onClose, onExport, onImport, onClear, storageInfo }: { isOpen: boolean; onClose: () => void; onExport: () => void; onImport: () => void; onClear: () => void; storageInfo: string }) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Gestión">
      <div className="space-y-2.5">
        <div className="bg-[#0d1117] rounded-xl p-2.5 text-center border border-white/10">
          <span className="text-xs text-white/30">{storageInfo}</span>
        </div>
        {[
          { label: "Exportar", icon: Save, action: () => { onExport(); onClose(); } },
          { label: "Importar", icon: FolderOpen, action: () => { onImport(); onClose(); } },
          { label: "Restablecer", icon: RotateCcw, action: () => { onClear(); onClose(); } },
        ].map((b) => (
          <button key={b.label} onClick={b.action}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0d1117] hover:bg-[#0d1117] text-white/50 hover:text-white/70 rounded-xl text-sm font-medium transition-all duration-200 border border-white/10">
            <b.icon className="w-4 h-4" /> {b.label}
          </button>
        ))}
      </div>
    </BaseModal>
  );
}

/* ════════════════════════════════════════
   CASH COUNTER TABS (Principal - 3 Column Layout)
   ════════════════════════════════════════ */
export default function CashCounterTabs() {
  const { user } = useAuth();
  const [data, setData] = useState<CashCounterData[]>([]);
  const [active, setActive] = useState(0);
  const [calcOpen, setCalcOpen] = useState(false);
  const [sinpeOpen, setSinpeOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameIdx, setRenameIdx] = useState(0);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const [showBD, setShowBD] = useState(false);

  const save = async (d: CashCounterData[], i: number) => {
    setSaving(true);
    try { window.localStorage.setItem("cashCounters", JSON.stringify({ counters: d, activeTab: i, lastSaved: new Date().toISOString() })); setLastSaved(new Date().toLocaleTimeString()); await new Promise((r) => setTimeout(r, 400)); }
    catch { alert("Error al guardar."); } finally { setSaving(false); }
  };

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("cashCounters");
      if (s) {
        const p = JSON.parse(s);
        let c: CashCounterData[], a = 0;
        if (Array.isArray(p)) c = p;
        else if (p.counters) { c = p.counters; a = p.activeTab || 0; }
        else throw new Error("bad format");
        const n = c.map((item, i) => ({ name: item.name || `Contador ${i + 1}`, bills: item.bills || {}, extraAmount: item.extraAmount || 0, currency: (item.currency as "CRC" | "USD") || "CRC", aperturaCaja: item.aperturaCaja || 0, ventaActual: item.ventaActual || 0 }));
        setData(n); setActive(Math.min(a, n.length - 1));
      } else { const d = [{ name: "Contador 1", bills: {}, extraAmount: 0, currency: "CRC" as "CRC" | "USD", aperturaCaja: 0, ventaActual: 0 }]; setData(d); setActive(0); save(d, 0); }
    } catch { const d = [{ name: "Contador 1", bills: {}, extraAmount: 0, currency: "CRC" as "CRC" | "USD", aperturaCaja: 0, ventaActual: 0 }]; setData(d); setActive(0); }
  }, []);
  useEffect(() => { if (data.length > 0) save(data, active); }, [data, active]);

  const add = () => { const n = { name: `Contador ${data.length + 1}`, bills: {}, extraAmount: 0, currency: "CRC" as "CRC" | "USD", aperturaCaja: 0, ventaActual: 0 }; const d = [...data, n]; setData(d); setActive(data.length); save(d, data.length); };
  const del = (i: number) => { if (data.length <= 1) { alert("No puedes eliminar el último."); return; } const d = data.filter((_, j) => j !== i); let a = active; if (active === i) a = 0; else if (active > i) a = active - 1; setData(d); setActive(a); save(d, a); };
  const upd = (i: number, d: CashCounterData) => { const n = [...data]; n[i] = d; setData(n); save(n, active); };

  const hDS = (e: React.DragEvent, i: number) => {
    setDragIdx(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/html", "");
    const img = document.createElement("div"); img.textContent = data[i].name; img.style.cssText = "position:absolute;top:-1000px;background:#050816;padding:8px 16px;border-radius:9999px;font-size:14px;color:white;border:2px solid #555"; document.body.appendChild(img); e.dataTransfer.setDragImage(img, 50, 20); setTimeout(() => document.body.removeChild(img), 0);
  };
  const hDO = (e: React.DragEvent, i: number) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragIdx !== i) setOverIdx(i); };
  const hDL = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverIdx(null); };
  const hDrop = (e: React.DragEvent, drop: number) => {
    e.preventDefault(); if (dragIdx === null || dragIdx === drop) { setDragIdx(null); setOverIdx(null); return; }
    const n = [...data]; const t = n[dragIdx]; n.splice(dragIdx, 1); n.splice(drop, 0, t);
    let a = active; if (active === dragIdx) a = drop; else if (active > dragIdx && active <= drop) a = active - 1; else if (active < dragIdx && active >= drop) a = active + 1;
    setData(n); setActive(a); save(n, a); setDragIdx(null); setOverIdx(null);
  };
  const hDE = () => { setDragIdx(null); setOverIdx(null); };

  const exp = () => { try { const b = new Blob([JSON.stringify({ version: "1.0", counters: data, activeTab: active }, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `cash-counter-${new Date().toISOString().split("T")[0]}.json`; a.click(); URL.revokeObjectURL(u); } catch { alert("Error."); } };
  const imp = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json";
    inp.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
      new FileReader().onload = (ev) => {
        try {
          const d = JSON.parse(ev.target?.result as string);
          if (d.counters && Array.isArray(d.counters)) {
            const n = d.counters.map((item: unknown, i: number) => { const ci = item as Record<string, unknown>; return { name: (typeof ci.name === "string" ? ci.name : null) || `C${i + 1}`, bills: (typeof ci.bills === "object" && ci.bills !== null ? ci.bills : {}) as BillsMap, extraAmount: (typeof ci.extraAmount === "number" ? ci.extraAmount : null) || 0, currency: (ci.currency === "CRC" || ci.currency === "USD" ? ci.currency : "CRC") as "CRC" | "USD", aperturaCaja: (typeof ci.aperturaCaja === "number" ? ci.aperturaCaja : null) || 0, ventaActual: (typeof ci.ventaActual === "number" ? ci.ventaActual : null) || 0 }; });
            setData(n); setActive(0); save(n, 0); alert(`✅ ${n.length} cargados.`);
          } else alert("❌ Formato inválido.");
        } catch { alert("❌ Error."); }
      }; new FileReader().readAsText(f);
    }; inp.click();
  };
  const storageInfo = () => { try { const d = window.localStorage.getItem("cashCounters"); if (d) return `${data.length} contadores • ${(new Blob([d]).size / 1024).toFixed(2)} KB`; return "Sin datos"; } catch { return "Error"; } };
  const clear = () => {
    if (confirm(`⚠️ ¿Borrar todos?\n\n${storageInfo()}`)) {
      try { window.localStorage.removeItem("cashCounters"); const d = [{ name: "Contador 1", bills: {}, extraAmount: 0, currency: "CRC" as "CRC" | "USD", aperturaCaja: 0, ventaActual: 0 }]; setData(d); setActive(0); save(d, 0); alert("✅ Restablecido."); } catch { alert("❌ Error."); }
    }
  };

  if (!hasPermission(user?.permissions, "cashcounter")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm bg-[#0d1117] rounded-2xl border border-white/10 p-10">
          <div className="w-12 h-12 rounded-xl bg-[#0d1117] border border-white/10 flex items-center justify-center mx-auto mb-4">
            <LockIcon className="w-6 h-6 text-white/30" />
          </div>
          <h3 className="text-lg font-semibold text-white/80 mb-2">Acceso Restringido</h3>
          <p className="text-sm text-white/30">No tienes permisos para acceder al Contador de Efectivo.</p>
          <p className="text-xs text-white/20 mt-2">Contacta a un administrador.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] pb-28">
      {/* ── Hero Header ── */}
      <div className="relative mb-7 p-5 sm:p-6">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/15 border border-cyan-400/30 flex items-center justify-center shadow-[0_12px_35px_rgba(6,182,212,0.18)]">
              <Banknote className="w-8 h-8 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Cash Counter</h1>
              <p className="text-sm text-white/45 mt-1 font-medium tracking-wide">Administra y controla el efectivo por tipos de billetes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <AnimatePresence mode="wait">
              {saving ? (
                <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-cyan-300/90 bg-cyan-500/10 rounded-lg px-3 py-1.5 border border-cyan-400/20 flex items-center">
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-cyan-200/70 mr-1.5" /> Guardando...
                </motion.span>
              ) : lastSaved ? (
                <motion.span key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-cyan-300/90 bg-cyan-500/10 rounded-lg px-3 py-1.5 border border-cyan-400/20">
                  Guardado {lastSaved}
                </motion.span>
              ) : null}
            </AnimatePresence>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setMenuOpen(true)}
              className="w-10 h-10 rounded-xl bg-[#0d1117] border border-white/10 flex items-center justify-center text-cyan-200/70 hover:text-cyan-200 hover:border-cyan-400/30 transition-all">
              <Layers className="w-4.5 h-4.5" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── 3 Column Layout (responsive: stack on mobile) ── */}
      <div className="flex flex-col lg:flex-row gap-6 max-w-[1800px] mx-auto px-4 sm:px-6">
        {/* Left Sidebar - Counter Navigation */}
        <CounterSidebar
          data={data}
          active={active}
          onSelect={(i) => { setActive(i); save(data, i); }}
          onRename={(i) => { setRenameIdx(i); setRenameOpen(true); }}
          onAdd={add}
          onDelete={del}
          onCurrencyOpen={(i) => { setRenameIdx(i); setCurrencyOpen(true); }}
          dragIdx={dragIdx}
          overIdx={overIdx}
          onDragStart={hDS}
          onDragOver={hDO}
          onDragLeave={hDL}
          onDrop={hDrop}
          onDragEnd={hDE}
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0 order-1 lg:order-2">
          {data.length > 0 ? (
            <CashCounter
              id={active}
              data={data[active]}
              onUpdate={upd}
              onDelete={del}
              onCurrencyOpen={() => setCurrencyOpen(true)}
            />
          ) : (
            <div className="text-center text-white/15 flex flex-col items-center py-12">
              <Inbox className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No hay contadores. Presiona &ldquo;+ Nuevo&rdquo;.</p>
            </div>
          )}
        </div>

        {/* Right Panel */}
        {data.length > 0 && (
          <RightPanel
            data={data[active]}
            showExtra={showExtra}
            setShowExtra={setShowExtra}
            showBD={showBD}
            setShowBD={setShowBD}
            onUpdate={(d) => upd(active, d)}
            onCurrencyOpen={() => setCurrencyOpen(true)}
            onDelete={() => del(active)}
          />
        )}
      </div>

      {/* ── FABs ── */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2.5">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setSinpeOpen(true)}
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/15 border border-emerald-500/25 flex items-center justify-center shadow-lg text-emerald-400 hover:text-emerald-300 transition-all"
          aria-label="SINPE">
          <Smartphone className="w-5 h-5" />
        </motion.button>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setCalcOpen(true)}
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/15 border border-cyan-500/25 flex items-center justify-center shadow-lg text-cyan-400 hover:text-cyan-300 transition-all"
          aria-label="Calculadora">
          <CalculatorIcon className="w-5 h-5" />
        </motion.button>
      </div>

      {/* ── Modales ── */}
      <AnimatePresence>{calcOpen && <CalculatorModal isOpen={calcOpen} onClose={() => setCalcOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{sinpeOpen && <SinpeModal isOpen={sinpeOpen} onClose={() => setSinpeOpen(false)} currency={data[active]?.currency || "CRC"} />}</AnimatePresence>
      <AnimatePresence>{renameOpen && <RenameModal isOpen={renameOpen} currentName={data[renameIdx]?.name || ""} onSave={(n) => upd(renameIdx, { ...data[renameIdx], name: n })} onClose={() => setRenameOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{currencyOpen && <CurrencyModal isOpen={currencyOpen} currentCurrency={data[active]?.currency || "CRC"} onSave={(c) => upd(active, { ...data[active], currency: c, bills: {}, extraAmount: 0, aperturaCaja: 0, ventaActual: 0 })} onClose={() => setCurrencyOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{menuOpen && <MenuModal isOpen={menuOpen} onClose={() => setMenuOpen(false)} onExport={exp} onImport={imp} onClear={clear} storageInfo={storageInfo()} />}</AnimatePresence>
    </div>
  );
}
