"use client";

import { memo } from "react";
import { X, History } from "lucide-react";
import type { AuditHistoryModalProps } from "./AuditHistoryModal.types";
import { LEGEND } from "./AuditHistoryModal.utils";
import { AuditHistoryItem } from "./AuditHistoryModalItem";

// ── Legend ─────────────────────────────────────────────

const Legend = memo(function Legend() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--muted-foreground)]" aria-label="Leyenda de colores">
      {LEGEND.map((l) => (
        <div key={l.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${l.color}`} />
          <span>{l.label}</span>
        </div>
      ))}
    </div>
  );
});

// ── Empty State ────────────────────────────────────────

const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--input-border)] bg-[var(--muted)]/5 px-6 py-14">
      <History className="h-10 w-10 text-[var(--muted-foreground)]/30" strokeWidth={1.5} />
      <div className="text-sm text-[var(--muted-foreground)]">No hay cambios registrados.</div>
    </div>
  );
});

// ── Header ─────────────────────────────────────────────

function Header({ onClose, subtitle }: { onClose: () => void; subtitle: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--input-border)] bg-[var(--muted)]/10 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-700/35 bg-cyan-950/25">
          <History className="h-4 w-4 text-cyan-300" strokeWidth={1.5} />
        </div>
        <div>
          <h3 id="audit-modal-title" className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Historial de edición</h3>
          <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p>
        </div>
      </div>
      <button
        type="button" onClick={onClose}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/60 hover:text-[var(--foreground)]"
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ── Footer ─────────────────────────────────────────────

function Footer({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-end border-t border-[var(--input-border)] px-5 py-4 sm:px-6">
      <button
        type="button" onClick={onClose}
        className="inline-flex items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
      >
        Cerrar
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export function AuditHistoryModal({
  open, onClose, auditModalData, dateTimeFormatter, formatByCurrency, providersMap,
}: AuditHistoryModalProps) {
  const history = auditModalData?.history;
  const historyCount = history?.length ?? 0;
  const subtitle = history
    ? `${historyCount} cambio${historyCount !== 1 ? "s" : ""} registrado${historyCount !== 1 ? "s" : ""}`
    : "Sin cambios registrados";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pt-10 pb-8" onClick={onClose}>
      <div className="fixed inset-0 -z-10 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="audit-modal-title"
      >
        <Header onClose={onClose} subtitle={subtitle} />

        <div className="max-h-[70vh] overflow-y-auto p-5 sm:p-6">
          <Legend />

          <div className="space-y-3">
            {!history || historyCount === 0 ? (
              <EmptyState />
            ) : (
              history!.map((entry, idx) => (
                <AuditHistoryItem
                  key={idx}
                  entry={entry}
                  idx={idx}
                  total={historyCount}
                  isLast={idx === historyCount - 1}
                  dateTimeFormatter={dateTimeFormatter}
                  formatByCurrency={formatByCurrency}
                  providersMap={providersMap}
                />
              ))
            )}
          </div>
        </div>

        <Footer onClose={onClose} />
      </div>
    </div>
  );
}
