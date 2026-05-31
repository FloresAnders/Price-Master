"use client";

import { useState } from "react";
import { BaseModal } from "./BaseModal";

export function CurrencyModal({ isOpen, currentCurrency, onSave, onClose }: {
  isOpen: boolean; currentCurrency: "CRC" | "USD"; onSave: (c: "CRC" | "USD") => void; onClose: () => void;
}) {
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
