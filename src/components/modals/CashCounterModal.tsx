"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Banknote, Loader2, X } from "lucide-react";

// The cash counter (and framer-motion, which it depends on) is only needed once
// the modal is actually opened from the header. Loading it lazily keeps it out
// of the initial bundle of every route while behaving exactly like before: the
// modal shell renders immediately and its content fades in as a normal load.
const CashCounterTabs = dynamic(
  () => import("@/components/business/cash-counter-tabs/CashCounterTabs"),
  {
    ssr: false,
    loading: ({ error, retry }: { error?: Error | null; retry?: () => void }) =>
      error ? (
        <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-white/70">
          <p>No se pudo cargar el contador de efectivo.</p>
          <button
            type="button"
            onClick={() => retry?.()}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="flex h-full min-h-[240px] w-full items-center justify-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando contador...
        </div>
      ),
  },
);

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
