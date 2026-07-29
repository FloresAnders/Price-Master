"use client";

import { useEffect } from "react";
import { Banknote, X } from "lucide-react";
import CashCounterTabs from "@/components/business/cash-counter-tabs/CashCounterTabs";

type CashCounterModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CashCounterModal({
  isOpen,
  onClose,
}: CashCounterModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <div className="flex h-dvh w-full flex-col p-2 sm:p-4">
        <div className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white shadow-2xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15">
              <Banknote className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">
                Contador de Efectivo
              </h2>
              <p className="truncate text-xs text-white/45">
                Modal flotante
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar contador"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#050816] shadow-2xl">
          <CashCounterTabs />
        </div>
      </div>
    </div>
  );
}
