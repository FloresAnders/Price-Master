"use client";

import { useEffect, useRef } from "react";
import { BaseModal } from "./BaseModal";

export function RenameModal({ isOpen, currentName, onSave, onClose }: {
  isOpen: boolean; currentName: string; onSave: (n: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && ref.current) setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 100);
  }, [isOpen]);

  const handleSave = () => {
    const v = ref.current?.value ?? "";
    onSave(v.trim() === "" ? currentName : v);
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Renombrar">
      <div className="bg-[#0d1117] border border-white/10 rounded-xl mb-3 flex items-center px-3 py-2">
        <input ref={ref} type="text" key={currentName} defaultValue={currentName}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          className="w-full bg-transparent text-white text-right text-sm focus:outline-none placeholder-white/10" />
      </div>
      <button onClick={handleSave}
        className="w-full bg-white/10 hover:bg-white/15 text-white rounded-xl py-2.5 text-sm font-medium transition-all duration-200">
        Guardar
      </button>
    </BaseModal>
  );
}
