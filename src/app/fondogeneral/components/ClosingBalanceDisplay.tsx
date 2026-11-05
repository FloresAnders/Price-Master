"use client";

import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { serializeCashCountClipboard } from "@/components/business/cash-counter-tabs/utils";

type Currency = "CRC" | "USD";

type ClosingBalanceDisplayProps = {
  currencyEnabled: Record<Currency, boolean>;
  closingCRC: number;
  closingUSD: number;
  breakdownCRC: Record<number, number> | null;
  breakdownUSD: Record<number, number> | null;
  formatByCurrency: (currency: Currency, amount: number) => string;
  copyToClipboard: (text: string) => Promise<boolean>;
  onCopyError?: () => void;
};

const COPIED_FEEDBACK_MS = 1500;

export function ClosingBalanceDisplay({
  currencyEnabled,
  closingCRC,
  closingUSD,
  breakdownCRC,
  breakdownUSD,
  formatByCurrency,
  copyToClipboard,
  onCopyError,
}: ClosingBalanceDisplayProps) {
  const [expandedCurrencies, setExpandedCurrencies] = useState<Set<Currency>>(
    new Set(),
  );
  const [copiedCurrency, setCopiedCurrency] = useState<Currency | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRequestRef = useRef(0);

  useEffect(
    () => () => {
      copyRequestRef.current += 1;
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  const toggleCurrency = (currency: Currency) => {
    setExpandedCurrencies((current) => {
      const next = new Set(current);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
  };

  const copyBreakdown = async (
    currency: Currency,
    breakdown: Record<number, number>,
  ) => {
    const requestId = copyRequestRef.current + 1;
    copyRequestRef.current = requestId;
    setCopiedCurrency(null);

    let success = false;
    try {
      success = await copyToClipboard(
        serializeCashCountClipboard(currency, breakdown),
      );
    } catch {
      success = false;
    }

    if (requestId !== copyRequestRef.current) return;
    if (!success) {
      onCopyError?.();
      return;
    }

    setCopiedCurrency(currency);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => {
      setCopiedCurrency(null);
      copiedTimerRef.current = null;
    }, COPIED_FEEDBACK_MS);
  };

  const rows: Array<{
    currency: Currency;
    amount: number;
    breakdown: Record<number, number> | null;
  }> = [
    { currency: "CRC", amount: closingCRC, breakdown: breakdownCRC },
    { currency: "USD", amount: closingUSD, breakdown: breakdownUSD },
  ];

  return (
    <div className="flex flex-col gap-1">
      {rows.map(({ currency, amount, breakdown }) => {
        if (!currencyEnabled[currency]) return null;

        const expanded = expandedCurrencies.has(currency);
        const denominations = breakdown
          ? Object.entries(breakdown)
              .filter(([, count]) => Number(count) > 0)
              .map(([denomination, count]) => `${denomination}x${count}`)
              .join(" · ")
          : "";

        return (
          <div key={currency} className="flex w-full flex-col gap-1">
            <button
              type="button"
              onClick={() => toggleCurrency(currency)}
              aria-label={`Desplegar denominaciones ${currency}`}
              aria-expanded={expanded}
              className="flex w-full flex-col items-end rounded border border-[var(--input-border)] bg-[var(--muted)]/15 px-3 py-1 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/25"
            >
              <span>{formatByCurrency(currency, amount)}</span>
            </button>

            {expanded && breakdown === null && (
              <div className="w-full rounded border border-dashed border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1 text-right text-[11px] font-normal text-[var(--muted-foreground)]">
                Denominaciones no disponibles
              </div>
            )}

            {expanded && breakdown !== null && (
              <button
                type="button"
                onClick={() => void copyBreakdown(currency, breakdown)}
                aria-label={`Copiar denominaciones ${currency}`}
                title={`Copiar denominaciones ${currency}`}
                className="flex w-full flex-col items-end rounded border border-dashed border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1 text-right transition-colors hover:bg-[var(--muted)]/35"
              >
                <span className="text-[11px] font-normal text-[var(--muted-foreground)]">
                  {denominations || "Sin denominaciones registradas"}
                </span>
                <span
                  aria-live="polite"
                  className="flex items-center gap-1 text-[10px] font-semibold text-[var(--foreground)]"
                >
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  {copiedCurrency === currency ? "Copiado" : "Clic para copiar"}
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
