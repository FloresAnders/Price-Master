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
  balanceCRC?: number;
  balanceUSD?: number;
  pendingCreditNotes?: PendingCreditNoteOption[];
  selectedCreditNoteIds?: string[];
  onToggleCreditNote?: (id: string) => void;
  creditNotesAppliedTotal?: number;
  allowPartialPayment?: boolean;
};

const roundCreditNotePaymentAmount = (
  amount: number,
  currency: "CRC" | "USD",
  accountKey?: string,
): number => {
  const normalized = Math.max(0, Math.trunc(Number(amount) || 0));
  if (currency !== "CRC") return normalized;
  if (accountKey && accountKey !== "FondoGeneral") return normalized;
  return Math.floor(normalized / 1000) * 1000;
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
  paymentSubmitting,
  canSubmitFullPayment,
  onClose,
  onPaymentAmountChange,
  onPaymentNotesChange,
  onPaymentManager2Change,
  onSubmitPartial,
  onSubmitFull,
  balanceCRC = 0,
  balanceUSD = 0,
  pendingCreditNotes = [],
  selectedCreditNoteIds = [],
  onToggleCreditNote,
  creditNotesAppliedTotal = 0,
  allowPartialPayment = true,
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

  const formatCurrencyAmount = React.useCallback(
    (value: number, targetCurrency: string) =>
      targetCurrency === "USD"
        ? `$ ${inputFormatterUSD.format(Math.trunc(value))}`
        : `₡ ${inputFormatterCRC.format(Math.trunc(value))}`,
    [inputFormatterCRC, inputFormatterUSD],
  );

  const enteredPaymentAmount = Math.max(0, Math.trunc(Number(paymentAmount) || 0));
  const selectedCreditNotesRequestedTotal = React.useMemo(() => {
    if (!target) return 0;
    return pendingCreditNotes.reduce((sum, note) => {
      if (!selectedCreditNoteIdSet.has(note.id)) return sum;
      if (note.currency !== target.currency) return sum;
      return sum + Math.max(0, Math.trunc(note.balanceDue));
    }, 0);
  }, [pendingCreditNotes, selectedCreditNoteIdSet, target]);
  const creditNotesOverLimit =
    selectedPaymentBalance > 0 &&
    selectedCreditNotesRequestedTotal > selectedPaymentBalance;
  const maxCashPaymentBeforeAdjustment = Math.max(
    0,
    Math.trunc(selectedPaymentBalance) - Math.trunc(creditNotesAppliedTotal),
  );
  const maxCashPayment =
    target
      ? roundCreditNotePaymentAmount(
          maxCashPaymentBeforeAdjustment,
          target.currency,
          target.accountId,
        )
      : maxCashPaymentBeforeAdjustment;
  const adjustmentApplied = Math.max(
    0,
    maxCashPaymentBeforeAdjustment - maxCashPayment,
  );
  const finalAmountPayment = allowPartialPayment
    ? Math.min(enteredPaymentAmount, maxCashPayment)
    : maxCashPayment;
  const paymentDisplayValue = React.useMemo(() => {
    if (!target) return paymentAmount;
    if (!allowPartialPayment) {
      return formatCurrencyAmount(maxCashPayment, target.currency);
    }
    const digits = String(paymentAmount || "").replace(/\D/g, "");
    if (!digits) return "";
    return formatCurrencyAmount(Number(digits), target.currency);
  }, [paymentAmount, target, formatCurrencyAmount, allowPartialPayment, maxCashPayment]);

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

            <div className="mb-4 flex items-center gap-3 rounded-lg border border-cyan-700/20 bg-cyan-950/10 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-cyan-100/50">
                Saldo actual
              </span>
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-xs font-semibold text-emerald-400">
                  ₡ {balanceCRC.toLocaleString("es-CR")}
                </span>
                <span className="h-3 w-px bg-cyan-700/40" />
                <span className="text-xs font-semibold text-blue-400">
                  $ {balanceUSD.toLocaleString("en-US")}
                </span>
              </div>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (allowPartialPayment) {
                  void onSubmitPartial();
                } else {
                  void onSubmitFull();
                }
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
                    {allowPartialPayment
                      ? "Monto a pagar o abonar"
                      : "Monto a pagar"}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={paymentDisplayValue}
                    onChange={(event) => {
                      if (!allowPartialPayment) return;
                      onPaymentAmountChange(event.target.value.replace(/\D/g, ""));
                    }}
                    disabled={!allowPartialPayment}
                    className="w-full rounded-lg border border-cyan-700/35 bg-cyan-950/25 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-75"
                  />
                </label>
                <label className="space-y-1 text-sm text-[var(--foreground)]">
                  <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Encargado
                  </span>
                  <select
                    value={paymentManager2}
                    onChange={(event) => onPaymentManager2Change(event.target.value)}
                    disabled={employeesLoading}
                    className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Sin encargado</option>
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
                      const wouldExceed =
                        !checked &&
                        selectedPaymentBalance > 0 &&
                        selectedCreditNotesRequestedTotal +
                            Math.max(0, Math.trunc(note.balanceDue)) >
                          selectedPaymentBalance;
                      const disabled =
                        note.currency !== target.currency ||
                        selectedPaymentBalance <= 0 ||
                        wouldExceed;
                      const tooltipMsg = disabled
                        ? note.currency !== target.currency
                          ? "Moneda distinta"
                          : selectedPaymentBalance <= 0
                            ? "No hay saldo disponible"
                            : wouldExceed
                              ? "Supera el saldo disponible"
                              : ""
                        : "";

                      return (
                        <label
                          key={note.id}
                          title={disabled ? tooltipMsg : undefined}
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
                              {disabled && note.currency !== target.currency && (
                                <span className="block text-[11px] text-amber-100/70">
                                  Moneda distinta
                                </span>
                              )}
                              {disabled && selectedPaymentBalance <= 0 && (
                                <span className="block text-[11px] text-amber-100/70">
                                  No hay saldo disponible
                                </span>
                              )}
                              {disabled && wouldExceed && (
                                <span className="block text-[11px] text-amber-100/70">
                                  Supera el saldo disponible
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
                  {creditNotesOverLimit && (
                    <p className="mt-2 text-[11px] text-amber-100/80">
                      Las notas de credito seleccionadas superan el saldo
                      disponible. Desmarca alguna para continuar.
                    </p>
                  )}
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

              <div className="rounded-xl border border-cyan-700/25 bg-cyan-950/10 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
                    Totales
                  </div>
                  <div className="text-[11px] text-cyan-100/50">Resumen de pago</div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-100/70">Monto total factura</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {Math.max(0, Math.trunc(Number(target.amount) || 0)).toLocaleString(
                        "es-CR",
                        {
                          style: "currency",
                          currency: target.currency,
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        },
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-100/70">Pagado</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      - {selectedPaymentPaid.toLocaleString("es-CR", {
                        style: "currency",
                        currency: target.currency,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                  {creditNotesAppliedTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-100/70">NC aplicadas</span>
                      <span className="font-semibold text-amber-200">
                        - {formatCurrencyAmount(creditNotesAppliedTotal, target.currency)}
                      </span>
                    </div>
                  )}
                  {adjustmentApplied > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-100/70">Monto pendiente</span>
                      <span className="font-semibold text-amber-200">
                        - {formatCurrencyAmount(adjustmentApplied, target.currency)}
                      </span>
                    </div>
                  )}
                  <div className="h-px bg-cyan-700/25" />
                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold text-[var(--foreground)]">
                      Total a pagar
                    </span>
                    <span className="text-xl font-bold text-cyan-50">
                      {formatCurrencyAmount(finalAmountPayment, target.currency)}
                    </span>
                  </div>
                </div>
              </div>

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
                  disabled={
                    paymentSubmitting ||
                    selectedPaymentBalance <= 0 ||
                    creditNotesOverLimit
                  }
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    allowPartialPayment
                      ? "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
                      : "hidden"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  {paymentSubmitting ? "Guardando..." : "Registrar Abono"}
                </button>
                <button
                  type="button"
                  onClick={onSubmitFull}
                  disabled={
                    paymentSubmitting ||
                    selectedPaymentBalance <= 0 ||
                    !canSubmitFullPayment ||
                    creditNotesOverLimit
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selectedCreditNoteIds.length > 0
                    ? "Pagar"
                    : "Pagar completo"}
                </button>
              </div>
            </form>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
