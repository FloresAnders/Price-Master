import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";

type Currency = "CRC" | "USD";

type TotalsByCurrency = Record<Currency, { ingreso: number; egreso: number }>;

type FondoTotalsSummaryProps = {
  isSuperAdminUser: boolean;
  superAdminTotalsOpen: boolean;
  onToggleSuperAdminTotalsOpen: () => void;
  totalsByCurrency: TotalsByCurrency;
  formatByCurrency: (currency: Currency, amount: number) => string;
};

export function FondoTotalsSummary({
  isSuperAdminUser,
  superAdminTotalsOpen,
  onToggleSuperAdminTotalsOpen,
  totalsByCurrency,
  formatByCurrency,
}: FondoTotalsSummaryProps) {
  return (
    <div className="mt-4">
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <div className="px-4 py-3 rounded min-w-[220px] fg-balance-card">
            {isSuperAdminUser ? (
              <button
                type="button"
                onClick={onToggleSuperAdminTotalsOpen}
                className="w-full flex items-center justify-between gap-3"
                aria-expanded={superAdminTotalsOpen}
              >
                <div className="text-center font-semibold text-sm text-[var(--muted-foreground)] flex-1">
                  Total del día
                </div>
                {superAdminTotalsOpen ? (
                  <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
                )}
              </button>
            ) : (
              <div className="mb-2 text-center font-semibold text-sm text-[var(--muted-foreground)]">
                Total del día
              </div>
            )}

            {(!isSuperAdminUser || superAdminTotalsOpen) && (
              <div className={isSuperAdminUser ? "mt-3" : ""}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(["CRC", "USD"] as Currency[]).map((currency) => {
                    const ingreso = totalsByCurrency[currency].ingreso;
                    const egreso = totalsByCurrency[currency].egreso;
                    const neto = ingreso - egreso;
                    return (
                      <div
                        key={currency}
                        className="rounded border border-[var(--input-border)] bg-[var(--card-bg)] p-3"
                      >
                        <div className="text-xs uppercase tracking-wide">
                          {currency === "CRC" ? "Colones" : "Dólares"}
                        </div>
                        <div className="mt-2 text-[var(--foreground)]">
                          <div className="flex items-center gap-2">
                            <ArrowDownRight className="w-4 h-4 text-green-500" />
                            <div>
                              Entradas:{" "}
                              <span className="font-semibold text-green-500">
                                {formatByCurrency(currency, ingreso)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <ArrowUpRight className="w-4 h-4 text-red-500" />
                            <div>
                              Salidas:{" "}
                              <span className="font-semibold text-red-500">
                                {formatByCurrency(currency, egreso)}
                              </span>
                            </div>
                          </div>
                          <div className="pt-2">
                            <div>
                              Neto:{" "}
                              <span
                                className={`font-semibold ${
                                  neto > 0
                                    ? "text-green-500"
                                    : neto < 0
                                      ? "text-red-500"
                                      : ""
                                }`}
                              >
                                {formatByCurrency(currency, neto)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
