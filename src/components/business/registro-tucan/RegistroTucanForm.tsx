import { CalendarDays, RefreshCw, Save } from "lucide-react";
import {
  fieldBase,
  iconBoxClass,
  labelClass,
  saveButtonClass,
  sectionClass,
} from "./styles";

type RegistroTucanFormProps = {
  dateTimeValue: string;
  serverTimeLoading: boolean;
  saldoPaginaTucanInput: string;
  pagosHoyInput: string;
  saldoFondoTucan: number;
  balanceLoading: boolean;
  saveDisabled: boolean;
  saving: boolean;
  error: string;
  formatCRC: (value: number) => string;
  formatInputDisplay: (raw: string) => string;
  sanitizeAmountInput: (value: string) => string;
  onSaldoPaginaChange: (value: string) => void;
  onPagosHoyChange: (value: string) => void;
  onRefreshBalance: () => void;
  onSubmit: () => void;
};

export function RegistroTucanForm({
  dateTimeValue,
  serverTimeLoading,
  saldoPaginaTucanInput,
  pagosHoyInput,
  saldoFondoTucan,
  balanceLoading,
  saveDisabled,
  saving,
  error,
  formatCRC,
  formatInputDisplay,
  sanitizeAmountInput,
  onSaldoPaginaChange,
  onPagosHoyChange,
  onRefreshBalance,
  onSubmit,
}: RegistroTucanFormProps) {
  return (
    <form
      className={sectionClass}
      onSubmit={(event) => {
        event.preventDefault();
        if (!saveDisabled) onSubmit();
      }}
    >
      <div className="mb-7 flex items-center gap-4">
        <div className={iconBoxClass}>
          <CalendarDays className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">
            Nuevo registro
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Complete la informacion para registrar el movimiento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr_1fr_1.15fr]">
        <label>
          <span className={labelClass}>Fecha y hora</span>
          <div className={`flex items-center ${fieldBase}`}>
            {serverTimeLoading ? "Cargando hora servidor..." : dateTimeValue}
          </div>
        </label>

        <label>
          <span className={labelClass}>Saldo pagina Tucan</span>
          <input
            type="text"
            inputMode="decimal"
            value={formatInputDisplay(saldoPaginaTucanInput)}
            onChange={(event) =>
              onSaldoPaginaChange(sanitizeAmountInput(event.target.value))
            }
            placeholder={formatCRC(0)}
            className={`${fieldBase} text-lg font-semibold`}
          />
        </label>

        <label>
          <span className={labelClass}>Pagos hoy</span>
          <input
            type="text"
            inputMode="decimal"
            value={formatInputDisplay(pagosHoyInput)}
            onChange={(event) =>
              onPagosHoyChange(sanitizeAmountInput(event.target.value))
            }
            placeholder={formatCRC(0)}
            className={`${fieldBase} text-lg font-semibold`}
          />
        </label>

        <label>
          <span className={labelClass}>Fondo Tucan</span>
          <div className="flex gap-2">
            <input
              value={balanceLoading ? "Cargando..." : formatCRC(saldoFondoTucan)}
              readOnly
              className={`${fieldBase} font-semibold`}
            />
            <button
              type="button"
              onClick={onRefreshBalance}
              disabled={balanceLoading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-cyan-700/35 bg-cyan-950/25 text-cyan-100/80 transition-colors hover:border-cyan-500/45 hover:bg-cyan-900/25 disabled:opacity-50"
              title="Actualizar saldo Fondo Tucan"
              aria-label="Actualizar saldo Fondo Tucan"
            >
              <RefreshCw
                className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--error)]">{error}</p>}

      <div className="mt-7 flex justify-end">
        <button type="submit" disabled={saveDisabled} className={saveButtonClass}>
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
