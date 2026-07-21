"use client";

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Coins,
  DollarSign,
  Calendar,
  FileText,
  GitCompareArrows,
  CheckCircle,
  AlertTriangle,
  Clock3,
  RefreshCw,
  User,
  Clock,
  CalendarDays,
} from "lucide-react";

type Currency = "CRC" | "USD";

type DailyClosingHistorySectionProps = {
  closingsAreLoading: boolean;
  dailyClosings: Array<any>;
  quickRange: string;
  onQuickRangeChange: (value: string) => void;
  dailyClosingDateFormatter: Intl.DateTimeFormat;
  dateTimeFormatter: Intl.DateTimeFormat;
  buildBreakdownLines: (currency: Currency, breakdown: any) => string[];
  formatByCurrency: (currency: Currency, value: number) => string;
  formatDailyClosingDiff: (currency: Currency, value: number) => string;
  getDailyClosingDiffClass: (value: number) => string;
  fondoEntries: Array<any>;
  isAutoAdjustmentProvider: (providerCode: unknown) => boolean;
  expandedClosings: Set<string>;
  setExpandedClosings: React.Dispatch<React.SetStateAction<Set<string>>>;
};

export default function DailyClosingHistorySection({
  closingsAreLoading,
  dailyClosings,
  quickRange,
  onQuickRangeChange,
  dailyClosingDateFormatter,
  dateTimeFormatter,
  buildBreakdownLines,
  formatByCurrency,
  formatDailyClosingDiff,
  getDailyClosingDiffClass,
  fondoEntries,
  isAutoAdjustmentProvider,
  expandedClosings,
  setExpandedClosings,
}: DailyClosingHistorySectionProps) {
  const list = dailyClosings || [];
  const reconciliationStatusLabel = (status: string | undefined) => {
    switch (status) {
      case "MATCHED":
        return "Todo cuadra";
      case "TEMPORARY_PENDING":
        return "Pendiente para próximo turno";
      case "PARTIALLY_RESOLVED":
        return "Compensado parcialmente";
      case "RESOLVED":
        return "Diferencia anterior resuelta";
      case "REAL_DIFFERENCE":
        return "Diferencia real";
      case "DAILY_UNRESOLVED":
        return "Día no cuadra";
      default:
        return "Revisión pendiente";
    }
  };
  const reconciliationDiffLabel = (value: number) => {
    if (value === 0) return "Cuadra";
    return value > 0
      ? `Sobra ${formatByCurrency("CRC", Math.abs(value))}`
      : `Falta ${formatByCurrency("CRC", Math.abs(value))}`;
  };
  const formatOptionalCRC = (value: unknown) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue)
      ? formatByCurrency("CRC", numericValue)
      : "—";
  };
  const reconciliationOptionalDiffLabel = (value: unknown) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue)
      ? reconciliationDiffLabel(numericValue)
      : "—";
  };
  const reconciliationTone = (reconciliation: any) => {
    if (!reconciliation) return "neutral";
    if (
      reconciliation.calculated?.tucanDifference !== 0 ||
      reconciliation.tiemposStatus === "REAL_DIFFERENCE" ||
      reconciliation.tiemposStatus === "DAILY_UNRESOLVED"
    ) {
      return "danger";
    }
    if (reconciliation.tiemposStatus === "RESOLVED") {
      return "success";
    }
    if (
      reconciliation.tiemposStatus === "TEMPORARY_PENDING" ||
      reconciliation.tiemposStatus === "PARTIALLY_RESOLVED"
    ) {
      return "warning";
    }
    return "success";
  };
  const reconciliationToneClass = (tone: string) => {
    switch (tone) {
      case "success":
        return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
      case "warning":
        return "border-amber-500/25 bg-amber-500/10 text-amber-100";
      case "danger":
        return "border-red-500/25 bg-red-500/10 text-red-100";
      default:
        return "border-[var(--input-border)] bg-[var(--muted)]/10 text-[var(--foreground)]";
    }
  };
  const reconciliationHeadline = (reconciliation: any) => {
    const tone = reconciliationTone(reconciliation);
    if (tone === "success") return "Todo cuadra";
    if (tone === "warning") return "Existe una diferencia compensable";
    return "Revisar cierre";
  };
  const reconciliationAction = (reconciliation: any) => {
    const tone = reconciliationTone(reconciliation);
    if (tone === "success") return "No requiere accion.";
    if (tone === "warning") return "Esperar al siguiente turno y validar compensacion.";
    return "Revisar movimientos y validar reporte de Contica.";
  };
  const compensationResultLabel = (reconciliation: any) =>
    Number(reconciliation?.calculated?.tiemposRealShiftDifference ?? 0) !== 0
      ? "Diferencia real"
      : "Pendiente siguiente";
  const compensationResultValue = (reconciliation: any) =>
    Number(reconciliation?.calculated?.tiemposRealShiftDifference ?? 0) !== 0
      ? Number(reconciliation?.calculated?.tiemposRealShiftDifference ?? 0)
      : Number(reconciliation?.calculated?.tiemposPendingAfterClosing ?? 0);

  return (
    <>
      <div className="mb-4 rounded border border-[var(--input-border)] bg-[var(--muted)]/5 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="h-3 w-3 text-[var(--accent)]" strokeWidth={1.5} />
              <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                Filtro de fecha
              </label>
            </div>
            <select
              className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              style={{
                backgroundColor: "var(--card-bg)",
                color: "var(--foreground)",
              }}
              value={quickRange}
              onChange={(e) => onQuickRangeChange(e.target.value)}
            >
              <option value="today">Hoy</option>
              <option value="todo">Todo</option>
              <option value="yesterday">Ayer</option>
              <option value="thisweek">Esta semana</option>
              <option value="lastweek">Semana anterior</option>
              <option value="lastmonth">Mes anterior</option>
              <option value="last30">Últimos 30 días</option>
              <option value="month">Mes actual</option>
            </select>
          </div>

          {!closingsAreLoading && dailyClosings.length > 0 && (
            <div className="text-xs text-[var(--muted-foreground)] sm:text-right">
              Mostrando {list.length}.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {closingsAreLoading ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Cargando cierres...
          </p>
        ) : dailyClosings.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Aún no has registrado cierres diarios para este fondo.
          </p>
        ) : (
          <div className="space-y-4">
            {list.map((record) => {
              const closingDate = new Date(record.closingDate);
              const closingDateLabel = Number.isNaN(closingDate.getTime())
                ? record.closingDate
                : dailyClosingDateFormatter.format(closingDate);
              const createdAtDate = new Date(record.createdAt);
              const createdAtLabel = Number.isNaN(createdAtDate.getTime())
                ? record.createdAt
                : dateTimeFormatter.format(createdAtDate);
              const crcLines = buildBreakdownLines("CRC", record.breakdownCRC);
              const usdLines = buildBreakdownLines("USD", record.breakdownUSD);
              const showCRC =
                record.totalCRC !== 0 ||
                record.recordedBalanceCRC !== 0 ||
                record.diffCRC !== 0 ||
                crcLines.length > 0;
              const showUSD =
                record.totalUSD !== 0 ||
                record.recordedBalanceUSD !== 0 ||
                record.diffUSD !== 0 ||
                usdLines.length > 0;

              return (
                <div
                  key={record.id}
                  className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-700/30 bg-cyan-950/20">
                        <CalendarDays className="h-4 w-4 text-cyan-300" strokeWidth={1.5} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          {closingDateLabel}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" strokeWidth={1.5} />
                            {createdAtLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                      <User className="h-3 w-3" strokeWidth={1.5} />
                      <span className="font-medium text-[var(--foreground)]">
                        {record.manager || "—"}
                      </span>
                    </div>
                  </div>
                  <hr className="my-3 border-[var(--input-border)]/50" />

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded border border-amber-700/20 bg-amber-950/10 p-3">
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                        <Coins className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
                        Colones
                      </div>
                      {showCRC ? (
                        <div className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--muted-foreground)]">Conteo</span>
                            <span className="font-medium">{formatByCurrency("CRC", record.totalCRC)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--muted-foreground)]">Saldo registrado</span>
                            <span className="font-medium">{formatByCurrency("CRC", record.recordedBalanceCRC)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--muted-foreground)]">Diferencia</span>
                            <span className={getDailyClosingDiffClass(record.diffCRC)}>
                              {formatDailyClosingDiff("CRC", record.diffCRC)}
                            </span>
                          </div>
                          {crcLines.length > 0 && (
                            <div className="pt-1 text-xs text-[var(--muted-foreground)] border-t border-[var(--input-border)]/40 mt-1.5 pt-1.5">
                              {crcLines.join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                          Sin datos en CRC
                        </div>
                      )}
                    </div>

                    <div className="rounded border border-emerald-700/20 bg-emerald-950/10 p-3">
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                        Dólares
                      </div>
                      {showUSD ? (
                        <div className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--muted-foreground)]">Conteo</span>
                            <span className="font-medium">{formatByCurrency("USD", record.totalUSD)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--muted-foreground)]">Saldo registrado</span>
                            <span className="font-medium">{formatByCurrency("USD", record.recordedBalanceUSD)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--muted-foreground)]">Diferencia</span>
                            <span className={getDailyClosingDiffClass(record.diffUSD)}>
                              {formatDailyClosingDiff("USD", record.diffUSD)}
                            </span>
                          </div>
                          {usdLines.length > 0 && (
                            <div className="pt-1 text-xs text-[var(--muted-foreground)] border-t border-[var(--input-border)]/40 mt-1.5 pt-1.5">
                              {usdLines.join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                          Sin datos en USD
                        </div>
                      )}
                    </div>
                  </div>

                  {record.reconciliation && (
                    <div className="mt-3 rounded border border-sky-700/20 bg-sky-950/10 p-3 text-xs text-[var(--muted-foreground)]">
                      <div className={`mb-3 rounded border px-3 py-2 ${reconciliationToneClass(reconciliationTone(record.reconciliation))}`}>
                        <div className="flex items-start gap-2">
                          {reconciliationTone(record.reconciliation) === "success" ? (
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
                          ) : reconciliationTone(record.reconciliation) === "warning" ? (
                            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
                          )}
                          <div>
                            <div className="font-semibold uppercase tracking-wide">
                              {reconciliationHeadline(record.reconciliation)}
                            </div>
                            <div className="mt-1">
                              {reconciliationStatusLabel(record.reconciliation.tiemposStatus)}
                            </div>
                            <div className="mt-1 font-semibold">
                              Accion: {reconciliationAction(record.reconciliation)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mb-2 font-semibold uppercase tracking-wide text-[var(--foreground)]">
                        Valores digitados
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          {
                            label: "Tucan",
                            code: "R08",
                            typedReport:
                              record.reconciliation.externalSnapshots
                                ?.tucanCumulative,
                            shiftReport:
                              record.reconciliation.calculated?.tucanForShift,
                            contica: record.reconciliation.contica?.r08,
                            diff:
                              record.reconciliation.calculated?.tucanDifference,
                          },
                          {
                            label: "Tiempos",
                            code: "T11",
                            typedReport:
                              record.reconciliation.externalSnapshots
                                ?.tiemposCumulative,
                            shiftReport:
                              record.reconciliation.calculated?.tiemposForShift,
                            contica: record.reconciliation.contica?.t11,
                            diff:
                              record.reconciliation.calculated?.tiemposDifference,
                          },
                        ].map(({ label, code, typedReport, shiftReport, contica, diff }) => (
                          <div key={label} className="rounded border border-[var(--input-border)]/60 bg-[var(--background)]/60 p-2.5">
                            <div className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                              <GitCompareArrows className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.5} />
                              {label}
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-2">
                                <span>Reporte digitado</span>
                                <span className="font-semibold text-[var(--foreground)]">{formatOptionalCRC(typedReport)}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span>Vendido turno</span>
                                <span className="font-semibold text-[var(--foreground)]">{formatOptionalCRC(shiftReport)}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span>Contica ({code})</span>
                                <span className="font-semibold text-[var(--foreground)]">{formatOptionalCRC(contica)}</span>
                              </div>
                              <div className="font-semibold text-[var(--foreground)]">
                                Estado: {reconciliationOptionalDiffLabel(diff)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded border border-[var(--input-border)]/60 bg-[var(--background)]/60 p-2.5">
                        <div className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                          <RefreshCw className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.5} />
                          Compensacion
                        </div>
                        {record.reconciliation.calculated.previousTiemposPending !== 0 ||
                        record.reconciliation.calculated.compensatedTiemposAmount !== 0 ||
                        record.reconciliation.calculated.tiemposPendingAfterClosing !== 0 ? (
                          <div className="grid gap-1.5 sm:grid-cols-3">
                            <span>Pendiente anterior: {reconciliationDiffLabel(record.reconciliation.calculated.previousTiemposPending)}</span>
                            <span>Compensado: {formatByCurrency("CRC", record.reconciliation.calculated.compensatedTiemposAmount)}</span>
                            <span>{compensationResultLabel(record.reconciliation)}: {reconciliationDiffLabel(compensationResultValue(record.reconciliation))}</span>
                          </div>
                        ) : (
                          <span className="text-emerald-200">No existen pendientes entre turnos.</span>
                        )}
                      </div>
                    </div>
                  )}

                  {record.notes && record.notes.length > 0 && (
                    <div className="mt-3 rounded border border-[var(--input-border)]/40 bg-[var(--muted)]/5 p-2.5">
                      <div className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={1.5} />
                        <span>{record.notes}</span>
                      </div>
                    </div>
                  )}

                  {record.singleClosingReason && (
                    <div className="mt-3 rounded border border-amber-500/25 bg-amber-500/8 p-2.5">
                      <div className="flex items-start gap-2 text-xs text-amber-100">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" strokeWidth={1.5} />
                        <div>
                          <div className="font-semibold uppercase tracking-wide text-[11px] text-amber-300">
                            Motivo cierre único
                          </div>
                          <div className="mt-0.5 text-[var(--foreground)]">
                            {record.singleClosingReason}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {record.noMovements && record.noMovementsReason && (
                    <div className="mt-3 rounded border border-orange-500/25 bg-orange-500/8 p-2.5">
                      <div className="flex items-start gap-2 text-xs text-orange-100">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" strokeWidth={1.5} />
                        <div>
                          <div className="font-semibold uppercase tracking-wide text-[11px] text-orange-300">
                            Sin movimientos
                          </div>
                          <div className="mt-0.5 text-[var(--foreground)]">
                            {record.noMovementsReason}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const relatedAdjustments = fondoEntries.filter(
                      (e) =>
                        e.originalEntryId === record.id &&
                        isAutoAdjustmentProvider(e.providerCode),
                    );

                    if (
                      relatedAdjustments.length === 0 &&
                      record.diffCRC === 0 &&
                      record.diffUSD === 0
                    ) {
                      const isExpanded = expandedClosings.has(record.id);
                      return (
                        <div className="mt-3">
                          <hr className="mb-3 border-[var(--input-border)]/40" />
                          <div className="flex items-center justify-between p-3 rounded border-l-4 border-green-500 bg-green-950/15 text-sm">
                            <div>
                              <div className="flex items-center gap-2 font-medium">
                                <CheckCircle className="h-4 w-4 text-green-400" strokeWidth={1.5} />
                                Cierre editado — diferencias resueltas
                              </div>
                              <div className="text-xs text-[var(--muted-foreground)]">
                                Los ajustes previos fueron eliminados y el saldo
                                quedó normalizado.
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedClosings((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(record.id))
                                    next.delete(record.id);
                                  else next.add(record.id);
                                  return next;
                                });
                              }}
                              aria-expanded={isExpanded}
                              aria-controls={`closing-resolved-${record.id}`}
                              className="ml-4 p-1 rounded border border-transparent hover:border-[var(--input-border)]"
                              title={
                                isExpanded
                                  ? "Ocultar detalles"
                                  : "Mostrar detalles"
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {isExpanded && (
                            <div
                              id={`closing-resolved-${record.id}`}
                              className="mt-2 p-3 rounded border border-[var(--input-border)] bg-[var(--muted)]/5 text-sm text-[var(--muted-foreground)]"
                            >
                              <div className="mb-2">
                                <div>
                                  <strong>Conteo:</strong>{" "}
                                  {formatByCurrency("CRC", record.totalCRC)} /{" "}
                                  {formatByCurrency("USD", record.totalUSD)}
                                </div>
                                <div>
                                  <strong>Saldo registrado:</strong>{" "}
                                  {formatByCurrency(
                                    "CRC",
                                    record.recordedBalanceCRC,
                                  )}{" "}
                                  /{" "}
                                  {formatByCurrency(
                                    "USD",
                                    record.recordedBalanceUSD,
                                  )}
                                </div>
                                <div>
                                  <strong>Diferencia:</strong>{" "}
                                  {record.diffCRC === 0 && record.diffUSD === 0
                                    ? "Sin diferencias"
                                    : `${formatDailyClosingDiff(
                                        "CRC",
                                        record.diffCRC,
                                      )} / ${formatDailyClosingDiff(
                                        "USD",
                                        record.diffUSD,
                                      )}`}
                                </div>
                              </div>
                              <div className="text-xs text-[var(--input-border)]">
                                <div className="mb-1 font-medium">
                                  Resumen de resolución:
                                </div>
                                {record.adjustmentResolution
                                  ?.removedAdjustments &&
                                record.adjustmentResolution.removedAdjustments
                                  .length > 0 ? (
                                  <ul className="list-disc pl-5 text-[var(--muted-foreground)]">
                                    {record.adjustmentResolution.removedAdjustments.map(
                                      (adj: any, idx: number) => (
                                        <li key={idx}>
                                          {adj.currency}:{" "}
                                          {adj.amount && adj.amount !== 0
                                            ? adj.amount > 0
                                              ? `+ ${formatByCurrency(
                                                  adj.currency as Currency,
                                                  adj.amount,
                                                )}`
                                              : `- ${formatByCurrency(
                                                  adj.currency as Currency,
                                                  Math.abs(adj.amount),
                                                )}`
                                            : `${formatByCurrency(
                                                adj.currency as Currency,
                                                (adj.amountIngreso || 0) -
                                                  (adj.amountEgreso || 0),
                                              )}`}
                                          {adj.manager
                                            ? ` — ${adj.manager}`
                                            : ""}
                                          {adj.createdAt
                                            ? ` • ${(() => {
                                                try {
                                                  return dateTimeFormatter.format(
                                                    new Date(adj.createdAt),
                                                  );
                                                } catch {
                                                  return adj.createdAt;
                                                }
                                              })()}`
                                            : ""}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                ) : (
                                  <ul className="list-disc pl-5 text-[var(--muted-foreground)]">
                                    <li>
                                      Los ajustes asociados a este cierre fueron
                                      eliminados manualmente.
                                    </li>
                                    <li>
                                      El saldo del fondo quedó normalizado
                                      contra el conteo proporcionado.
                                    </li>
                                  </ul>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (relatedAdjustments.length > 0) {
                      const postAdjBalanceCRC =
                        record.adjustmentResolution?.postAdjustmentBalanceCRC;
                      const postAdjBalanceUSD =
                        record.adjustmentResolution?.postAdjustmentBalanceUSD;
                      const showPostAdjustmentBalances =
                        typeof postAdjBalanceCRC === "number" ||
                        typeof postAdjBalanceUSD === "number";

                      return (
                        <div className="mt-3">
                          <hr className="mb-3 border-[var(--input-border)]/40" />
                          <div className="flex items-center gap-2 text-sm font-medium mb-2">
                            <GitCompareArrows className="h-4 w-4 text-cyan-400" strokeWidth={1.5} />
                            Ajustes relacionados
                          </div>
                          <div className="space-y-2">
                            {relatedAdjustments.map((adj) => {
                              const amt =
                                (adj.amountIngreso || 0) -
                                (adj.amountEgreso || 0);
                              let auditHistory: any[] = [];
                              try {
                                const parsed = adj.auditDetails
                                  ? (JSON.parse(adj.auditDetails) as any)
                                  : null;
                                if (parsed) {
                                  if (Array.isArray(parsed.history))
                                    auditHistory = parsed.history.slice();
                                  else if (parsed.before && parsed.after)
                                    auditHistory = [
                                      {
                                        at: parsed.at ?? adj.createdAt,
                                        before: parsed.before,
                                        after: parsed.after,
                                      },
                                    ];
                                }
                              } catch {
                                auditHistory = [];
                              }

                              const lastChange =
                                auditHistory.length > 0
                                  ? auditHistory[auditHistory.length - 1]
                                  : null;

                              return (
                                <div
                                  key={adj.id}
                                  className="p-3 rounded border border-[var(--input-border)] bg-[var(--muted)]/10"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold">
                                      {adj.currency} — {amt >= 0 ? "+" : "-"}{" "}
                                      {formatByCurrency(
                                        adj.currency as Currency,
                                        Math.abs(amt),
                                      )}
                                    </div>
                                    <div className="text-xs text-[var(--muted-foreground)]">
                                      {adj.manager || "—"} •{" "}
                                      {(() => {
                                        try {
                                          return dateTimeFormatter.format(
                                            new Date(adj.createdAt),
                                          );
                                        } catch {
                                          return adj.createdAt;
                                        }
                                      })()}
                                    </div>
                                  </div>

                                  {adj.breakdown &&
                                    Object.keys(adj.breakdown).length > 0 && (
                                      <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                                        <div className="font-medium">
                                          Detalle de billetes:
                                        </div>
                                        <div className="text-xs mt-1">
                                          {buildBreakdownLines(
                                            adj.currency as Currency,
                                            adj.breakdown,
                                          ).join(", ")}
                                        </div>
                                      </div>
                                    )}

                                  {lastChange ? (
                                    <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                                      <div className="font-medium">
                                        Último cambio registrado:
                                      </div>
                                      <div>
                                        Antes:{" "}
                                        {(() => {
                                          const beforeAmt = lastChange.before
                                            ? (lastChange.before
                                                .amountIngreso || 0) -
                                              (lastChange.before.amountEgreso ||
                                                0)
                                            : undefined;
                                          return typeof beforeAmt === "number"
                                            ? formatByCurrency(
                                                adj.currency as Currency,
                                                Math.abs(beforeAmt),
                                              )
                                            : "—";
                                        })()}
                                      </div>
                                      <div>
                                        Después:{" "}
                                        {(() => {
                                          const afterAmt = lastChange.after
                                            ? (lastChange.after.amountIngreso ||
                                                0) -
                                              (lastChange.after.amountEgreso ||
                                                0)
                                            : undefined;
                                          return typeof afterAmt === "number"
                                            ? formatByCurrency(
                                                adj.currency as Currency,
                                                Math.abs(afterAmt),
                                              )
                                            : "—";
                                        })()}
                                      </div>
                                      {lastChange.at && (
                                        <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
                                          Registro:{" "}
                                          {dateTimeFormatter.format(
                                            new Date(lastChange.at),
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                                      Movimiento sin historial de edición.
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {showPostAdjustmentBalances && (
                            <div className="mt-4 rounded border border-[var(--input-border)]/40 bg-[var(--muted)]/5 p-3">
                              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
                                <CheckCircle className="h-3 w-3 text-cyan-400" strokeWidth={1.5} />
                                Saldo posterior a ajustes
                              </div>
                              <div className="space-y-1 text-xs">
                                {typeof postAdjBalanceCRC === "number" && (
                                  <div className="flex items-center justify-between text-[var(--foreground)]">
                                    <span className="text-[var(--muted-foreground)]">CRC</span>
                                    <span className="font-medium">{formatByCurrency("CRC", postAdjBalanceCRC)}</span>
                                  </div>
                                )}
                                {typeof postAdjBalanceUSD === "number" && (
                                  <div className="flex items-center justify-between text-[var(--foreground)]">
                                    <span className="text-[var(--muted-foreground)]">USD</span>
                                    <span className="font-medium">{formatByCurrency("USD", postAdjBalanceUSD)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
