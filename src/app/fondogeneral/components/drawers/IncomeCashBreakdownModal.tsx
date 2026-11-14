"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import {
  CRC_CASH_BILL_DENOMINATIONS,
  type FondoGeneralIncomeSuggestion,
} from "@/components/business/cash-counter-tabs/paymentSuggestion";
import type { BillsMap } from "@/components/business/cash-counter-tabs/types";
import {
  getBillCountKeyAction,
  parseBillCountInput,
} from "@/components/business/cash-counter-tabs/utils";

const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 100;

type CashBreakdownModalProps = {
  title: string;
  targetAmount: number;
  bills: BillsMap;
  availableBills?: BillsMap;
  disabled?: boolean;
  onClose: () => void;
  onApply: (bills: BillsMap) => void;
};

type IncomeProps = {
  suggestion: FondoGeneralIncomeSuggestion;
  disabled?: boolean;
  onClose: () => void;
  onApply: (suggestion: FondoGeneralIncomeSuggestion) => void;
};

const formatCRC = (value: number) =>
  `₡${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export function CashBreakdownModal({
  title,
  targetAmount,
  bills,
  availableBills,
  disabled = false,
  onClose,
  onApply,
}: CashBreakdownModalProps) {
  const [draftBills, setDraftBills] = useState<BillsMap>(() => ({
    ...bills,
  }));
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>(
    {},
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const holdDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRepeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heldActionRef = useRef<(() => void) | null>(null);

  const effectiveBills = useMemo(
    () =>
      Object.fromEntries(
        CRC_CASH_BILL_DENOMINATIONS.map((denomination) => [
          denomination,
          Math.min(
            availableBills
              ? Math.max(0, Math.trunc(availableBills[denomination] ?? 0))
              : Number.POSITIVE_INFINITY,
            quantityDrafts[denomination] === undefined
              ? Math.max(0, Math.trunc(draftBills[denomination] ?? 0))
              : parseBillCountInput(quantityDrafts[denomination]),
          ),
        ]),
      ) as BillsMap,
    [availableBills, draftBills, quantityDrafts],
  );

  const total = useMemo(
    () =>
      Object.entries(effectiveBills).reduce(
        (sum, [denomination, count]) =>
          sum + Number(denomination) * Math.max(0, Math.trunc(count)),
        0,
      ),
    [effectiveBills],
  );

  const clearQuantityDraft = useCallback((denomination: number) => {
    setQuantityDrafts((current) => {
      if (!(denomination in current)) return current;
      const next = { ...current };
      delete next[denomination];
      return next;
    });
  }, []);

  const updateCount = useCallback(
    (denomination: number, delta: 1 | -1) => {
      const maximum = availableBills
        ? Math.max(0, Math.trunc(availableBills[denomination] ?? 0))
        : Number.POSITIVE_INFINITY;
      clearQuantityDraft(denomination);
      setDraftBills((current) => {
        const nextCount = Math.min(
          maximum,
          Math.max(0, Math.trunc(current[denomination] ?? 0) + delta),
        );
        return {
          ...current,
          [denomination]: nextCount,
        };
      });
    },
    [availableBills, clearQuantityDraft],
  );

  const commitQuantity = (denomination: number) => {
    const value = quantityDrafts[denomination];
    if (value === undefined) return;
    const maximum = availableBills
      ? Math.max(0, Math.trunc(availableBills[denomination] ?? 0))
      : Number.POSITIVE_INFINITY;
    setDraftBills((current) => ({
      ...current,
      [denomination]: Math.min(maximum, parseBillCountInput(value)),
    }));
    clearQuantityDraft(denomination);
  };

  const stopHolding = useCallback(() => {
    if (holdDelayTimerRef.current) clearTimeout(holdDelayTimerRef.current);
    if (holdRepeatTimerRef.current) clearInterval(holdRepeatTimerRef.current);
    holdDelayTimerRef.current = null;
    holdRepeatTimerRef.current = null;
    heldActionRef.current = null;
  }, []);

  const startHolding = useCallback((
    event: React.PointerEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (!event.isPrimary || event.button !== 0) return;
    stopHolding();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    heldActionRef.current = action;
    action();
    holdDelayTimerRef.current = setTimeout(() => {
      holdRepeatTimerRef.current = setInterval(() => {
        heldActionRef.current?.();
      }, HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  }, [stopHolding]);

  const handleHoldClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (event.detail === 0) action();
  };

  const handleQuantityKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    const denomination = CRC_CASH_BILL_DENOMINATIONS[index];
    const keyAction = getBillCountKeyAction(event);
    if (keyAction === "type") return;
    if (keyAction === "increment") {
      event.preventDefault();
      updateCount(denomination, 1);
      return;
    }
    if (keyAction === "decrement") {
      event.preventDefault();
      updateCount(denomination, -1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      updateCount(denomination, 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateCount(denomination, -1);
      return;
    }
    if (
      event.key === "Enter" ||
      event.key === "Tab" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      commitQuantity(denomination);
      const targetIndex =
        event.shiftKey && (event.key === "Enter" || event.key === "Tab")
          ? index > 0
            ? index - 1
            : CRC_CASH_BILL_DENOMINATIONS.length - 1
          : index + 1 < CRC_CASH_BILL_DENOMINATIONS.length
            ? index + 1
            : 0;
      inputRefs.current[targetIndex]?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const previous =
        index > 0 ? index - 1 : CRC_CASH_BILL_DENOMINATIONS.length - 1;
      inputRefs.current[previous]?.focus();
    }
  };

  useEffect(() => {
    window.addEventListener("pointerup", stopHolding);
    window.addEventListener("pointercancel", stopHolding);
    window.addEventListener("blur", stopHolding);
    return () => {
      window.removeEventListener("pointerup", stopHolding);
      window.removeEventListener("pointercancel", stopHolding);
      window.removeEventListener("blur", stopHolding);
      stopHolding();
    };
  }, [stopHolding]);

  const applyDraft = () => {
    if (total !== targetAmount) return;
    const selectedBills = Object.fromEntries(
      Object.entries(effectiveBills).filter(([, count]) => count > 0),
    ) as BillsMap;
    onApply(selectedBills);
    onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/70 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-breakdown-title"
        className="w-full max-w-xs rounded-xl border border-emerald-400/30 bg-[#0d1117] p-4 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3
              id="cash-breakdown-title"
              className="font-semibold text-emerald-100"
            >
              {title}
            </h3>
            <p className="text-xs text-slate-400">
              Meta: {formatCRC(targetAmount)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar editor de billetes"
            onClick={onClose}
            disabled={disabled}
            className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          {CRC_CASH_BILL_DENOMINATIONS.map((denomination, index) => {
            const count = Math.max(
              0,
              Math.trunc(effectiveBills[denomination] ?? 0),
            );
            const maximum = availableBills
              ? Math.max(0, Math.trunc(availableBills[denomination] ?? 0))
              : Number.POSITIVE_INFINITY;
            return (
              <div
                key={denomination}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5"
              >
                <span className="text-sm font-semibold">
                  {formatCRC(denomination)}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar un billete de ${formatCRC(denomination)}`}
                  onPointerDown={(event) =>
                    startHolding(event, () => updateCount(denomination, -1))
                  }
                  onClick={(event) =>
                    handleHoldClick(event, () => updateCount(denomination, -1))
                  }
                  disabled={disabled || count <= 0}
                  className="flex h-7 w-7 touch-manipulation items-center justify-center rounded-md border border-white/15 text-slate-200 hover:bg-white/10 disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  aria-label={`Cantidad de billetes de ${formatCRC(denomination)}`}
                  value={
                    quantityDrafts[denomination] ??
                    (count === 0 ? "" : String(count))
                  }
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setQuantityDrafts((current) => ({
                      ...current,
                      [denomination]: value,
                    }));
                  }}
                  onBlur={() => commitQuantity(denomination)}
                  onKeyDown={(event) => handleQuantityKeyDown(event, index)}
                  disabled={disabled}
                  placeholder="0"
                  className="h-7 w-12 rounded-md border border-white/15 bg-black/20 text-center font-mono text-sm font-bold text-white outline-none focus:border-emerald-400 disabled:opacity-50"
                />
                <button
                  type="button"
                  aria-label={`Agregar un billete de ${formatCRC(denomination)}`}
                  onPointerDown={(event) =>
                    startHolding(event, () => updateCount(denomination, 1))
                  }
                  onClick={(event) =>
                    handleHoldClick(event, () => updateCount(denomination, 1))
                  }
                  disabled={disabled || count >= maximum}
                  className="flex h-7 w-7 touch-manipulation items-center justify-center rounded-md border border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <div
          className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
            total === targetAmount
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : "border-amber-400/35 bg-amber-500/10 text-amber-100"
          }`}
        >
          <span>Total seleccionado</span>
          <span className="font-bold">{formatCRC(total)}</span>
        </div>
        {total !== targetAmount && (
          <p className="mt-1 text-xs text-amber-200">
            El total debe coincidir con {formatCRC(targetAmount)}.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={applyDraft}
            disabled={disabled || total !== targetAmount}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aplicar billetes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function IncomeCashBreakdownModal({
  suggestion,
  disabled = false,
  onClose,
  onApply,
}: IncomeProps) {
  return (
    <CashBreakdownModal
      title="Billetes a agregar"
      targetAmount={suggestion.amount}
      bills={suggestion.bills}
      disabled={disabled}
      onClose={onClose}
      onApply={(selectedBills) => onApply({ ...suggestion, bills: selectedBills })}
    />
  );
}
