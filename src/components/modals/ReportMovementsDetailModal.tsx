"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

export type ReportMovementDetail = {
  id: string;
  createdAt: string;
  providerCode: string;
  invoiceNumber: string;
  manager: string;
  notes: string;
  paymentType: string;
  accountId?: string;
  currency?: "CRC" | "USD";
  amountIngreso: number;
  amountEgreso: number;
  companyName?: string;
};

type CurrencyKey = "CRC" | "USD";

type ColumnKey =
  | "createdAt"
  | "manager"
  | "providerCode"
  | "invoiceNumber"
  | "amount"
  | "notes";

type Column = {
  key: ColumnKey;
  label: string;
  defaultWidth: number;
  minWidth: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  currency: CurrencyKey;
  formatAmount: (currency: CurrencyKey, amount: number) => string;
  movements: ReportMovementDetail[];
  loading?: boolean;
  amountSelector: (movement: ReportMovementDetail) => number;
  splitByCompany?: boolean;
};

export default function ReportMovementsDetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  currency,
  formatAmount,
  movements,
  loading = false,
  amountSelector,
  splitByCompany = false,
}: Props) {
  const columns = useMemo<Column[]>(
    () => [
      { key: "createdAt", label: "Fecha", defaultWidth: 190, minWidth: 150 },
      { key: "manager", label: "Encargado", defaultWidth: 140, minWidth: 120 },
      { key: "providerCode", label: "Proveedor", defaultWidth: 240, minWidth: 160 },
      { key: "invoiceNumber", label: "Factura", defaultWidth: 120, minWidth: 90 },
      { key: "amount", label: "Monto", defaultWidth: 130, minWidth: 110 },
      { key: "notes", label: "Notas", defaultWidth: 380, minWidth: 180 },
    ],
    []
  );

  const [colWidths, setColWidths] = useState<number[]>(() =>
    columns.map((c) => c.defaultWidth)
  );

  useEffect(() => {
    setColWidths(columns.map((c) => c.defaultWidth));
  }, [columns]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  const resizeStateRef = useRef<{
    colIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      setColWidths((prev) => {
        const next = prev.slice();
        const column = columns[state.colIndex];
        const proposed = state.startWidth + delta;
        const clamped = Math.max(column.minWidth, Math.min(800, proposed));
        next[state.colIndex] = clamped;
        return next;
      });
    };

    const handleUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [columns]);

  const startResize = (colIndex: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      colIndex,
      startX: event.clientX,
      startWidth: colWidths[colIndex] ?? columns[colIndex]?.defaultWidth ?? 160,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const grouped = useMemo(() => {
    if (!splitByCompany) {
      return [{ companyName: "", movements }];
    }

    const map = new Map<string, ReportMovementDetail[]>();
    movements.forEach((m) => {
      const key = (m.companyName || "(Sin empresa)").trim() || "(Sin empresa)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "es", { sensitivity: "base" }))
      .map(([companyName, list]) => ({ companyName, movements: list }));
  }, [movements, splitByCompany]);

  const overallTotal = useMemo(() => {
    return movements.reduce((acc, m) => acc + (amountSelector(m) || 0), 0);
  }, [movements, amountSelector]);

  const gridTemplateColumns = useMemo(() => {
    return colWidths.map((w) => `${Math.max(60, Math.trunc(w))}px`).join(" ");
  }, [colWidths]);

  const gridMinWidth = useMemo(() => {
    return colWidths.reduce((acc, w) => acc + Math.max(60, Math.trunc(w)), 0);
  }, [colWidths]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 dark:bg-black/80 p-4"
      style={{ pointerEvents: "auto" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-lg shadow-2xl w-full max-w-6xl max-h-[95vh] border border-[var(--input-border)] overflow-hidden"
        style={{ zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-4 sm:p-6 border-b border-[var(--input-border)]">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold truncate">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {subtitle}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Total: <span className="text-[var(--foreground)] font-semibold">{formatAmount(currency, overallTotal)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-auto max-h-[calc(95vh-96px)] overscroll-contain">
          {loading ? (
            <div className="rounded-md border border-[var(--input-border)] bg-[var(--muted)]/10 px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
              Cargando movimientos...
            </div>
          ) : movements.length === 0 ? (
            <div className="rounded-md border border-[var(--input-border)] bg-[var(--muted)]/10 px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
              No hay movimientos para mostrar.
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => {
                const groupTotal = group.movements.reduce(
                  (acc, m) => acc + (amountSelector(m) || 0),
                  0
                );

                return (
                  <section key={group.companyName || "__all__"}>
                    {splitByCompany ? (
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                          {group.companyName}
                        </h3>
                        <div className="text-sm text-[var(--muted-foreground)]">
                          {formatAmount(currency, groupTotal)}
                        </div>
                      </div>
                    ) : null}

                    <div className="overflow-x-auto rounded-lg border border-[var(--input-border)]">
                      <div style={{ minWidth: gridMinWidth }}>
                        <div
                          className="bg-[var(--muted)]/10 text-xs uppercase tracking-wide text-[var(--muted-foreground)] select-none"
                          style={{ display: "grid", gridTemplateColumns }}
                        >
                          {columns.map((col, idx) => (
                            <div
                              key={col.key}
                              className={`relative px-3 py-2 font-semibold border-b border-[var(--input-border)] ${
                                col.key === "amount" ? "text-right" : "text-left"
                              }`}
                            >
                              <span className="pr-3">{col.label}</span>
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                                onMouseDown={(e) => startResize(idx, e)}
                                title="Arrastra para redimensionar"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="divide-y divide-[var(--input-border)] bg-[var(--card-bg)]">
                          {group.movements
                            .slice()
                            .sort(
                              (a, b) =>
                                Date.parse(a.createdAt) - Date.parse(b.createdAt)
                            )
                            .map((m) => {
                              const amount = amountSelector(m) || 0;
                              return (
                                <div
                                  key={m.id}
                                  className="text-sm"
                                  style={{ display: "grid", gridTemplateColumns }}
                                >
                                  <div className="px-3 py-2 whitespace-nowrap">
                                    {new Date(m.createdAt).toLocaleString("es-CR")}
                                  </div>
                                  <div className="px-3 py-2 whitespace-nowrap">
                                    {m.manager || "—"}
                                  </div>
                                  <div
                                    className="px-3 py-2 truncate"
                                    title={m.providerCode || ""}
                                  >
                                    {m.providerCode || "—"}
                                  </div>
                                  <div className="px-3 py-2 whitespace-nowrap">
                                    {m.invoiceNumber || "—"}
                                  </div>
                                  <div className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                                    {formatAmount(currency, amount)}
                                  </div>
                                  <div
                                    className="px-3 py-2 truncate"
                                    title={m.notes || ""}
                                  >
                                    {m.notes || "—"}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
