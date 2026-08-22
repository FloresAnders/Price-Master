"use client";

import { Info, RefreshCw, Ticket, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GenteCrystalSalesClient,
  messageForGenteCrystalSalesError,
  type GenteCrystalDailySalesResponse,
} from "../../../services/gente-crystal-sales";
import {
  buildGenteCrystalDisplayResult,
  createGenteCrystalManualSalesQuery,
  currentCostaRicaDate,
  genteCrystalSaleOriginMarker,
} from "./genteCrystalTiempos";
import { getTiemposTucanUpdateAccess } from "../utils/tiemposTucanUpdateAccess";
import {
  GenteCrystalTicketNumbers,
  GenteCrystalTicketTableFrame,
  GenteCrystalTicketViewToggle,
} from "./GenteCrystalTicketTableFrame";

type GenteCrystalTiemposPanelProps = {
  companyId: string;
  userRole?: string;
  horarioApertura?: string;
  horarioCierre?: string;
  shiftChangeMin?: number | null;
  cierreFondoVentasMinutesBeforeEnd?: number;
  cierreFondoVentasMinutesAfterEnd?: number;
};

type RequestedScope = {
  companyId: string;
  date: string;
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

const saleTimeInMinutes = (saleAt: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(saleAt));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value,
  );
  return Number.isFinite(hour) && Number.isFinite(minute)
    ? hour * 60 + minute
    : null;
};

const splitDisplaySorteoLines = (value: string): string[] => {
  const normalized = String(value || "").trim();
  if (!normalized) return ["-"];
  return normalized
    .split(/\s\+\s/g)
    .map((line) => line.trim())
    .filter(Boolean);
};

export function GenteCrystalTiemposPanel({
  companyId,
  userRole,
  horarioApertura,
  horarioCierre,
  shiftChangeMin,
  cierreFondoVentasMinutesBeforeEnd,
  cierreFondoVentasMinutesAfterEnd,
}: GenteCrystalTiemposPanelProps) {
  const [date, setDate] = useState(() => currentCostaRicaDate());
  const [result, setResult] =
    useState<GenteCrystalDailySalesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestedScope, setRequestedScope] =
    useState<RequestedScope | null>(null);
  const [showFullTicket, setShowFullTicket] = useState(false);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeUntil, setTimeUntil] = useState("");
  const [windowCheckNow, setWindowCheckNow] = useState(() => new Date());
  const activeRequestId = useRef(0);
  const manualQuery = useRef<
    ReturnType<typeof createGenteCrystalManualSalesQuery> | undefined
  >(undefined);

  if (!manualQuery.current) {
    manualQuery.current = createGenteCrystalManualSalesQuery(
      (nextCompanyId, nextDate, signal) =>
        GenteCrystalSalesClient.getDaily(nextCompanyId, nextDate, signal),
    );
  }

  useEffect(() => {
    return () => {
      activeRequestId.current += 1;
      manualQuery.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (userRole !== "user") return;
    const timer = window.setInterval(() => {
      setWindowCheckNow(new Date());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [userRole]);

  const updateAccess = getTiemposTucanUpdateAccess({
    role: userRole,
    horarioApertura,
    horarioCierre,
    shiftChangeMin,
    minutesBeforeEnd: cierreFondoVentasMinutesBeforeEnd,
    minutesAfterEnd: cierreFondoVentasMinutesAfterEnd,
    now: windowCheckNow,
  });
  const updateBlocked = !updateAccess.allowed;

  const handleRefresh = async () => {
    const currentAccess = getTiemposTucanUpdateAccess({
      role: userRole,
      horarioApertura,
      horarioCierre,
      shiftChangeMin,
      minutesBeforeEnd: cierreFondoVentasMinutesBeforeEnd,
      minutesAfterEnd: cierreFondoVentasMinutesAfterEnd,
      now: new Date(),
    });
    setWindowCheckNow(new Date());
    if (!currentAccess.allowed) {
      setError(
        "Solo puedes actualizar Tiempos/Tucan durante la ventana de cierre del turno D o N.",
      );
      return;
    }

    const requestId = activeRequestId.current + 1;
    activeRequestId.current = requestId;
    setRequestedScope({ companyId, date });
    setLoading(true);
    setError("");

    try {
      const nextResult = await manualQuery.current!.refresh(companyId, date);
      if (activeRequestId.current === requestId) setResult(nextResult);
    } catch (reason: unknown) {
      if (activeRequestId.current === requestId) {
        setError(messageForGenteCrystalSalesError(reason));
      }
    } finally {
      if (activeRequestId.current === requestId) setLoading(false);
    }
  };

  const isRequestedScopeVisible =
    requestedScope?.companyId === companyId && requestedScope.date === date;
  const visibleLoading = loading && isRequestedScopeVisible;
  const visibleError = isRequestedScopeVisible ? error : "";

  const visibleResult = useMemo(
    () =>
      result?.companyId === companyId && result.date === date
        ? buildGenteCrystalDisplayResult(result)
        : null,
    [companyId, date, result],
  );
  const filteredResult = useMemo(() => {
    if (!visibleResult) return null;
    const fromMinutes = timeFrom ? Number(timeFrom.slice(0, 2)) * 60 + Number(timeFrom.slice(3)) : null;
    const untilMinutes = timeUntil ? Number(timeUntil.slice(0, 2)) * 60 + Number(timeUntil.slice(3)) : null;
    const sales = visibleResult.sales.filter((sale) => {
      const saleMinutes = saleTimeInMinutes(sale.saleAt);
      return (
        saleMinutes !== null &&
        (fromMinutes === null || saleMinutes >= fromMinutes) &&
        (untilMinutes === null || saleMinutes <= untilMinutes)
      );
    });
    const indirectSales = sales.filter(
      (sale) => sale.captureOrigin === "indirect",
    );
    return {
      ...visibleResult,
      sales,
      summary: {
        ...visibleResult.summary,
        count: sales.length,
        total: sales.reduce((total, sale) => total + sale.monto, 0),
        indirectCount: indirectSales.length,
        indirectTotal: indirectSales.reduce(
          (total, sale) => total + sale.monto,
          0,
        ),
      },
    };
  }, [timeFrom, timeUntil, visibleResult]);

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <GenteCrystalTicketViewToggle
            showFullTicket={showFullTicket}
            onToggle={() => setShowFullTicket((current) => !current)}
          />
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading || updateBlocked}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-cyan-600/45 bg-cyan-950/20 px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-cyan-400/70 hover:bg-cyan-950/35 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {updateBlocked && (
        <p className="rounded-md border border-amber-500/30 bg-amber-950/15 px-3 py-2 text-sm text-amber-100">
          Solo puedes actualizar Tiempos/Tucan durante la ventana de cierre del
          turno D o N.
        </p>
      )}

      {visibleResult && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-[var(--muted-foreground)]">
            <span className="font-medium text-[var(--foreground)]">Desde</span>
            <input
              type="time"
              value={timeFrom}
              onChange={(event) => setTimeFrom(event.target.value)}
              className="h-10 rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none transition focus:border-cyan-500"
            />
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted-foreground)]">
            <span className="font-medium text-[var(--foreground)]">Hasta</span>
            <input
              type="time"
              value={timeUntil}
              onChange={(event) => setTimeUntil(event.target.value)}
              className="h-10 rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none transition focus:border-cyan-500"
            />
          </label>
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-3 ${
          filteredResult?.summary.indirectCount
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
            {formatCRC(filteredResult?.summary.total ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/15 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300/80">
            <Ticket className="h-4 w-4" />
            Tiquetes
          </div>
          <p className="text-xl font-bold text-[var(--foreground)]">
            {filteredResult?.summary.count ?? 0}
          </p>
        </div>
        {Boolean(filteredResult?.summary.indirectCount) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300/85">
              <Info className="h-4 w-4" />
              Total indirectas (i)
            </div>
            <p className="text-xl font-bold text-[var(--foreground)]">
              {formatCRC(visibleResult?.summary.indirectTotal ?? 0)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {filteredResult?.summary.indirectCount} tiquete
              {filteredResult?.summary.indirectCount === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      {Boolean(filteredResult?.summary.indirectCount) && (
        <p className="text-xs text-amber-300/85">
          (i) Venta detectada sin un clic local en Ingresar venta.
        </p>
      )}

      {visibleError && (
        <p
          role="alert"
          className="rounded-md border border-red-500/35 bg-red-950/20 px-3 py-2 text-sm text-red-200"
        >
          {visibleError}
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
          {visibleLoading && !visibleResult ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-[var(--muted-foreground)]"
              >
                Cargando movimientos...
              </td>
            </tr>
          ) : filteredResult && filteredResult.sales.length > 0 ? (
            filteredResult.sales.map((sale) => (
              <tr
                key={sale.ticketIds.join("|")}
                className="border-t border-[var(--input-border)]/70 text-[var(--foreground)] transition hover:bg-[var(--muted)]/25"
              >
                <td className="whitespace-nowrap px-2 py-2 align-middle">
                  {formatSaleTime(sale.saleAt)}
                </td>
                <td className="px-2 py-2 align-middle">
                  <span className="inline-flex flex-col">
                    {splitDisplaySorteoLines(sale.sorteo).map((line) => (
                      <span key={`${sale.ticketIds.join("|")}-${line}`} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 align-middle font-mono text-xs">
                  <GenteCrystalTicketNumbers
                    ticketIds={sale.ticketIds}
                    showFullTicket={showFullTicket}
                  />{" "}
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
                <td className="whitespace-nowrap px-2 py-2 text-right align-middle font-semibold text-emerald-300">
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
                {visibleError
                  ? "Usa Actualizar para intentar nuevamente."
                  : !isRequestedScopeVisible
                    ? "Presiona Actualizar para consultar."
                    : timeFrom || timeUntil
                      ? "No hay tiquetes dentro del horario seleccionado."
                      : "No hay movimientos para esta fecha."}
              </td>
            </tr>
          )}
        </tbody>
      </GenteCrystalTicketTableFrame>
    </div>
  );
}
