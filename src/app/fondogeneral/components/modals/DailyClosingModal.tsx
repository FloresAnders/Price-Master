import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ConfirmModal from "../../../../components/ui/ConfirmModal";
import { isWithinCierreRange } from "../../utils/turnoRango";
// Usar botones nativos con clases Tailwind en vez de un componente Button central

const CRC_DENOMINATIONS: readonly number[] = [
  20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25,
];
const USD_DENOMINATIONS: readonly number[] = [100, 50, 20, 10, 5, 1];

type CountState = Record<number, string>;

const buildInitialCounts = (denominations: readonly number[]): CountState => {
  return denominations.reduce<CountState>((acc, denom) => {
    acc[denom] = "";
    return acc;
  }, {} as CountState);
};

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

const buildFormState = (
  initialValues: DailyClosingFormValues | null | undefined,
) => {
  return {
    closingDateISO: initialValues?.closingDate || new Date().toISOString(),
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
  };
};

export type DailyClosingFormValues = {
  closingDate: string;
  manager: string;
  notes: string;
  singleClosingReason?: string;
  noMovements?: boolean;
  noMovementsReason?: string;
  totalCRC: number;
  totalUSD: number;
  breakdownCRC: Record<number, number>;
  breakdownUSD: Record<number, number>;
  turno: "D" | "N";
};

type DailyClosingModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (values: DailyClosingFormValues) => void;
  initialValues?: DailyClosingFormValues | null;
  editId?: string | null;
  onShowHistory?: () => void;
  employees: string[];
  loadingEmployees: boolean;
  currentBalanceCRC: number;
  currentBalanceUSD: number;
  requireSingleClosingReason?: boolean;
  managerReadonly?: boolean;

  turno: "D" | "N";
  cierreFondoVentasMinutesBeforeEnd: number;
  cierreFondoVentasMinutesAfterEnd: number;
};

const DailyClosingModal: React.FC<DailyClosingModalProps> = ({
  open,
  onClose,
  onConfirm,
  initialValues,
  editId,
  onShowHistory,
  employees,
  loadingEmployees,
  currentBalanceCRC,
  currentBalanceUSD,
  requireSingleClosingReason = false,
  managerReadonly = false,
  turno,
  cierreFondoVentasMinutesBeforeEnd,
  cierreFondoVentasMinutesAfterEnd,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const managerFieldRef = useRef<HTMLSelectElement | HTMLInputElement | null>(
    null,
  );

  const [closingDateISO] = useState(
    () => buildFormState(initialValues).closingDateISO,
  );

  const [manager, setManager] = useState(
    () => buildFormState(initialValues).manager,
  );
  const displayedManager = useMemo(() => manager, [manager]);

  const [notes, setNotes] = useState(() => buildFormState(initialValues).notes);
  const [singleClosingReason, setSingleClosingReason] = useState(
    () => initialValues?.singleClosingReason || "",
  );
  const [crcCounts, setCrcCounts] = useState<CountState>(
    () => buildFormState(initialValues).crcCounts,
  );
  const [usdCounts, setUsdCounts] = useState<CountState>(
    () => buildFormState(initialValues).usdCounts,
  );

  const [confirmDiffOpen, setConfirmDiffOpen] = useState(false);
  const [pendingSubmitValues, setPendingSubmitValues] =
    useState<DailyClosingFormValues | null>(null);


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
  const closingDateFormatter = useMemo(
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
  const submitDisabled =
    displayedManager.trim().length === 0 ||
    !hasAnyCash ||
    (requireSingleClosingReason && singleClosingReason.trim().length === 0);
  const hasDifferences = diffCRC !== 0 || diffUSD !== 0;

  const submitDisabledReason = useMemo(() => {
    if (displayedManager.trim().length === 0) {
      return "Selecciona un encargado para poder guardar.";
    }
    if (!hasAnyCash) {
      return "No se puede guardar: el efectivo está en 0. Ingresa el conteo en colones o dólares para realizar el cierre.";
    }
    if (requireSingleClosingReason && singleClosingReason.trim().length === 0) {
      return "Debes indicar el motivo de por qué solo hubo un cierre en el día.";
    }
    return "";
  }, [
    displayedManager,
    hasAnyCash,
    requireSingleClosingReason,
    singleClosingReason,
  ]);

  const differenceLabel = useCallback(
    (currency: "CRC" | "USD", diff: number) => {
      if (diff === 0) return "sin diferencias";
      const sign = diff > 0 ? "+" : "-";
      return `${sign} ${formatCurrency(currency, Math.abs(diff))}`;
    },
    [formatCurrency],
  );

  const differencesConfirmMessage = useMemo(() => {
    if (!hasDifferences) return "";

    const lines: string[] = [
      "Hay diferencias entre el efectivo contado y el saldo registrado.",
      "",
    ];

    if (diffCRC !== 0) {
      lines.push(
        `Colones: contado ${formatCurrency("CRC", totalCRC)} · registrado ${formatCurrency("CRC", currentBalanceCRC)} · diferencia ${differenceLabel("CRC", diffCRC)}`,
      );
    }
    if (diffUSD !== 0) {
      lines.push(
        `Dólares: contado ${formatCurrency("USD", totalUSD)} · registrado ${formatCurrency("USD", currentBalanceUSD)} · diferencia ${differenceLabel("USD", diffUSD)}`,
      );
    }

    lines.push("", "¿Deseas guardar el cierre de todos modos?");
    return lines.join("\n");
  }, [
    hasDifferences,
    totalCRC,
    totalUSD,
    currentBalanceCRC,
    currentBalanceUSD,
    diffCRC,
    diffUSD,
    formatCurrency,
    differenceLabel,
  ]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

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
      root.querySelectorAll<HTMLInputElement>(
        'input[data-cash-count-input="true"]',
      ),
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
  ) => {
    return denominations.reduce<Record<number, number>>((acc, denom) => {
      acc[denom] = normalizeCount(counts[denom]);
      return acc;
    }, {});
  };

  const handleSubmit = () => {
    const trimmedManager = displayedManager.trim();
    if (!trimmedManager || !hasAnyCash) return;

    const values: DailyClosingFormValues = {
      closingDate: closingDateISO,
      manager: trimmedManager,
      notes,
      singleClosingReason: singleClosingReason.trim(),
      noMovements: false,
      noMovementsReason: "",
      totalCRC,
      totalUSD,
      breakdownCRC: buildBreakdown(crcCounts, CRC_DENOMINATIONS),
      breakdownUSD: buildBreakdown(usdCounts, USD_DENOMINATIONS),
      turno,
    };

    if (hasDifferences) {
      setPendingSubmitValues(values);
      setConfirmDiffOpen(true);
      return;
    }

    onConfirm(values);
  };

  const handleConfirmDifferences = () => {
    if (!pendingSubmitValues) {
      setConfirmDiffOpen(false);
      return;
    }
    onConfirm(pendingSubmitValues);
    setConfirmDiffOpen(false);
    setPendingSubmitValues(null);
  };

  const handleCancelDifferences = () => {
    setConfirmDiffOpen(false);
    setPendingSubmitValues(null);
  };

  const handleClearCounts = () => {
    setCrcCounts(buildInitialCounts(CRC_DENOMINATIONS));
    setUsdCounts(buildInitialCounts(USD_DENOMINATIONS));
  };
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-4xl rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-lg max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
        ref={modalRef}
      >
        <div className="flex items-center justify-between gap-4 p-5 pb-0">
          <div className="flex-1" />
          <h3 className="text-lg font-semibold text-center">
            Cierre diario del fondo
          </h3>
          <div className="flex-1 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex flex-col gap-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Fecha de cierre
                </label>
                <div
                  className="h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 flex items-center text-sm text-[var(--foreground)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                >
                  {closingDateFormatter.format(new Date(closingDateISO))}
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
            <div className="text-xs text-center text-[var(--muted-foreground)]">
              Usa{" "}
              <kbd className="mx-0.5 rounded border border-[var(--input-border)] bg-[var(--muted)]/30 px-1.5 py-0.5 font-mono text-[10px]">
                ↑
              </kbd>{" "}
              <kbd className="mx-0.5 rounded border border-[var(--input-border)] bg-[var(--muted)]/30 px-1.5 py-0.5 font-mono text-[10px]">
                ↓
              </kbd>{" "}
              para navegar entre casillas y{" "}
              <kbd className="mx-0.5 rounded border border-[var(--input-border)] bg-[var(--muted)]/30 px-1.5 py-0.5 font-mono text-[10px]">
                ←
              </kbd>{" "}
              <kbd className="mx-0.5 rounded border border-[var(--input-border)] bg-[var(--muted)]/30 px-1.5 py-0.5 font-mono text-[10px]">
                →
              </kbd>{" "}
              para sumar/restar
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
              <section>
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                  Efectivo (colones)
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
                              handleCountChange(
                                "CRC",
                                denom,
                                event.target.value,
                              )
                            }
                            onKeyDown={(e) =>
                              handleCountKeyDown(e, "CRC", denom)
                            }
                            className="w-24 h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 pr-8 text-sm text-center text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                            style={{
                              backgroundColor: "var(--card-bg)",
                              color: "var(--foreground)",
                            }}
                            inputMode="numeric"
                            aria-label={`Cantidad ${denom} colones`}
                            data-cash-count-input="true"
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center select-none">
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => incrementCount("CRC", denom)}
                              className="w-5 h-4 leading-[10px] rounded-t bg-transparent text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                              aria-label={`Aumentar ${denom}`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => decrementCount("CRC", denom)}
                              className="w-5 h-4 leading-[10px] rounded-b bg-transparent text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
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
                  className={`mt-2 text-sm font-semibold ${diffCRC < 0 ? "border-red-500/30 bg-red-500/10 text-red-300" : diffCRC > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-600 bg-slate-800/60 text-slate-300"} rounded border px-2.5 py-1`}
                >
                  Saldo registrado: {formatCurrency("CRC", currentBalanceCRC)} ·
                  Diferencia: {differenceLabel("CRC", diffCRC)}
                </div>
              </section>
              <section className="md:border-l md:border-[var(--input-border)] md:pl-6">
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                  Efectivo (dólares)
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
                              handleCountChange(
                                "USD",
                                denom,
                                event.target.value,
                              )
                            }
                            onKeyDown={(e) =>
                              handleCountKeyDown(e, "USD", denom)
                            }
                            className="w-24 h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 pr-8 text-sm text-center text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                            style={{
                              backgroundColor: "var(--card-bg)",
                              color: "var(--foreground)",
                            }}
                            inputMode="numeric"
                            aria-label={`Cantidad ${denom} dólares`}
                            data-cash-count-input="true"
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center select-none">
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => incrementCount("USD", denom)}
                              className="w-5 h-4 leading-[10px] rounded-t bg-transparent text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                              aria-label={`Aumentar ${denom}`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => decrementCount("USD", denom)}
                              className="w-5 h-4 leading-[10px] rounded-b bg-transparent text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
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
                  className={`mt-2 text-sm font-semibold ${diffUSD < 0 ? "border-red-500/30 bg-red-500/10 text-red-300" : diffUSD > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-600 bg-slate-800/60 text-slate-300"} rounded border px-2.5 py-1`}
                >
                  Saldo registrado: {formatCurrency("USD", currentBalanceUSD)} ·
                  Diferencia: {differenceLabel("USD", diffUSD)}
                </div>
              </section>
            </div>
          </div>
          <div className="flex flex-col gap-1">
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
              placeholder="Notas adicionales del cierre"
            />
          </div>

          {requireSingleClosingReason && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Motivo cierre único
              </label>
              <textarea
                value={singleClosingReason}
                onChange={(event) => setSingleClosingReason(event.target.value)}
                className="min-h-[96px] rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-amber-400/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
                maxLength={400}
                placeholder="Explica por qué solo existe un cierre en el día"
              />
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--input-border)]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClearCounts}
              className={secondaryButtonClass}
            >
              Limpiar conteo
            </button>
            {onShowHistory && (
              <button
                type="button"
                onClick={() => onShowHistory()}
                className={secondaryButtonClass}
              >
                Ver historial
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancelar
            </button>
            <div className="relative group">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitDisabled}
                className={primaryButtonClass}
              >
                {editId ? "Actualizar cierre" : "Guardar cierre"}
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

      <ConfirmModal
        open={confirmDiffOpen}
        title="Confirmar cierre con diferencias"
        message={differencesConfirmMessage}
        confirmText={
          editId ? "Actualizar de todos modos" : "Guardar de todos modos"
        }
        cancelText="Revisar"
        actionType="change"
        onConfirm={handleConfirmDifferences}
        onCancel={handleCancelDifferences}
      />
    </div>
  );
};

export default DailyClosingModal;
