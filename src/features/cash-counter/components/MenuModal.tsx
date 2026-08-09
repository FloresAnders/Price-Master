"use client";

import { BaseModal } from "./BaseModal";
import { Save, FolderOpen, RotateCcw } from "lucide-react";

export function MenuModal({ isOpen, onClose, onExport, onImport, onClear, storageInfo }: {
  isOpen: boolean; onClose: () => void; onExport: () => void; onImport: () => void; onClear: () => void; storageInfo: string;
}) {
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
