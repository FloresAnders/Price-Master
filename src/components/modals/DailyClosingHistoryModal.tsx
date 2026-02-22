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
}: DailyClosingHistoryModalProps) {
  if (!open) return null;

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
          <h3 id="daily-closing-history-title" className="text-lg font-semibold">
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
