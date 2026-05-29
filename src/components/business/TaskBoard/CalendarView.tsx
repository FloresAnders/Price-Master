"use client";

import { CalendarDays } from "lucide-react";

export default function CalendarView() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
        <CalendarDays className="w-6 h-6 text-cyan-400" />
      </div>
      <h3 className="text-base font-semibold text-white/70 mb-1">Vista Calendario</h3>
      <p className="text-sm text-white/40 max-w-xs">
        Próximamente podrás ver y gestionar tus tarjetas en un calendario.
      </p>
    </div>
  );
}
