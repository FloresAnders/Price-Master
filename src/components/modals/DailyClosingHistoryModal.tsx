"use client";

import React from "react";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded border border-[var(--input-border)] bg-[#1f262a] p-4 sm:p-6 shadow-lg text-white max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-closing-history-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            id="daily-closing-history-title"
            className="text-lg font-semibold"
          >
            Historial de cierres diarios
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--input-border)] px-2 py-1 text-sm"
          >
            Cerrar
          </button>
        </div>

        {showDeleteBlock && (
          <div className="mb-4 rounded border border-[var(--input-border)] bg-[var(--muted)]/10 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">
                  Eliminar último cierre
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  Último cierre:{" "}
                  <span className="text-[var(--foreground)]">
                    {latestClosingLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="rounded border border-[var(--input-border)] px-3 py-2 text-sm"
                onClick={() => {
                  setDeleteError(null);
                  setDeletePanelOpen((p) => !p);
                }}
                disabled={deletePending}
              >
                {deletePanelOpen ? "Cancelar" : "Borrar último cierre"}
              </button>
            </div>

            {deletePanelOpen && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  Motivo (requerido)
                </label>
                <textarea
                  className="w-full min-h-[84px] rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej: Cierre duplicado / error de conteo / registro incorrecto"
                  disabled={deletePending}
                />

                {deleteError && (
                  <div className="text-xs text-red-400">{deleteError}</div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="rounded border border-[var(--input-border)] px-3 py-2 text-sm"
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
                    className="rounded border border-[var(--input-border)] px-3 py-2 text-sm"
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
                    title="Esta acción no se puede deshacer"
                  >
                    {deletePending ? "Eliminando..." : "Confirmar borrado"}
                  </button>
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
  );
}
