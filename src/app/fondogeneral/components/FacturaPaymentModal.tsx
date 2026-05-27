"use client";

import React from "react";
import { CreditCard, X } from "lucide-react";
import type { FacturaMovement } from "../../../services/facturas";

type FacturaPaymentModalProps = {
  open: boolean;
  target: FacturaMovement | null;
  providerName: string;
  employeeOptions: string[];
  employeesLoading: boolean;
  paymentAmount: string;
  paymentNotes: string;
  paymentManager2: string;
  selectedPaymentPaid: number;
  selectedPaymentBalance: number;
  selectedPaymentStatus: string;
  paymentSubmitting: boolean;
  canSubmitFullPayment: boolean;
  onClose: () => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentNotesChange: (value: string) => void;
  onPaymentManager2Change: (value: string) => void;
  onSubmitPartial: () => void;
  onSubmitFull: () => void;
};

export default function FacturaPaymentModal({
  open,
  target,
  providerName,
  employeeOptions,
  employeesLoading,
  paymentAmount,
  paymentNotes,
  paymentManager2,
  selectedPaymentPaid,
  selectedPaymentBalance,
  selectedPaymentStatus,
  paymentSubmitting,
  canSubmitFullPayment,
  onClose,
  onPaymentAmountChange,
  onPaymentNotesChange,
  onPaymentManager2Change,
  onSubmitPartial,
  onSubmitFull,
}: FacturaPaymentModalProps) {
  if (!open || !target) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 px-3 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--input-border)] px-4 py-4 sm:px-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              Pago de factura crédito
            </div>
            <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              {target.invoiceNumber}
            </h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              {providerName || target.providerCode}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--input-border)] p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/20 hover:text-[var(--foreground)]"
            aria-label="Cerrar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-4 px-4 py-4 sm:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmitPartial();
          }}
        >
          <div className="grid gap-3 rounded-xl border border-[var(--input-border)] bg-[var(--muted)]/10 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Monto total
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {Math.max(0, Math.trunc(Number(target.amount) || 0)).toLocaleString(
                  "es-CR",
                  {
                    style: "currency",
                    currency: target.currency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  },
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Pagado
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {selectedPaymentPaid.toLocaleString("es-CR", {
                  style: "currency",
                  currency: target.currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Saldo
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {selectedPaymentBalance.toLocaleString("es-CR", {
                  style: "currency",
                  currency: target.currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[var(--foreground)]">
              <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Monto a pagar o abonar
              </span>
              <input
                type="number"
                min="1"
                max={selectedPaymentBalance || undefined}
                value={paymentAmount}
                onChange={(event) => onPaymentAmountChange(event.target.value)}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1 text-sm text-[var(--foreground)]">
              <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Encargado extra
              </span>
              <select
                value={paymentManager2}
                onChange={(event) => onPaymentManager2Change(event.target.value)}
                disabled={employeesLoading}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Sin encargado extra</option>
                {employeesLoading && <option value="">Cargando empleados...</option>}
                {!employeesLoading && employeeOptions.length === 0 && (
                  <option value="">No hay empleados registrados</option>
                )}
                {!employeesLoading &&
                  employeeOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-sm text-[var(--foreground)]">
            <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              Observación
            </span>
            <textarea
              rows={4}
              value={paymentNotes}
              onChange={(event) => onPaymentNotesChange(event.target.value)}
              placeholder="Agregue o edite la observación"
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--input-border)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSubmitPartial}
              disabled={paymentSubmitting || selectedPaymentBalance <= 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCard className="h-4 w-4" />
              {paymentSubmitting ? "Guardando..." : "Registrar abono"}
            </button>
            <button
              type="button"
              onClick={onSubmitFull}
              disabled={
                paymentSubmitting ||
                selectedPaymentBalance <= 0 ||
                !canSubmitFullPayment
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Pagar completo
            </button>
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            Estado actual: {selectedPaymentStatus}. El movimiento se actualiza con
            `updateAt` cuando se registra el pago.
          </p>
        </form>
      </div>
    </div>
  );
}
