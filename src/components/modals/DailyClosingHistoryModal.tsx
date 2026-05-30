"use client";

import React from "react";
import {
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  History,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DailyClosingHistorySection from "../daily-closings/DailyClosingHistorySection";

type Currency = "CRC" | "USD";

export type DailyClosingHistoryModalProps = {
  open: boolean;
  onClose: () => void;
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

  canDeleteLatestClosing?: boolean;
  latestClosingLabel?: string;
  onDeleteLatestClosing?: (reason: string) => Promise<void>;
};

export default function DailyClosingHistoryModal({
  open,
  onClose,
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

  canDeleteLatestClosing,
  latestClosingLabel,
  onDeleteLatestClosing,
}: DailyClosingHistoryModalProps) {
  const [deletePanelOpen, setDeletePanelOpen] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState("");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  if (!open) return null;

  const showDeleteBlock =
    Boolean(canDeleteLatestClosing) &&
    typeof onDeleteLatestClosing === "function" &&
    typeof latestClosingLabel === "string" &&
    latestClosingLabel.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pt-10 pb-8"
      onClick={onClose}
    >
      <div className="fixed inset-0 -z-10 bg-black/60 backdrop-blur-sm"></div>
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-closing-history-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--input-border)] bg-[var(--muted)]/10 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-700/35 bg-cyan-950/25">
              <History className="h-4 w-4 text-cyan-300" strokeWidth={1.5} />
            </div>
            <div>
              <h3
                id="daily-closing-history-title"
                className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
              >
                Historial de cierres diarios
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                {dailyClosings.length > 0
                  ? `${dailyClosings.length} cierre${dailyClosings.length !== 1 ? "s" : ""} registrado${dailyClosings.length !== 1 ? "s" : ""}`
                  : "Sin cierres registrados"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/60 hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 sm:p-6">
          {showDeleteBlock && (
            <div className="mb-5 overflow-hidden rounded-xl border border-red-500/20 bg-red-500/[0.04]">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10">
                    <Trash2 className="h-4 w-4 text-red-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      Eliminar último cierre
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      Último cierre:{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        {latestClosingLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-500/30 px-3.5 py-2 text-xs font-semibold text-red-200 transition-colors hover:border-red-400/50 hover:bg-red-500/10"
                  onClick={() => {
                    setDeleteError(null);
                    setDeletePanelOpen((p) => !p);
                  }}
                  disabled={deletePending}
                >
                  {deletePanelOpen ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Cancelar
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Borrar último cierre
                    </>
                  )}
                </button>
              </div>

              {deletePanelOpen && (
                <div className="border-t border-red-500/10 px-4 pb-4 pt-3 sm:px-5">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
                        Motivo <span className="ml-auto text-red-400">*requerido</span>
                      </label>
                      <textarea
                        className="w-full min-h-[88px] rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--accent)]/60 focus:border-red-400/45 focus:ring-2 focus:ring-red-500/20"
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="Ej: Cierre duplicado, error de conteo, registro incorrecto..."
                        disabled={deletePending}
                      />
                    </div>

                    {deleteError && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5 text-xs text-red-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                        {deleteError}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      Esta acción no se puede deshacer
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-[var(--input-border)]/50 pt-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletePanelOpen(false);
                        }}
                        disabled={deletePending}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/12 px-3.5 py-2 text-xs font-semibold text-red-100 transition-colors hover:border-red-400/50 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                        onClick={async () => {
                          const reason = deleteReason.trim();
                          if (!reason) {
                            setDeleteError("Debe indicar un motivo.");
                            return;
                          }
                          setDeletePending(true);
                          setDeleteError(null);
                          try {
                            await onDeleteLatestClosing(reason);
                            setDeleteReason("");
                            setDeletePanelOpen(false);
                          } catch (err) {
                            const message =
                              err instanceof Error
                                ? err.message
                                : typeof err === "string"
                                  ? err
                                  : "No se pudo eliminar el cierre.";
                            setDeleteError(message);
                          } finally {
                            setDeletePending(false);
                          }
                        }}
                        disabled={deletePending || deleteReason.trim().length === 0}
                      >
                        {deletePending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                            Eliminando...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Confirmar borrado
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DailyClosingHistorySection
            closingsAreLoading={closingsAreLoading}
            dailyClosings={dailyClosings}
            quickRange={quickRange}
            onQuickRangeChange={onQuickRangeChange}
            dailyClosingDateFormatter={dailyClosingDateFormatter}
            dateTimeFormatter={dateTimeFormatter}
            buildBreakdownLines={buildBreakdownLines}
            formatByCurrency={formatByCurrency}
            formatDailyClosingDiff={formatDailyClosingDiff}
            getDailyClosingDiffClass={getDailyClosingDiffClass}
            fondoEntries={fondoEntries}
            isAutoAdjustmentProvider={isAutoAdjustmentProvider}
            expandedClosings={expandedClosings}
            setExpandedClosings={setExpandedClosings}
          />
        </div>
      </div>
    </div>
  );
}
