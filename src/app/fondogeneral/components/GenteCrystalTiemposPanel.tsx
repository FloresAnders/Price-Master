"use client";

import { Info, RefreshCw, Ticket, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  GenteCrystalSalesClient,
  messageForGenteCrystalSalesError,
  type GenteCrystalDailySalesResponse,
} from "../../../services/gente-crystal-sales";
import {
  currentCostaRicaDate,
  genteCrystalSaleOriginMarker,
} from "./genteCrystalTiempos";
import { GenteCrystalTicketTableFrame } from "./GenteCrystalTicketTableFrame";

type GenteCrystalTiemposPanelProps = {
  companyId: string;
};

const formatCRC = (value: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatSaleTime = (saleAt: string) =>
  new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(saleAt));

export function GenteCrystalTiemposPanel({
  companyId,
}: GenteCrystalTiemposPanelProps) {
  const [date, setDate] = useState(() => currentCostaRicaDate());
  const [result, setResult] =
    useState<GenteCrystalDailySalesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
      void GenteCrystalSalesClient.getDaily(
        companyId,
        date,
        controller.signal,
      )
        .then((nextResult) => {
          if (!controller.signal.aborted) setResult(nextResult);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setError(messageForGenteCrystalSalesError(reason));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [companyId, date, refreshVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (date === currentCostaRicaDate()) {
        setRefreshVersion((version) => version + 1);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [date]);

  const visibleResult = useMemo(
    () =>
      result?.companyId === companyId && result.date === date ? result : null,
    [companyId, date, result],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="grid gap-1 text-sm text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value);
            }}
            className="h-10 rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none transition focus:border-cyan-500"
          />
        </label>
        <button
          type="button"
          onClick={() => setRefreshVersion((version) => version + 1)}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-cyan-600/45 bg-cyan-950/20 px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-cyan-400/70 hover:bg-cyan-950/35 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      <div
        className={`grid grid-cols-1 gap-3 ${
          visibleResult?.summary.indirectCount
            ? "sm:grid-cols-3"
            : "sm:grid-cols-2"
        }`}
      >
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/15 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
            <WalletCards className="h-4 w-4" />
            Total vendido
          </div>
          <p className="text-xl font-bold text-[var(--foreground)]">
            {formatCRC(visibleResult?.summary.total ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/15 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300/80">
            <Ticket className="h-4 w-4" />
            Tiquetes
          </div>
          <p className="text-xl font-bold text-[var(--foreground)]">
            {visibleResult?.summary.count ?? 0}
          </p>
        </div>
        {Boolean(visibleResult?.summary.indirectCount) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300/85">
              <Info className="h-4 w-4" />
              Total indirectas (i)
            </div>
            <p className="text-xl font-bold text-[var(--foreground)]">
              {formatCRC(visibleResult?.summary.indirectTotal ?? 0)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {visibleResult?.summary.indirectCount} tiquete
              {visibleResult?.summary.indirectCount === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      {Boolean(visibleResult?.summary.indirectCount) && (
        <p className="text-xs text-amber-300/85">
          (i) Venta detectada sin un clic local en Ingresar venta.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/35 bg-red-950/20 px-3 py-2 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      <GenteCrystalTicketTableFrame>
        <thead className="bg-cyan-950/30 text-xs uppercase tracking-wide text-cyan-100/75">
          <tr>
            <th className="px-2 py-2 font-semibold">Hora</th>
            <th className="px-2 py-2 font-semibold">Sorteo</th>
            <th className="px-2 py-2 font-semibold">Tiquete</th>
            <th className="px-2 py-2 text-right font-semibold">Monto</th>
          </tr>
        </thead>
        <tbody>
          {loading && !visibleResult ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-[var(--muted-foreground)]"
              >
                Cargando movimientos...
              </td>
            </tr>
          ) : visibleResult && visibleResult.sales.length > 0 ? (
            visibleResult.sales.map((sale) => (
              <tr
                key={sale.ticketId}
                className="border-t border-[var(--input-border)]/70 text-[var(--foreground)] transition hover:bg-[var(--muted)]/25"
              >
                <td className="whitespace-nowrap px-2 py-2">
                  {formatSaleTime(sale.saleAt)}
                </td>
                <td className="px-2 py-2">{sale.sorteo}</td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">
                  {sale.ticketId}{" "}
                  {genteCrystalSaleOriginMarker(sale.captureOrigin) && (
                    <span
                      className="font-sans font-bold text-amber-300"
                      title="Venta detectada sin un clic local en Ingresar venta"
                      aria-label="Venta indirecta"
                    >
                      {genteCrystalSaleOriginMarker(sale.captureOrigin)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-emerald-300">
                  {formatCRC(sale.monto)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-[var(--muted-foreground)]"
              >
                {error
                  ? "Usa Actualizar para intentar nuevamente."
                  : "No hay movimientos para esta fecha."}
              </td>
            </tr>
          )}
        </tbody>
      </GenteCrystalTicketTableFrame>
    </div>
  );
}
