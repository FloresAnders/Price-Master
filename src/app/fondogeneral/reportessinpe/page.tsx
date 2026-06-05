"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  Lock,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultPermissions } from "@/utils/permissions";

const todayValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const displayDate = (value: string) => {
  if (!value) return "--/--/----";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

export default function ReportesSinpePage() {
  const { user, loading } = useAuth();
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const canUse = Boolean(permissions.reportessinpe);

  const [startDate, setStartDate] = useState(todayValue);
  const [endDate, setEndDate] = useState(todayValue);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [hasGenerated, setHasGenerated] = useState(false);

  const summary = useMemo(
    () => ({
      emails: hasGenerated ? 0 : 0,
      valid: hasGenerated ? 0 : 0,
      total: hasGenerated ? 0 : 0,
    }),
    [hasGenerated],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-white/10 bg-[#071120] p-8 text-center text-white/70">
          Cargando permisos...
        </div>
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-white/10 bg-[#071120] p-10 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-white/40" />
          <h2 className="text-xl font-semibold text-white">
            Acceso restringido
          </h2>
          <p className="mt-2 text-sm text-white/60">
            No tienes permisos para usar Reportes SINPE.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-white">
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(83,193,255,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(165,61,255,0.24),_transparent_28%),linear-gradient(180deg,_#071120_0%,_#090f1d_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
            <Mail className="h-7 w-7 text-violet-300" />
          </div>
          <h1 className="text-3xl font-semibold">Reportes SINPE</h1>
          <p className="mt-2 text-sm text-white/60">
            Genera reportes a partir de transacciones SINPE en el rango
            seleccionado.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#091426]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6">
          <div className="mb-5 flex items-center gap-2 text-cyan-300">
            <CalendarDays className="h-5 w-5" />
            <span className="text-sm font-semibold">Rango de consulta</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">
                Fecha inicio
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
                />
                <CalendarDays className="h-4 w-4 text-cyan-300" />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-white/70">
                Hora inicio
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3">
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
                />
                <Clock3 className="h-4 w-4 text-cyan-300" />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-white/70">
                Fecha fin
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3">
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
                />
                <CalendarDays className="h-4 w-4 text-cyan-300" />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-white/70">
                Hora fin
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3">
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
                />
                <Clock3 className="h-4 w-4 text-cyan-300" />
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setHasGenerated(true)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,_#2ab5ff_0%,_#9d4edd_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Generar
          </button>
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-[#091426]/90 p-5 sm:p-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            {hasGenerated
              ? `Listo para generar ${displayDate(startDate)} - ${displayDate(endDate)}`
              : "Configura el rango para generar"}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
              <div className="mb-3 flex items-center gap-3 text-cyan-300">
                <Mail className="h-5 w-5" />
                <span className="text-sm text-white/70">
                  Correos procesados
                </span>
              </div>
              <div className="text-3xl font-semibold">{summary.emails}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
              <div className="mb-3 flex items-center gap-3 text-violet-300">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm text-white/70">
                  Transacciones válidas
                </span>
              </div>
              <div className="text-3xl font-semibold">{summary.valid}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
              <div className="mb-3 flex items-center gap-3 text-emerald-300">
                <Wallet className="h-5 w-5" />
                <span className="text-sm text-white/70">Monto total</span>
              </div>
              <div className="text-3xl font-semibold">
                ₡{summary.total.toLocaleString("es-CR")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
