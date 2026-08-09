"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Wallet, Search, Edit3 } from "lucide-react";
import type { CounterSidebarProps } from "../types";

export function CounterSidebar({
  data, active, onSelect, onRename, onAdd,
  dragIdx, overIdx, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: CounterSidebarProps) {
  const [search, setSearch] = useState("");

  return (
    <div className="w-full lg:w-[240px] flex-shrink-0 bg-[#0d1117] rounded-2xl border border-white/10 flex flex-col lg:h-[calc(100vh-120px)] h-auto overflow-hidden order-2 lg:order-1">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-[10px] font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent uppercase tracking-[0.2em] mb-3">Contadores</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/40" />
          <input type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contador..."
            className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-white/10 rounded-xl text-white/70 text-xs placeholder-cyan-500/30 focus:outline-none focus:border-cyan-500/40 focus:shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all duration-300" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {data
          .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
          .map((tab, i) => (
            <div key={i}
              className={`relative group transition-all duration-300 ${overIdx === i && dragIdx !== i ? "scale-105" : ""} ${dragIdx === i ? "opacity-30" : ""}`}
              draggable={data.length > 1}
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, i)}
              onDragEnd={onDragEnd}>
              <button onClick={() => onSelect(i)}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                  i === active
                    ? "bg-gradient-to-br from-cyan-500/20 to-teal-500/15 border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                    : "bg-transparent border-transparent hover:bg-[#0d1117]/60 hover:border-cyan-400/30 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                }`}>
                <div className="flex items-center gap-3">
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
                  <div role="button" onClick={(e) => { e.stopPropagation(); onRename(i); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/20 hover:text-cyan-300 rounded-lg hover:bg-cyan-500/10" aria-label="Renombrar">
                    <Edit3 className="w-3 h-3" />
                  </div>
                </div>
              </button>
            </div>
          ))}
      </div>

      <div className="p-3 border-t border-white/10">
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border border-dashed border-cyan-400/30 text-cyan-300/80 hover:bg-gradient-to-r hover:from-cyan-500/15 hover:to-teal-500/10 hover:border-cyan-400/50 hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]">
          <Plus className="w-3.5 h-3.5" /> Nuevo contador
        </motion.button>
      </div>
    </div>
  );
}
