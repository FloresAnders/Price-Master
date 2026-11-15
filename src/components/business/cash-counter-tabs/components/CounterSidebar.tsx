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
    <div className="sticky top-20 z-40 w-full flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] lg:static lg:z-auto lg:flex lg:h-[calc(100vh-120px)] lg:w-[240px] lg:flex-col">
      <div className="border-b border-white/10 p-3 lg:p-4">
        <h3 className="text-[10px] font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent uppercase tracking-[0.2em] mb-3">Contadores</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/40" />
          <input type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contador..."
            className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-white/10 rounded-xl text-white/70 text-xs placeholder-cyan-500/30 focus:outline-none focus:border-cyan-500/40 focus:shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all duration-300" />
        </div>
      </div>

      <div className="flex flex-1 gap-2 overflow-x-auto p-2 scrollbar-thin lg:block lg:space-y-2 lg:overflow-y-auto lg:p-3">
        {data
          .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
          .map((tab, i) => (
            <div key={i}
              className={`relative group min-w-[150px] transition-all duration-300 lg:min-w-0 ${overIdx === i && dragIdx !== i ? "scale-105" : ""} ${dragIdx === i ? "opacity-30" : ""}`}
              draggable={data.length > 1}
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, i)}
              onDragEnd={onDragEnd}>
              <button onClick={() => onSelect(i)}
                className={`h-full w-full rounded-xl border p-2.5 text-left transition-all duration-200 lg:h-auto lg:p-3 ${
                  i === active
                    ? "bg-gradient-to-br from-cyan-500/20 to-teal-500/15 border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                    : "bg-transparent border-transparent hover:bg-[#0d1117]/60 hover:border-cyan-400/30 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-300 lg:h-10 lg:w-10 ${
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
                      <span className={`hidden text-[10px] transition-colors duration-200 lg:block ${i === active ? "text-emerald-400/80" : "text-white/30 group-hover:text-white/50"}`}>
                        {i === active ? "● Activo ahora" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                  {!tab.accountId && (
                    <div role="button" onClick={(e) => { e.stopPropagation(); onRename(i); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/20 hover:text-cyan-300 rounded-lg hover:bg-cyan-500/10" aria-label="Renombrar">
                      <Edit3 className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </button>
            </div>
          ))}
      </div>

      <div className="border-t border-white/10 p-2 lg:p-3">
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border border-dashed border-cyan-400/30 text-cyan-300/80 hover:bg-gradient-to-r hover:from-cyan-500/15 hover:to-teal-500/10 hover:border-cyan-400/50 hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]">
          <Plus className="w-3.5 h-3.5" /> Nuevo contador
        </motion.button>
      </div>
    </div>
  );
}
