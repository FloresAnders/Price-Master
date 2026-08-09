"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { fmtCurrency } from "../utils";
import { BaseModal } from "./BaseModal";

export function SinpeModal({ isOpen, onClose, currency }: {
  isOpen: boolean; onClose: () => void; currency: "CRC" | "USD";
}) {
  const [ma, setMa] = useState(0);
  const [mr, setMr] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const total = ma + mr;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Verificador SINPE">
      <div className="space-y-4">
        <div>
          <label className="block text-white/40 text-xs font-medium mb-1.5">
            Monto Actual <span className="text-white/20">(pegar aquí)</span>
          </label>
          <div className="bg-[#0d1117] border border-white/10 rounded-xl p-3 flex items-center">
            <input type="number" min="0" step="0.01" value={ma || ""}
              onChange={(e) => setMa(e.target.value === "" ? 0 : Number(e.target.value))}
              onPaste={async (e) => {
                e.preventDefault();
                try {
                  const n = parseFloat(e.clipboardData.getData("text").replace(/[^\d.,]/g, "").replace(",", "."));
                  if (!isNaN(n)) setMa(n);
                } catch {}
              }}
              className="w-full bg-transparent text-white text-right text-base focus:outline-none placeholder-white/10" placeholder="0" />
          </div>
          <p className="text-xs text-white/20 mt-1">{fmtCurrency(ma, currency)}</p>
        </div>
        <div>
          <label className="block text-white/40 text-xs font-medium mb-1.5">Monto a Recibir</label>
          <div className="bg-[#0d1117] border border-white/10 rounded-xl p-3 flex items-center">
            <input type="number" min="0" step="0.01" value={mr || ""}
              onChange={(e) => setMr(e.target.value === "" ? 0 : Number(e.target.value))}
              className="w-full bg-transparent text-white text-right text-base focus:outline-none placeholder-white/10" placeholder="0" />
          </div>
          <p className="text-xs text-white/20 mt-1">{fmtCurrency(mr, currency)}</p>
        </div>
        <div className="bg-[#0d1117] rounded-xl p-4 border border-white/10 text-center">
          <p className="text-white/30 text-xs mb-1">Total Esperado</p>
          <p className="text-xl font-semibold text-white">{fmtCurrency(total, currency)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setMa(total); setMr(0); }} disabled={total === 0}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${total > 0 ? "bg-white/10 hover:bg-white/15 text-white" : "bg-[#0d1117] text-white/20 cursor-not-allowed"}`}>
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
