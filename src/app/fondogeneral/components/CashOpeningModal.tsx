"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

const CRC_DENOMINATIONS: readonly number[] = [
  20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25,
];
const USD_DENOMINATIONS: readonly number[] = [100, 50, 20, 10, 5, 1];

type CountState = Record<number, string>;

const buildInitialCounts = (denominations: readonly number[]): CountState =>
  denominations.reduce<CountState>((acc, denom) => {
    acc[denom] = "";
    return acc;
  }, {} as CountState);

const buildCountsFromBreakdown = (
  denominations: readonly number[],
  breakdown: Record<number, number> | undefined | null,
): CountState => {
  const initial = buildInitialCounts(denominations);
  if (!breakdown) return initial;

  Object.entries(breakdown).forEach(([denom, count]) => {
    const d = Number(denom);
    if (Number.isFinite(d) && denominations.includes(d)) {
      initial[d] = String(count ?? 0) || "";
    }
  });

  return initial;
};

const buildFormState = (initialValues: CashOpeningFormValues | null | undefined) => ({
  openingDateISO: initialValues?.openingDate || new Date().toISOString(),
  manager: initialValues?.manager || "",
  notes: initialValues?.notes || "",
  crcCounts: buildCountsFromBreakdown(
    CRC_DENOMINATIONS,
    initialValues?.breakdownCRC,
  ),
  usdCounts: buildCountsFromBreakdown(
    USD_DENOMINATIONS,
    initialValues?.breakdownUSD,
  ),
});

export type CashOpeningFormValues = {
  openingDate: string;
  manager: string;
  notes: string;
  totalCRC: number;
  totalUSD: number;
  breakdownCRC: Record<number, number>;
  breakdownUSD: Record<number, number>;
};

type CashOpeningModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (values: CashOpeningFormValues) => void;
  initialValues?: CashOpeningFormValues | null;
  employees: string[];
  loadingEmployees: boolean;
  currentBalanceCRC: number;
  currentBalanceUSD: number;
  managerReadonly?: boolean;
};

const CashOpeningModal: React.FC<CashOpeningModalProps> = ({
  open,
  onClose,
  onConfirm,
  initialValues,
  employees,
  loadingEmployees,
  currentBalanceCRC,
  currentBalanceUSD,
  managerReadonly = false,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const managerFieldRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null);

  const [openingDateISO] = useState(() => buildFormState(initialValues).openingDateISO);
  const [manager, setManager] = useState(() => buildFormState(initialValues).manager);
  const displayedManager = useMemo(() => manager, [manager]);
  const [notes, setNotes] = useState(() => buildFormState(initialValues).notes);
  const [crcCounts, setCrcCounts] = useState<CountState>(() =>
    buildFormState(initialValues).crcCounts,
  );
  const [usdCounts, setUsdCounts] = useState<CountState>(() =>
    buildFormState(initialValues).usdCounts,
  );

  const secondaryButtonClass =
    "inline-flex h-11 items-center justify-center rounded-lg border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20 disabled:cursor-not-allowed disabled:opacity-60";
  const primaryButtonClass =
    "inline-flex h-11 items-center justify-center rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60";

  const crcFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );
  const usdFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );
  const openingDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CR", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    [],
  );

  const formatCurrency = useCallback(
    (currency: "CRC" | "USD", value: number) =>
      currency === "USD"
        ? `$ ${usdFormatter.format(Math.trunc(value))}`
        : `₡ ${crcFormatter.format(Math.trunc(value))}`,
    [usdFormatter, crcFormatter],
  );

  const normalizeCount = useCallback((raw: string) => {
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, []);

  const totalCRC = useMemo(
    () =>
      CRC_DENOMINATIONS.reduce(
        (sum, denom) => sum + denom * normalizeCount(crcCounts[denom]),
        0,
      ),
    [crcCounts, normalizeCount],
  );
  const totalUSD = useMemo(
    () =>
      USD_DENOMINATIONS.reduce(
        (sum, denom) => sum + denom * normalizeCount(usdCounts[denom]),
        0,
      ),
    [usdCounts, normalizeCount],
  );

  const diffCRC = totalCRC - Math.trunc(currentBalanceCRC);
  const diffUSD = totalUSD - Math.trunc(currentBalanceUSD);
  const hasAnyCash = totalCRC > 0 || totalUSD > 0;
  const submitDisabled = displayedManager.trim().length === 0 || !hasAnyCash;
  const submitDisabledReason = useMemo(() => {
    if (displayedManager.trim().length === 0) {
      return "Selecciona un encargado para poder guardar.";
    }
    if (!hasAnyCash) {
      return "Ingresa billetes para registrar la apertura.";
    }
    return "";
  }, [displayedManager, hasAnyCash]);

  const differenceLabel = useCallback(
    (currency: "CRC" | "USD", diff: number) => {
      if (diff === 0) return "sin diferencias";
      const sign = diff > 0 ? "+" : "-";
      return `${sign} ${formatCurrency(currency, Math.abs(diff))}`;
    },
    [formatCurrency],
  );

  const handleCountChange = (
    currency: "CRC" | "USD",
    denom: number,
    value: string,
  ) => {
    const sanitized = value.replace(/[^0-9]/g, "");
    if (currency === "CRC") {
      setCrcCounts((prev) => ({ ...prev, [denom]: sanitized }));
    } else {
      setUsdCounts((prev) => ({ ...prev, [denom]: sanitized }));
    }
  };

  const incrementCount = (currency: "CRC" | "USD", denom: number) => {
    if (currency === "CRC") {
      setCrcCounts((prev) => {
        const curr = Number.parseInt(prev[denom] || "0", 10) || 0;
        return { ...prev, [denom]: String(curr + 1) };
      });
    } else {
      setUsdCounts((prev) => {
        const curr = Number.parseInt(prev[denom] || "0", 10) || 0;
        return { ...prev, [denom]: String(curr + 1) };
      });
    }
  };

  const decrementCount = (currency: "CRC" | "USD", denom: number) => {
    if (currency === "CRC") {
      setCrcCounts((prev) => {
        const curr = Number.parseInt(prev[denom] || "0", 10) || 0;
        const next = Math.max(0, curr - 1);
        return { ...prev, [denom]: String(next) };
      });
    } else {
      setUsdCounts((prev) => {
        const curr = Number.parseInt(prev[denom] || "0", 10) || 0;
        const next = Math.max(0, curr - 1);
        return { ...prev, [denom]: String(next) };
      });
    }
  };

  const focusAdjacentCashInput = (
    current: HTMLInputElement,
    direction: 1 | -1,
  ) => {
    const root = modalRef.current;
    if (!root) return;

    const cashInputs = Array.from(
      root.querySelectorAll<HTMLInputElement>('input[data-cash-count-input="true"]'),
    );
    const currentIndex = cashInputs.indexOf(current);
    if (currentIndex === -1) return;

    const next = cashInputs[currentIndex + direction];
    if (next) {
      next.focus();
      next.select();
      return;
    }

    if (direction === 1) {
      managerFieldRef.current?.focus();
    }
  };

  const handleCountKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    currency: "CRC" | "USD",
    denom: number,
  ) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAdjacentCashInput(event.currentTarget, -1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAdjacentCashInput(event.currentTarget, 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      incrementCount(currency, denom);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      decrementCount(currency, denom);
    }
  };

  const buildBreakdown = (
    counts: CountState,
    denominations: readonly number[],
  ) =>
    denominations.reduce<Record<number, number>>((acc, denom) => {
      acc[denom] = normalizeCount(counts[denom]);
      return acc;
    }, {});

  const handleSubmit = () => {
    const trimmedManager = displayedManager.trim();
    if (!trimmedManager || !hasAnyCash) return;

    onConfirm({
      openingDate: openingDateISO,
      manager: trimmedManager,
      notes,
      totalCRC,
      totalUSD,
      breakdownCRC: buildBreakdown(crcCounts, CRC_DENOMINATIONS),
      breakdownUSD: buildBreakdown(usdCounts, USD_DENOMINATIONS),
    });
  };

  const handleClearCounts = () => {
    setCrcCounts(buildInitialCounts(CRC_DENOMINATIONS));
    setUsdCounts(buildInitialCounts(USD_DENOMINATIONS));
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-opening-title"
        className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <div className="relative border-b border-[var(--input-border)] px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="space-y-1 pr-12 text-center">
            <h3 id="cash-opening-title" className="text-lg font-semibold sm:text-xl">
              Apertura de fondo
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] sm:text-sm">
              Si hay diferencia, se ajusta y se notifica automáticamente.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
            <section className="flex h-full flex-col rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)]/40 p-4 sm:p-5">
              <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                Billetes (colones)
              </h4>
              <div className="space-y-2">
                {CRC_DENOMINATIONS.map((denom) => {
                  const quantity = normalizeCount(crcCounts[denom]);
                  const lineTotal = denom * quantity;
                  return (
                    <div key={denom} className="flex items-center gap-3">
                      <label className="w-20 text-xs text-[var(--muted-foreground)]">
                        {denom.toLocaleString("es-CR")}
                      </label>
                      <div className="relative">
                        <input
                          value={crcCounts[denom] ?? ""}
                          onChange={(event) =>
                            handleCountChange("CRC", denom, event.target.value)
                          }
                          onKeyDown={(e) => handleCountKeyDown(e, "CRC", denom)}
                          className="h-11 w-24 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 pr-8 text-center text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                          style={{
                            backgroundColor: "var(--card-bg)",
                            color: "var(--foreground)",
                          }}
                          inputMode="numeric"
                          aria-label={`Cantidad ${denom} colones`}
                          data-cash-count-input="true"
                        />
                        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 select-none flex-col items-center">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => incrementCount("CRC", denom)}
                            className="h-4 w-5 rounded-t bg-transparent leading-[10px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/20 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                            aria-label={`Aumentar ${denom}`}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => decrementCount("CRC", denom)}
                            className="h-4 w-5 rounded-b bg-transparent leading-[10px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/20 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                            aria-label={`Disminuir ${denom}`}
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 text-right text-xs text-[var(--muted-foreground)]">
                        {formatCurrency("CRC", lineTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                Total: {formatCurrency("CRC", totalCRC)}
              </div>
              <div
                className={`mt-2 rounded border px-2.5 py-1 text-sm font-semibold ${
                  diffCRC < 0
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : diffCRC > 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-600 bg-slate-800/60 text-slate-300"
                }`}
              >
                Saldo registrado: {formatCurrency("CRC", currentBalanceCRC)} · Diferencia:{" "}
                {differenceLabel("CRC", diffCRC)}
              </div>
            </section>

            <section className="flex h-full flex-col rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)]/40 p-4 sm:p-5">
              <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                Billetes (dólares)
              </h4>
              <div className="space-y-2">
                {USD_DENOMINATIONS.map((denom) => {
                  const quantity = normalizeCount(usdCounts[denom]);
                  const lineTotal = denom * quantity;
                  return (
                    <div key={denom} className="flex items-center gap-3">
                      <label className="w-20 text-xs text-[var(--muted-foreground)]">
                        {denom}
                      </label>
                      <div className="relative">
                        <input
                          value={usdCounts[denom] ?? ""}
                          onChange={(event) =>
                            handleCountChange("USD", denom, event.target.value)
                          }
                          onKeyDown={(e) => handleCountKeyDown(e, "USD", denom)}
                          className="h-11 w-24 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 pr-8 text-center text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                          style={{
                            backgroundColor: "var(--card-bg)",
                            color: "var(--foreground)",
                          }}
                          inputMode="numeric"
                          aria-label={`Cantidad ${denom} dólares`}
                          data-cash-count-input="true"
                        />
                        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 select-none flex-col items-center">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => incrementCount("USD", denom)}
                            className="h-4 w-5 rounded-t bg-transparent leading-[10px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/20 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                            aria-label={`Aumentar ${denom}`}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => decrementCount("USD", denom)}
                            className="h-4 w-5 rounded-b bg-transparent leading-[10px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/20 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                            aria-label={`Disminuir ${denom}`}
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 text-right text-xs text-[var(--muted-foreground)]">
                        {formatCurrency("USD", lineTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                Total: {formatCurrency("USD", totalUSD)}
              </div>
              <div
                className={`mt-2 rounded border px-2.5 py-1 text-sm font-semibold ${
                  diffUSD < 0
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : diffUSD > 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-600 bg-slate-800/60 text-slate-300"
                }`}
              >
                Saldo registrado: {formatCurrency("USD", currentBalanceUSD)} · Diferencia:{" "}
                {differenceLabel("USD", diffUSD)}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)]/40 p-4 md:grid-cols-2 sm:p-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Fecha de apertura
              </label>
              <div
                className="flex h-11 items-center rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
              >
                {openingDateFormatter.format(new Date(openingDateISO))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Encargado
              </label>
              {employees.length > 0 ? (
                <select
                  value={displayedManager}
                  onChange={(event) => setManager(event.target.value)}
                  className="h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                  disabled={loadingEmployees || managerReadonly}
                  ref={(el) => {
                    managerFieldRef.current = el;
                  }}
                >
                  <option value="">Seleccionar encargado</option>
                  {employees.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={displayedManager}
                  onChange={(event) => setManager(event.target.value)}
                  className="h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                  placeholder="Nombre del encargado"
                  readOnly={managerReadonly}
                  ref={(el) => {
                    managerFieldRef.current = el;
                  }}
                />
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)]/40 p-4 sm:p-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Observaciones
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-[96px] rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
              style={{
                backgroundColor: "var(--card-bg)",
                color: "var(--foreground)",
              }}
              maxLength={400}
              placeholder="Notas de apertura"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--input-border)] px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClearCounts}
              className={secondaryButtonClass}
            >
              Limpiar conteo
            </button>
          </div>
          <div className="flex gap-3">
            <div className="relative group">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitDisabled}
                className={primaryButtonClass}
              >
                Registrar apertura
              </button>
              {submitDisabled && submitDisabledReason ? (
                <div
                  className="pointer-events-none absolute bottom-full right-0 mb-2 w-72 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                  role="tooltip"
                >
                  {submitDisabledReason}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashOpeningModal;
