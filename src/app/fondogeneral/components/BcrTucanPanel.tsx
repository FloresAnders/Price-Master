"use client";

import { ReceiptText, RefreshCw, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BcrReceiptsClient,
  messageForBcrReceiptsError,
  type BcrDailyReceiptsResponse,
} from "../../../services/bcr-receipts";
import { getTiemposTucanUpdateAccess } from "../utils/tiemposTucanUpdateAccess";
import { GenteCrystalTicketTableFrame } from "./GenteCrystalTicketTableFrame";
import { currentCostaRicaDate } from "./genteCrystalTiempos";

type BcrTucanPanelProps = {
  companyId: string;
  userRole?: string;
  horarioApertura?: string;
  horarioCierre?: string;
  shiftChangeMin?: number | null;
  cierreFondoVentasMinutesBeforeEnd?: number;
  cierreFondoVentasMinutesAfterEnd?: number;
};

type RequestedScope = { companyId: string; date: string };

const formatCRC = (value: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatReceiptTime = (paidAt: string) =>
  new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(paidAt));

const receiptTimeInMinutes = (paidAt: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(paidAt));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return Number.isFinite(hour) && Number.isFinite(minute)
    ? hour * 60 + minute
    : null;
};

export function BcrTucanPanel({
  companyId,
  userRole,
  horarioApertura,
  horarioCierre,
  shiftChangeMin,
  cierreFondoVentasMinutesBeforeEnd,
  cierreFondoVentasMinutesAfterEnd,
}: BcrTucanPanelProps) {
  const [date, setDate] = useState(() => currentCostaRicaDate());
  const [result, setResult] = useState<BcrDailyReceiptsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestedScope, setRequestedScope] = useState<RequestedScope | null>(null);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeUntil, setTimeUntil] = useState("");
  const [windowCheckNow, setWindowCheckNow] = useState(() => new Date());
  const activeRequestId = useRef(0);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      activeRequestId.current += 1;
      abortController.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (userRole !== "user") return;
    const timer = window.setInterval(() => setWindowCheckNow(new Date()), 30_000);
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
    const now = new Date();
    const currentAccess = getTiemposTucanUpdateAccess({
      role: userRole,
      horarioApertura,
      horarioCierre,
      shiftChangeMin,
      minutesBeforeEnd: cierreFondoVentasMinutesBeforeEnd,
      minutesAfterEnd: cierreFondoVentasMinutesAfterEnd,
      now,
    });
    setWindowCheckNow(now);
    if (!currentAccess.allowed) {
      setError(
        "Solo puedes actualizar Tiempos/Tucan durante la ventana de cierre del turno D o N.",
      );
      return;
    }

    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    const requestId = activeRequestId.current + 1;
    activeRequestId.current = requestId;
    setRequestedScope({ companyId, date });
    setLoading(true);
    setError("");

    try {
      const nextResult = await BcrReceiptsClient.getDaily(
        companyId,
        date,
        controller.signal,
      );
      if (activeRequestId.current === requestId) setResult(nextResult);
    } catch (reason: unknown) {
      if (controller.signal.aborted) return;
      if (activeRequestId.current === requestId) {
        setError(messageForBcrReceiptsError(reason));
      }
    } finally {
      if (activeRequestId.current === requestId) setLoading(false);
    }
  };

  const isRequestedScopeVisible =
    requestedScope?.companyId === companyId && requestedScope.date === date;
  const visibleResult =
    result?.companyId === companyId && result.date === date ? result : null;
  const visibleLoading = loading && isRequestedScopeVisible;
  const visibleError = isRequestedScopeVisible ? error : "";

  const filteredResult = useMemo(() => {
    if (!visibleResult) return null;
    const fromMinutes = timeFrom
      ? Number(timeFrom.slice(0, 2)) * 60 + Number(timeFrom.slice(3))
      : null;
    const untilMinutes = timeUntil
      ? Number(timeUntil.slice(0, 2)) * 60 + Number(timeUntil.slice(3))
      : null;
    const receipts = visibleResult.receipts.filter((receipt) => {
      const minutes = receiptTimeInMinutes(receipt.paidAt);
      return (
        minutes !== null &&
        (fromMinutes === null || minutes >= fromMinutes) &&
        (untilMinutes === null || minutes <= untilMinutes)
      );
    });
    return {
      receipts,
      summary: {
        count: receipts.length,
        total: receipts.reduce((total, receipt) => total + receipt.monto, 0),
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
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className="h-10 rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none transition focus:border-blue-500"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading || updateBlocked}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-600/45 bg-blue-950/20 px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-blue-400/70 hover:bg-blue-950/35 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {updateBlocked && (
        <p className="rounded-md border border-amber-500/30 bg-amber-950/15 px-3 py-2 text-sm text-amber-100">
          Solo puedes actualizar Tiempos/Tucan durante la ventana de cierre del turno D o N.
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
              className="h-10 rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none transition focus:border-blue-500"
            />
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted-foreground)]">
            <span className="font-medium text-[var(--foreground)]">Hasta</span>
            <input
              type="time"
              value={timeUntil}
              onChange={(event) => setTimeUntil(event.target.value)}
              className="h-10 rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none transition focus:border-blue-500"
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/15 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
            <WalletCards className="h-4 w-4" /> Total pagado
          </div>
          <p className="text-xl font-bold text-[var(--foreground)]">
            {formatCRC(filteredResult?.summary.total ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-blue-500/25 bg-blue-950/15 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-300/80">
            <ReceiptText className="h-4 w-4" /> Comprobantes
          </div>
          <p className="text-xl font-bold text-[var(--foreground)]">
            {filteredResult?.summary.count ?? 0}
          </p>
        </div>
      </div>

      {visibleError && (
        <p role="alert" className="rounded-md border border-red-500/35 bg-red-950/20 px-3 py-2 text-sm text-red-200">
          {visibleError}
        </p>
      )}

      <GenteCrystalTicketTableFrame>
        <thead className="bg-blue-950/30 text-xs uppercase tracking-wide text-blue-100/75">
          <tr>
            <th className="px-3 py-2 font-semibold">Hora</th>
            <th className="px-3 py-2 text-right font-semibold">Monto</th>
          </tr>
        </thead>
        <tbody>
          {visibleLoading && !visibleResult ? (
            <tr>
              <td colSpan={2} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                Cargando comprobantes...
              </td>
            </tr>
          ) : filteredResult && filteredResult.receipts.length > 0 ? (
            filteredResult.receipts.map((receipt, index) => (
              <tr key={`${receipt.paidAt}-${receipt.monto}-${index}`} className="border-t border-[var(--input-border)]/70 text-[var(--foreground)] transition hover:bg-[var(--muted)]/25">
                <td className="whitespace-nowrap px-3 py-2">
                  {formatReceiptTime(receipt.paidAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-emerald-300">
                  {formatCRC(receipt.monto)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                {visibleError
                  ? "Usa Actualizar para intentar nuevamente."
                  : !isRequestedScopeVisible
                    ? "Presiona Actualizar para consultar."
                    : timeFrom || timeUntil
                      ? "No hay comprobantes dentro del horario seleccionado."
                      : "No hay comprobantes para esta fecha."}
              </td>
            </tr>
          )}
        </tbody>
      </GenteCrystalTicketTableFrame>
    </div>
  );
}
