"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useActorOwnership } from "@/hooks/useActorOwnership";
import { EmpresasService } from "@/services/empresas";
import type { Empresas } from "@/types/firestore";
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
  const { ownerIds } = useActorOwnership(user);
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const canUse = Boolean(permissions.reportessinpe);

  const [empresas, setEmpresas] = useState<Empresas[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [startDate, setStartDate] = useState(todayValue);
  const [endDate, setEndDate] = useState(todayValue);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [report, setReport] = useState<{
    processedEmails: number;
    validTransactions: number;
    total: number;
    transactions: Array<{
      uid: number;
      date: string;
      reference: string | null;
      amount: number;
    }>;
  } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canUse || !user) return;

    let mounted = true;
    EmpresasService.getAllEmpresas()
      .then((list) => {
        if (!mounted) return;
        const allowed = new Set(ownerIds.map((id) => String(id)));
        const filtered =
          user.role === "superadmin"
            ? list
            : list.filter((empresa) => {
                const ownerMatch =
                  empresa.ownerId && allowed.has(String(empresa.ownerId));
                const assigned = String(user.ownercompanie || "").trim();
                const companyMatch =
                  assigned &&
                  (empresa.name === assigned || empresa.ubicacion === assigned);
                return Boolean(ownerMatch || companyMatch);
              });
        setEmpresas(filtered);
        setEmpresaId((current) => current || filtered[0]?.id || "");
      })
      .catch(() => setError("No se pudieron cargar empresas."));

    return () => {
      mounted = false;
    };
  }, [canUse, ownerIds, user]);

  const summary = useMemo(
    () => ({
      emails: report?.processedEmails || 0,
      valid: report?.validTransactions || 0,
      total: report?.total || 0,
    }),
    [report],
  );

  const generateReport = async () => {
    setBusy(true);
    setError("");
    setReport(null);
    setDetailsOpen(false);

    try {
      const response = await fetch("/api/reportes-sinpe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          startDate,
          startTime,
          endDate,
          endTime,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error generando reporte.");
      setReport(data);
      setDetailsOpen(Boolean(data.transactions?.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando reporte.");
    } finally {
      setBusy(false);
    }
  };

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
      {busy && (
        <div className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center bg-[#020817]/90 px-4 py-6 backdrop-blur-md sm:px-6">
          <div className="w-full max-w-[min(92vw,720px)] rounded-[36px] border border-white/10 bg-[#071120] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.6)] sm:p-9">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 h-20 w-20 animate-pulse rounded-3xl bg-cyan-400/20 sm:h-24 sm:w-24" />
              <div className="flex-1">
                <div className="mx-auto h-5 w-56 animate-pulse rounded-full bg-white/20 sm:h-6 sm:w-72" />
                <div className="mx-auto mt-4 h-4 w-40 animate-pulse rounded-full bg-white/10 sm:w-52" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-3xl bg-white/10 sm:h-24" />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="h-24 animate-pulse rounded-3xl bg-white/10 sm:h-32" />
                <div className="h-24 animate-pulse rounded-3xl bg-white/10 sm:h-32" />
                <div className="h-24 animate-pulse rounded-3xl bg-white/10 sm:h-32" />
              </div>
              <div className="mx-auto h-4 w-2/3 animate-pulse rounded-full bg-cyan-300/20" />
            </div>
            <p className="mt-8 text-center text-xl font-semibold text-white/85 sm:text-2xl">
              Leyendo correos SINPE...
            </p>
            <p className="mt-2 text-center text-sm text-white/50 sm:text-base">
              Esto puede tardar unos segundos.
            </p>
          </div>
        </div>
      )}
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

          <label className="mb-4 block">
            <span className="mb-2 block text-sm text-white/70">Empresa</span>
            <select
              value={empresaId}
              onChange={(event) => setEmpresaId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3 text-sm text-white outline-none"
            >
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.name || empresa.ubicacion || empresa.id}
                </option>
              ))}
            </select>
          </label>

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
            onClick={generateReport}
            disabled={busy || !empresaId}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,_#2ab5ff_0%,_#9d4edd_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {busy ? "Leyendo correos..." : "Generar"}
          </button>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-[#091426]/90 p-5 sm:p-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            {report
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

        {report && (
          <div className="mt-5 rounded-[28px] border border-white/10 bg-[#091426]/90 p-5 sm:p-6">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-white">
                  Correos encontrados
                </span>
                <span className="mt-1 block text-xs text-white/50">
                  {report.transactions.length} transacciones SINPE
                </span>
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-cyan-300">
                {detailsOpen ? "Ocultar" : "Ver lista"}
              </span>
            </button>

            {detailsOpen && (
              <div className="mt-4 space-y-3">
                {report.transactions.length > 0 ? (
                  report.transactions.map((transaction) => (
                    <div
                      key={transaction.uid}
                      className="rounded-2xl border border-white/10 bg-[#0b1730] p-4"
                    >
                      <div className="grid gap-3 text-sm md:grid-cols-3">
                        <div>
                          <div className="text-white/45">Monto</div>
                          <div className="mt-1 font-semibold text-emerald-300">
                            ₡{transaction.amount.toLocaleString("es-CR")}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/45">
                            Número de referencia
                          </div>
                          <div className="mt-1 break-all text-white/85">
                            {transaction.reference || "No disponible"}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/45">Hora recibido</div>
                          <div className="mt-1 text-white/85">
                            {new Date(transaction.date).toLocaleString(
                              "es-CR",
                              {
                                dateStyle: "short",
                                timeStyle: "short",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#0b1730] p-4 text-sm text-white/60">
                    No hay correos SINPE válidos en el rango.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
