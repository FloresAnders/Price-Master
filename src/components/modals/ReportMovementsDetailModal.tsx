"use client";

import React, { useEffect, useMemo } from "react";
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

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  currency: CurrencyKey;
  formatAmount: (currency: CurrencyKey, amount: number) => string;
  movements: ReportMovementDetail[];
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
  amountSelector,
  splitByCompany = false,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
        className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] border border-[var(--input-border)] overflow-hidden"
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

        <div className="p-4 sm:p-6 overflow-auto max-h-[calc(90vh-88px)]">
          {movements.length === 0 ? (
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
                      <table className="min-w-full divide-y divide-[var(--input-border)]">
                        <thead className="bg-[var(--muted)]/10">
                          <tr className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                            <th className="px-3 py-2 text-left font-semibold">
                              Fecha
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Proveedor
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Factura
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Encargado
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Notas
                            </th>
                            <th className="px-3 py-2 text-right font-semibold">
                              Monto
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--input-border)] bg-[var(--card-bg)]">
                          {group.movements
                            .slice()
                            .sort(
                              (a, b) =>
                                Date.parse(a.createdAt) - Date.parse(b.createdAt)
                            )
                            .map((m) => {
                              const amount = amountSelector(m) || 0;
                              return (
                                <tr key={m.id} className="text-sm">
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {new Date(m.createdAt).toLocaleString("es-CR")}
                                  </td>
                                  <td className="px-3 py-2 max-w-[220px] truncate">
                                    {m.providerCode || "—"}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {m.invoiceNumber || "—"}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {m.manager || "—"}
                                  </td>
                                  <td className="px-3 py-2 max-w-[280px] truncate">
                                    {m.notes || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                                    {formatAmount(currency, amount)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
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
