"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { Lock, LockOpen, X } from "lucide-react";

import AgregarMovimiento from "../AgregarMovimiento";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useFloatingActionsSuppression } from "@/components/ui/FloatingActionsDock";
import type { FondoEntry } from "../../types";
import {
  isCreditNotePaymentRoundUpEligible,
  roundCreditNotePaymentAmount,
} from "../../utils/helpers";
import {
  applyFondoGeneralPaymentSuggestion,
  loadFondoGeneralPaymentSuggestion,
  type FondoGeneralPaymentSuggestion,
} from "@/components/business/cash-counter-tabs/paymentSuggestion";
import { openCashCounterForAccount } from "@/components/business/cash-counter-tabs/accountCounters";
import type { MovementAccountKey } from "@/services/movimientos-fondos";

type MovementDrawerProps = ComponentProps<typeof AgregarMovimiento> & {
  open: boolean;
  onClose: () => void;
  editingEntry: FondoEntry | null;
  movementAutoCloseLocked: boolean;
  onToggleMovementAutoCloseLocked: () => void;
  beforeConfirmSubmit?: () => boolean | Promise<boolean>;
  onCashCounterUpdateError?: () => void;
  onCashCounterManualUpdate?: (changeRequired?: number, suggestedAmount?: number) => void;
};

export function MovementDrawer({
  open,
  onClose,
  editingEntry,
  movementAutoCloseLocked,
  onToggleMovementAutoCloseLocked,
  beforeConfirmSubmit,
  onCashCounterUpdateError,
  onCashCounterManualUpdate,
  ...agregarMovimientoProps
}: MovementDrawerProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmSaveLocked, setConfirmSaveLocked] = useState(false);
  const [preparedPaymentSuggestion, setPreparedPaymentSuggestion] =
    useState<FondoGeneralPaymentSuggestion | null>(null);
  const [skipCashCounterDeduction, setSkipCashCounterDeduction] =
    useState(false);
  const confirmSaveLockedRef = useRef(false);
  const preparationRequestRef = useRef(0);
  useFloatingActionsSuppression("movement-drawer", open);
  const {
    onSubmit,
    isSaving,
    selectedProvider,
    providers,
    invoiceNumber,
    extraInvoices = [],
    notes = "",
    isEgreso,
    isIngreso,
    egreso,
    ingreso,
    currency,
  } = agregarMovimientoProps;
  const providerName = useMemo(() => {
    if (!selectedProvider) return "—";
    const p = providers?.find((p) => p.code === selectedProvider);
    return p?.name || selectedProvider;
  }, [selectedProvider, providers]);
  const amountStr = (isEgreso ? egreso : ingreso) || "0";
  const formatCurrencyValue = (value: number) =>
    currency === "USD"
      ? `$${Number(value).toLocaleString("en-US")}`
      : `₡${Number(value).toLocaleString("es-CR")}`;
  const confirmBaseAmount = Math.max(
    0,
    Number(isEgreso ? egreso || 0 : ingreso || 0),
  );
  const confirmRebateAmount = isEgreso
    ? Math.max(
        0,
        Number(agregarMovimientoProps.creditNotesAppliedTotal || 0),
      )
    : 0;
  const confirmPaymentAmount = Math.max(
    0,
    Number(
      agregarMovimientoProps.amountPayment ??
        (Number(amountStr) || 0),
    ),
  );
  const confirmPaymentBeforeRound = Math.max(0, confirmBaseAmount - confirmRebateAmount);
  const confirmRoundingAmount = Math.max(
    0,
    Math.abs(confirmPaymentBeforeRound - confirmPaymentAmount),
  );
  const confirmRoundingPrefix = confirmPaymentAmount >= confirmPaymentBeforeRound ? "+ " : "- ";
  const [confirmInvoiceIndex, setConfirmInvoiceIndex] = useState(0);
  const invoicesToConfirm = useMemo(() => {
    const list: Array<{
      invoiceNumber: string;
      amount: number;
      rebateAmount: number;
      roundingAmount: number;
      roundingPrefix: string;
      observation: string;
      isMain: boolean;
      roundUpToThousand: boolean;
    }> = [
      {
        invoiceNumber: invoiceNumber || "—",
        amount: confirmPaymentAmount,
        rebateAmount: confirmRebateAmount,
        roundingAmount: confirmRoundingAmount,
        roundingPrefix: confirmRoundingPrefix,
        observation: notes,
        isMain: true,
        roundUpToThousand:
          confirmPaymentAmount > confirmPaymentBeforeRound,
      },
      ...extraInvoices.map((extra) => {
        const extraAmount = Math.max(0, Number(extra.amount) || 0);
        const extraRebate = isEgreso
          ? Math.min(
              extraAmount,
              (extra.creditNotes ?? []).reduce(
                (sum, creditNote) =>
                  sum + Math.max(0, Number(creditNote.amount) || 0),
                0,
              ),
            )
          : 0;
        const amountBeforeRound = Math.max(0, extraAmount - extraRebate);
        const paymentAmount = isEgreso || isIngreso
          ? roundCreditNotePaymentAmount(
              amountBeforeRound,
              currency ?? "CRC",
              agregarMovimientoProps.accountKey,
              Boolean(agregarMovimientoProps.roundUpToThousand) &&
                extra.roundUpToThousand !== false &&
                isCreditNotePaymentRoundUpEligible(
                  amountBeforeRound,
                  currency ?? "CRC",
                  agregarMovimientoProps.accountKey,
                ),
            )
          : amountBeforeRound;
        return {
          invoiceNumber: String(extra.invoiceNumber || "").trim() || "—",
          amount: paymentAmount,
          rebateAmount: extraRebate,
          roundingAmount: Math.abs(amountBeforeRound - paymentAmount),
          roundingPrefix: paymentAmount > amountBeforeRound ? "+ " : "- ",
          observation: String(extra.observation || ""),
          isMain: false,
          roundUpToThousand: paymentAmount > amountBeforeRound,
        };
      }),
    ];
    return list;
  }, [
    invoiceNumber,
    confirmPaymentAmount,
    confirmPaymentBeforeRound,
    confirmRebateAmount,
    confirmRoundingAmount,
    confirmRoundingPrefix,
    notes,
    extraInvoices,
    isEgreso,
    isIngreso,
    currency,
    agregarMovimientoProps.accountKey,
    agregarMovimientoProps.roundUpToThousand,
  ]);
  const activeInvoice =
    invoicesToConfirm[confirmInvoiceIndex] ?? invoicesToConfirm[0];
  const totalPaymentAmount = invoicesToConfirm.reduce(
    (total, invoice) => total + invoice.amount,
    0,
  );
  const paymentSuggestionContext = JSON.stringify({
    open,
    editingEntryId: editingEntry?.id ?? null,
    accountKey: agregarMovimientoProps.accountKey ?? null,
    currency,
    invoiceDocType: agregarMovimientoProps.invoiceDocType,
    isEgreso,
    paymentAmount: totalPaymentAmount,
    balanceCRC: agregarMovimientoProps.balanceCRC ?? 0,
    invoiceCount: invoicesToConfirm.length,
  });
  const paymentSuggestionContextRef = useRef(paymentSuggestionContext);
  useEffect(() => {
    paymentSuggestionContextRef.current = paymentSuggestionContext;
  }, [paymentSuggestionContext]);
  const openConfirmIfAllowed = async () => {
    if (confirmSaveLockedRef.current || isSaving) return;
    if ((agregarMovimientoProps.movementCooldownRemainingMs ?? 0) > 0) return;
    const allowed = await beforeConfirmSubmit?.();
    if (allowed === false) return;
    const requestId = preparationRequestRef.current + 1;
    preparationRequestRef.current = requestId;
    const context = paymentSuggestionContext;
    setConfirmInvoiceIndex(0);
    setPreparedPaymentSuggestion(null);
    setSkipCashCounterDeduction(false);
    try {
      const eligible =
        !editingEntry &&
        Boolean(agregarMovimientoProps.accountKey) &&
        currency === "CRC" &&
        agregarMovimientoProps.invoiceDocType === "FCO" &&
        isEgreso &&
        totalPaymentAmount > 0;
      const suggestion = eligible
        ? await loadFondoGeneralPaymentSuggestion({
          accountId: agregarMovimientoProps.accountKey as MovementAccountKey,
          currentBalance: Math.max(
              0,
              Number(agregarMovimientoProps.balanceCRC) || 0,
            ),
            paymentAmount: totalPaymentAmount,
          })
        : null;
      if (
        requestId !== preparationRequestRef.current ||
        context !== paymentSuggestionContextRef.current
      ) {
        return;
      }
      setPreparedPaymentSuggestion(suggestion);
    } catch (error) {
      if (requestId !== preparationRequestRef.current) return;
      console.warn(
        "[FONDO] No se pudo preparar la sugerencia del contador:",
        error,
      );
    }
    setShowConfirmModal(true);
  };
  const handleSaveClick = () => {
    void openConfirmIfAllowed();
  };
  const handleConfirmSave = () => {
    if (confirmSaveLockedRef.current || isSaving) return;
    confirmSaveLockedRef.current = true;
    setConfirmSaveLocked(true);
    const suggestion = preparedPaymentSuggestion;
    const confirmedRoundUpSelections = invoicesToConfirm.map(
      (invoice) => invoice.roundUpToThousand,
    );
    Promise.resolve(onSubmit?.(confirmedRoundUpSelections))
      .then(async (saved) => {
        if (saved !== true || !suggestion) return;
        try {
          if (skipCashCounterDeduction) {
            const accountKey = agregarMovimientoProps.accountKey as MovementAccountKey;
            if (accountKey) {
              openCashCounterForAccount(accountKey);
            }
            onCashCounterManualUpdate?.(
              suggestion.changeRequired,
              suggestion.suggestedAmount,
            );
          } else {
            const applied = await applyFondoGeneralPaymentSuggestion(suggestion);
            if (!applied) {
              onCashCounterUpdateError?.();
            } else if (suggestion.changeRequired > 0) {
              openCashCounterForAccount(suggestion.accountId);
              onCashCounterManualUpdate?.(
                suggestion.changeRequired,
                suggestion.suggestedAmount,
              );
            }
          }
        } catch (error) {
          console.error(
            "[FONDO] Movimiento guardado; contador no actualizado:",
            error,
          );
          onCashCounterUpdateError?.();
        }
      })
      .finally(() => {
        confirmSaveLockedRef.current = false;
        setConfirmSaveLocked(false);
        setShowConfirmModal(false);
        setPreparedPaymentSuggestion(null);
      });
  };
  const handleFieldKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void openConfirmIfAllowed();
      return;
    }
    agregarMovimientoProps.onFieldKeyDown?.(event);
  };
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
            {editingEntry
              ? `Editar movimiento #${editingEntry.invoiceNumber}`
              : "Registrar movimiento"}
          </Typography>
          <Box
            sx={{
              position: "absolute",
              right: 12,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <IconButton
              aria-label={
                movementAutoCloseLocked
                  ? "Desbloquear cierre automatico"
                  : "Bloquear cierre automatico"
              }
              onClick={onToggleMovementAutoCloseLocked}
              sx={{ color: "var(--foreground)" }}
            >
              {movementAutoCloseLocked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <LockOpen className="w-4 h-4" />
              )}
            </IconButton>
            <IconButton
              aria-label="Cerrar registro de movimiento"
              onClick={onClose}
              sx={{ color: "var(--foreground)" }}
            >
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
        </Box>
        <Divider sx={{ borderColor: "var(--input-border)" }} />
        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
          {editingEntry && (
            <Typography
              variant="caption"
              component="p"
              sx={{ color: "var(--muted-foreground)", mb: 2 }}
            >
              Editando movimiento #{editingEntry.invoiceNumber}. Actualiza los
              datos y presiona &quot;Actualizar&quot; o cancela para volver al
              modo de registro.
            </Typography>
          )}
          <AgregarMovimiento
            {...agregarMovimientoProps}
            onSubmit={handleSaveClick}
            onFieldKeyDown={handleFieldKeyDown}
          />
        </Box>
      </Box>
      {createPortal(
        <ConfirmModal
          open={showConfirmModal}
          title="Confirmar guardado"
          message={
            <>
              {invoicesToConfirm.length > 1 ? (
                <span>
                  Se guardarán {invoicesToConfirm.length} facturas. Revisa cada
                  una antes de confirmar.
                </span>
              ) : (
                <span>¿Estás seguro de que deseas guardar este movimiento?</span>
              )}
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    Factura {confirmInvoiceIndex + 1} de{" "}
                    {invoicesToConfirm.length}
                  </span>
                  {invoicesToConfirm.length > 1 && (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {activeInvoice.isMain ? "Principal" : "Adicional"}
                    </span>
                  )}
                </div>
                <div className="space-y-1 rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-sm">
                  {activeInvoice.isMain && (
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">Proveedor:</span>
                      <span className="font-medium text-[var(--foreground)]">{providerName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">N° Factura:</span>
                    <span className="font-medium text-[var(--foreground)]">
                      {activeInvoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">
                      {activeInvoice.isMain
                        ? isIngreso
                          ? "Monto a guardar:"
                          : "Monto real a pagar:"
                        : "Monto:"}
                    </span>
                    <span className="font-medium text-[var(--foreground)]">
                      {formatCurrencyValue(activeInvoice.amount)}
                    </span>
                  </div>
                  {activeInvoice.rebateAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">Rebajo:</span>
                      <span className="font-medium text-amber-200">- {formatCurrencyValue(activeInvoice.rebateAmount)}</span>
                    </div>
                  )}
                  {activeInvoice.roundingAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">
                        {isIngreso ? "Redondeo:" : "Desde caja:"}
                      </span>
                      <span className="font-medium text-amber-200">
                        {activeInvoice.roundingPrefix}
                        {formatCurrencyValue(activeInvoice.roundingAmount)}
                      </span>
                    </div>
                  )}
                  {String(activeInvoice.observation || "").trim() && (
                    <div className="flex justify-between gap-3">
                      <span className="shrink-0 text-[var(--muted-foreground)]">Observación:</span>
                      <span className="text-right font-medium text-[var(--foreground)]">
                        {activeInvoice.observation}
                      </span>
                    </div>
                  )}
                </div>
                {preparedPaymentSuggestion && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100">
                    <div className="font-semibold">Sugerencia de billetes</div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span>Total a guardar</span>
                      <span className="font-semibold">
                        {formatCurrencyValue(preparedPaymentSuggestion.amount)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(preparedPaymentSuggestion.bills)
                        .sort(([left], [right]) => Number(right) - Number(left))
                        .map(([denomination, count]) => (
                          <span
                            key={denomination}
                            className="rounded-md border border-emerald-400/25 bg-black/15 px-2 py-1 font-semibold"
                          >
                            {count} × ₡
                            {denomination.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                          </span>
                        ))}
                    </div>
                    {preparedPaymentSuggestion.changeRequired > 0 && (
                      <div className="mt-2 rounded-md border border-amber-400/40 bg-amber-500/15 p-2 text-amber-100">
                        <div className="font-semibold">
                          Diferencia de caja: - ₡
                          {String(preparedPaymentSuggestion.changeRequired).replace(
                            /\B(?=(\d{3})+(?!\d))/g,
                            ".",
                          )}
                        </div>
                        <div className="mt-1 text-xs">
                          Monto sugerido: ₡
                          {String(preparedPaymentSuggestion.suggestedAmount).replace(
                            /\B(?=(\d{3})+(?!\d))/g,
                            ".",
                          )}
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-emerald-100/75">
                      Al guardar, estos billetes se descontarán del contador de Fondo General.
                    </p>
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-amber-100">
                      <input
                        type="checkbox"
                        checked={skipCashCounterDeduction}
                        onChange={(event) =>
                          setSkipCashCounterDeduction(event.target.checked)
                        }
                        disabled={confirmSaveLocked || isSaving}
                        className="h-4 w-4 accent-amber-500"
                      />
                      No rebajar
                    </label>
                    {skipCashCounterDeduction && (
                      <p className="mt-1 text-xs text-amber-100/80">
                        El contador se actualizará manualmente después de guardar.
                      </p>
                    )}
                  </div>
                )}
                {invoicesToConfirm.length > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={
                        confirmInvoiceIndex === 0 ||
                        confirmSaveLocked ||
                        isSaving
                      }
                      onClick={() =>
                        setConfirmInvoiceIndex((prev) => Math.max(0, prev - 1))
                      }
                      className="rounded border border-[var(--input-border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-border)]/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Anterior
                    </button>
                    <button
                      type="button"
                      disabled={
                        confirmInvoiceIndex ===
                          invoicesToConfirm.length - 1 ||
                        confirmSaveLocked ||
                        isSaving
                      }
                      onClick={() =>
                        setConfirmInvoiceIndex((prev) =>
                          Math.min(invoicesToConfirm.length - 1, prev + 1),
                        )
                      }
                      className="rounded border border-[var(--input-border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-border)]/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </div>
            </>
          }
          confirmText="Guardar"
          cancelText="Cancelar"
          actionType="assign"
          loading={isSaving || confirmSaveLocked}
          onConfirm={handleConfirmSave}
          onCancel={() => {
            if (confirmSaveLocked || isSaving) return;
            preparationRequestRef.current += 1;
            setShowConfirmModal(false);
            setPreparedPaymentSuggestion(null);
          }}
        />,
        document.body,
      )}
    </Drawer>
  );
}
