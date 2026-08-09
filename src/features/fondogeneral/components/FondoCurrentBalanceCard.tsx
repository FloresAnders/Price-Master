import { Banknote } from "lucide-react";

type Currency = "CRC" | "USD";

type FondoCurrentBalanceCardProps = {
  enabledBalanceCurrencies: Currency[];
  currentBalanceCRC: number;
  currentBalanceUSD: number;
  formatByCurrency: (currency: Currency, amount: number) => string;
};

export function FondoCurrentBalanceCard({
  enabledBalanceCurrencies,
  currentBalanceCRC,
  currentBalanceUSD,
  formatByCurrency,
}: FondoCurrentBalanceCardProps) {
  if (enabledBalanceCurrencies.length === 0) {
    return null;
  }

  return (
    <aside className="min-w-0 xl:w-[300px]">
      <div className="xl:sticky xl:top-20">
        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/20 to-teal-500/15 shadow-[0_10px_35px_rgba(6,182,212,0.12)]">
            <Banknote className="h-7 w-7 text-cyan-400" />
          </div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
            Saldo Actual
          </p>
          <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
            {enabledBalanceCurrencies.map((currency) => {
              const label = currency === "CRC" ? "Colones" : "Dólares";
              const value = currency === "CRC" ? currentBalanceCRC : currentBalanceUSD;
              return (
                <div
                  key={currency}
                  className="rounded-xl border border-white/10 bg-[#050816] px-4 py-4 text-center"
                >
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    {label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold leading-none tracking-tight text-white">
                    {formatByCurrency(currency, value)}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Registrar cierre moved next to 'Agregar movimiento' per UI changes */}
        </div>
      </div>
    </aside>
  );
}
