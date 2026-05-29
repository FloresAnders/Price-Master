"use client";

import React from "react";
import { CreditCard, X } from "lucide-react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import type { FacturaMovement } from "../../../services/facturas";

type PendingCreditNoteOption = {
  id: string;
  invoiceNumber: string;
  amount: number;
  balanceDue: number;
  currency: "CRC" | "USD";
};

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
  pendingCreditNotes?: PendingCreditNoteOption[];
  selectedCreditNoteIds?: string[];
  onToggleCreditNote?: (id: string) => void;
  creditNotesAppliedTotal?: number;
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
  pendingCreditNotes = [],
  selectedCreditNoteIds = [],
  onToggleCreditNote,
  creditNotesAppliedTotal = 0,
}: FacturaPaymentModalProps) {
  const selectedCreditNoteIdSet = React.useMemo(
    () => new Set(selectedCreditNoteIds),
    [selectedCreditNoteIds],
  );

  const inputFormatterCRC = React.useMemo(
    () =>
      new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );
  const inputFormatterUSD = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );

  const formatCurrencyAmount = React.useCallback((value: number, targetCurrency: string) =>
    targetCurrency === "USD"
      ? `$ ${inputFormatterUSD.format(Math.trunc(value))}`
      : `₡ ${inputFormatterCRC.format(Math.trunc(value))}`, [inputFormatterCRC, inputFormatterUSD]);

  const enteredPaymentAmount = Math.max(0, Math.trunc(Number(paymentAmount) || 0));
  const finalAmountPayment = Math.max(0, enteredPaymentAmount - creditNotesAppliedTotal);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100vw", sm: 520 },
          maxWidth: "100vw",
          bgcolor: "#0d1117",
          color: "#ffffff",
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 3,
            py: 2,
            position: "relative",
          }}
        >
          <Typography
            variant="h6"
            component="h3"
            sx={{ fontWeight: 600, textAlign: "center", width: "100%" }}
          >
            Pago de factura crédito
          </Typography>
          <Box sx={{ position: "absolute", right: 12 }}>
            <IconButton
              aria-label="Cerrar modal"
              onClick={onClose}
              sx={{ color: "var(--foreground)" }}
            >
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
        </Box>
        <Divider sx={{ borderColor: "var(--input-border)" }} />

        {target && (
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {target.invoiceNumber}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                {providerName || target.providerCode}
              </p>
            </div>

            <form
              className="space-y-4"
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
                    className="w-full rounded-lg border border-cyan-700/35 bg-cyan-950/25 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
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
                    className="w-full rounded-lg border border-cyan-700/35 bg-cyan-950/25 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="w-full rounded-lg border border-cyan-700/35 bg-cyan-950/25 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </label>

              {pendingCreditNotes.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-100">
                      Notas de credito pendientes
                    </div>
                    <div className="text-xs font-semibold text-amber-100">
                      - {formatCurrencyAmount(creditNotesAppliedTotal, target.currency)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {pendingCreditNotes.map((note) => {
                      const checked = selectedCreditNoteIdSet.has(note.id);
                      const disabled = note.currency !== target.currency;
                      return (
                        <label
                          key={note.id}
                          className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm ${
                            checked
                              ? "border-amber-300/45 bg-amber-400/15 text-amber-50"
                              : "border-amber-500/25 bg-black/10 text-cyan-50"
                          } ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => onToggleCreditNote?.(note.id)}
                              className="h-4 w-4 accent-amber-400"
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                NC #{note.invoiceNumber || note.id}
                              </span>
                              {disabled && (
                                <span className="block text-[11px] text-amber-100/70">
                                  Moneda distinta
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold">
                            {formatCurrencyAmount(note.balanceDue, note.currency)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedCreditNoteIds.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-amber-500/25 pt-3 text-xs">
                      <div className="text-cyan-100/70">Pago generado</div>
                      <div className="text-right font-semibold text-emerald-200">
                        {formatCurrencyAmount(finalAmountPayment, target.currency)}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
