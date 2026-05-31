"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock as LockIcon, Banknote, Layers, Smartphone, Calculator as CalculatorIcon,
  Inbox,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { hasPermission } from "../../../utils/permissions";
import { useCashCounter } from "./hooks/useCashCounter";
import { CashCounter } from "./components/CashCounter";
import { CounterSidebar } from "./components/CounterSidebar";
import { RightPanel } from "./components/RightPanel";
import { SinpeModal } from "./components/SinpeModal";
import { RenameModal } from "./components/RenameModal";
import { CurrencyModal } from "./components/CurrencyModal";
import { MenuModal } from "./components/MenuModal";
import { CalculatorModal } from "../../modals";

export default function CashCounterTabs() {
  const { user } = useAuth();
  const {
    data, active, setActive, lastSaved, saving, save,
    add, del, upd,
    dragIdx, overIdx, hDS, hDO, hDL, hDrop, hDE,
    exp, imp, clear, storageInfo,
  } = useCashCounter();

  const [calcOpen, setCalcOpen] = useState(false);
  const [sinpeOpen, setSinpeOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameIdx, setRenameIdx] = useState(0);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [showBD, setShowBD] = useState(false);

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
                <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[11px] text-cyan-300/90 bg-cyan-500/10 rounded-lg px-3 py-1.5 border border-cyan-400/20 flex items-center">
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-cyan-200/70 mr-1.5" /> Guardando...
                </motion.span>
              ) : lastSaved ? (
                <motion.span key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[11px] text-cyan-300/90 bg-cyan-500/10 rounded-lg px-3 py-1.5 border border-cyan-400/20">
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

      <div className="flex flex-col lg:flex-row gap-6 max-w-[1800px] mx-auto px-4 sm:px-6">
        <CounterSidebar
          data={data}
          active={active}
          onSelect={(i) => { setActive(i); save(data, i); }}
          onRename={(i) => { setRenameIdx(i); setRenameOpen(true); }}
          onAdd={add}
          dragIdx={dragIdx}
          overIdx={overIdx}
          onDragStart={hDS}
          onDragOver={hDO}
          onDragLeave={hDL}
          onDrop={hDrop}
          onDragEnd={hDE}
        />

        <div className="flex-1 min-w-0 order-1 lg:order-2">
          {data.length > 0 ? (
            <CashCounter id={active} data={data[active]} showBD={showBD} onUpdate={upd} />
          ) : (
            <div className="text-center text-white/15 flex flex-col items-center py-12">
              <Inbox className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No hay contadores. Presiona &ldquo;+ Nuevo&rdquo;.</p>
            </div>
          )}
        </div>

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

      <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2.5">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setSinpeOpen(true)}
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/15 border border-emerald-500/25 flex items-center justify-center shadow-lg text-emerald-400 hover:text-emerald-300 transition-all" aria-label="SINPE">
          <Smartphone className="w-5 h-5" />
        </motion.button>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setCalcOpen(true)}
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/15 border border-cyan-500/25 flex items-center justify-center shadow-lg text-cyan-400 hover:text-cyan-300 transition-all" aria-label="Calculadora">
          <CalculatorIcon className="w-5 h-5" />
        </motion.button>
      </div>

      <AnimatePresence>{calcOpen && <CalculatorModal isOpen={calcOpen} onClose={() => setCalcOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{sinpeOpen && <SinpeModal isOpen={sinpeOpen} onClose={() => setSinpeOpen(false)} currency={data[active]?.currency || "CRC"} />}</AnimatePresence>
      <AnimatePresence>{renameOpen && <RenameModal isOpen={renameOpen} currentName={data[renameIdx]?.name || ""} onSave={(n) => upd(renameIdx, { ...data[renameIdx], name: n })} onClose={() => setRenameOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{currencyOpen && <CurrencyModal isOpen={currencyOpen} currentCurrency={data[active]?.currency || "CRC"} onSave={(c) => upd(active, { ...data[active], currency: c, bills: {}, extraAmount: 0, aperturaCaja: 0, ventaActual: 0 })} onClose={() => setCurrencyOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{menuOpen && <MenuModal isOpen={menuOpen} onClose={() => setMenuOpen(false)} onExport={exp} onImport={imp} onClear={clear} storageInfo={storageInfo()} />}</AnimatePresence>
    </div>
  );
}
