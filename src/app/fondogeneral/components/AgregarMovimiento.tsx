import React, { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Loader2,
  MessageSquare,
  Save,
  Search,
  UserCircle,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { FondoMovementType } from "./fondo";
import {
  formatMovementType,
  isEgresoType,
  isGastoType,
  isIngresoType,
} from "./fondo";

type ProviderOption = {
  code: string;
  name: string;
  type?: FondoMovementType;
  movementCount?: number;
};

type AgregarMovimientoProps = {
  selectedProvider: string;
  onProviderChange: (value: string) => void;
  providers: ProviderOption[];
  providersLoading: boolean;
  isProviderSelectDisabled: boolean;
  providerDisabledTooltip?: string;
  selectedProviderExists: boolean;
  invoiceNumber: string;
  onInvoiceNumberChange: (value: string) => void;
  invoiceDocType: "FCO" | "FCR";
  onInvoiceDocTypeChange: (value: "FCO" | "FCR") => void;
  invoiceValid: boolean;
  invoiceDisabled: boolean;
  paymentType: FondoMovementType;
  isEgreso: boolean;
  egreso: string;
  onEgresoChange: (value: string) => void;
  egresoBorderClass: string;
  ingreso: string;
  onIngresoChange: (value: string) => void;
  ingresoBorderClass: string;
  notes: string;
  onNotesChange: (value: string) => void;
  manager: string;
  onManagerChange: (value: string) => void;
  managerSelectDisabled: boolean;
  employeeOptions: string[];
  employeesLoading: boolean;
  editingEntryId: string | null;
  onCancelEditing: () => void;
  onSubmit: () => void;
  isSubmitDisabled: boolean;
  isSaving?: boolean;
  onFieldKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  currency?: "CRC" | "USD";
  onCurrencyChange?: (c: "CRC" | "USD") => void;
  currencyEnabled?: Record<"CRC" | "USD", boolean>;
  providerError?: string;
  invoiceError?: string;
  amountError?: string;
  managerError?: string;
  // En el type AgregarMovimientoProps agrega:
  balanceCRC?: number;
  balanceUSD?: number;
};

const AgregarMovimiento: React.FC<AgregarMovimientoProps> = ({
  selectedProvider,
  onProviderChange,
  providers,
  providersLoading,
  isProviderSelectDisabled,
  providerDisabledTooltip,
  selectedProviderExists,
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDocType,
  onInvoiceDocTypeChange,
  invoiceValid,
  invoiceDisabled,
  paymentType,
  isEgreso,
  egreso,
  onEgresoChange,
  egresoBorderClass,
  ingreso,
  onIngresoChange,
  ingresoBorderClass,
  notes,
  onNotesChange,
  manager,
  onManagerChange,
  managerSelectDisabled,
  employeeOptions,
  employeesLoading,
  editingEntryId,
  onCancelEditing,
  onSubmit,
  isSubmitDisabled,
  isSaving = false,
  onFieldKeyDown,
  currency = "CRC",
  onCurrencyChange,
  currencyEnabled = { CRC: true, USD: true },
  providerError = "",
  invoiceError = "",
  amountError = "",
  managerError = "",
  balanceCRC = 0,
  balanceUSD = 0,
}) => {
  const invoiceBorderClass =
    invoiceValid || invoiceNumber.length === 0
      ? "border-cyan-700/35"
      : "border-red-500";

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

  const formatInputDisplay = (raw: string) => {
    if (!raw || raw.trim().length === 0) return "";
    const n = Number(raw);
    if (Number.isNaN(n)) return raw;
    return currency === "USD"
      ? `$ ${inputFormatterUSD.format(Math.trunc(n))}`
      : `₡ ${inputFormatterCRC.format(Math.trunc(n))}`;
  };

  const extractDigits = (value: string) => value.replace(/[^0-9]/g, "");

  const [filter, setFilter] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isManagerDropdownOpen, setIsManagerDropdownOpen] = useState(false);

  useEffect(() => {
    if (selectedProvider) {
      const option = providers.find((p) => p.code === selectedProvider);
      const newFilter = option
        ? `${option.name} (${option.code})`
        : selectedProvider;
      const id = window.setTimeout(() => setFilter(newFilter), 0);
      return () => clearTimeout(id);
    }

    const id = window.setTimeout(() => setFilter(""), 0);
    return () => clearTimeout(id);
  }, [selectedProvider, providers]);

  const filteredProviders = providers
    .filter(
      (p) =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.code.toLowerCase().includes(filter.toLowerCase()),
    )
    .sort((a, b) => {
      const countA = a.movementCount ?? 0;
      const countB = b.movementCount ?? 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });

  const getProviderCategory = (type?: FondoMovementType) => {
    if (!type) return null;
    if (isIngresoType(type)) return "INGRESO" as const;
    if (isEgresoType(type)) return "EGRESO" as const;
    if (isGastoType(type)) return "GASTO" as const;
    return null;
  };

  const fieldBase =
    "h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)]";
  const fieldWithIcon = `${fieldBase} pr-11`;
  const sectionClass =
    "rounded-xl border border-cyan-700/25 bg-cyan-950/10 p-3 sm:p-4";
  const labelClass =
    "mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-100/70";
  const iconBoxClass =
    "flex h-7 w-7 items-center justify-center rounded border border-cyan-700/35 bg-cyan-900/25 text-cyan-100/80";
  const selectedPaymentLabel =
    paymentType && paymentType !== "INFORMATIVO"
      ? formatMovementType(paymentType)
      : "Tipo segun proveedor";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-cyan-700/20 bg-cyan-950/10 px-3 py-2">
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
      <section className={sectionClass}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={iconBoxClass}>
              <WalletCards className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Movimiento
              </div>
              <div className="truncate text-xs text-cyan-100/60">
                {selectedProviderExists
                  ? selectedPaymentLabel
                  : "Selecciona un proveedor"}
              </div>
            </div>
          </div>
          <span
            className={`shrink-0 rounded border px-2.5 py-1 text-xs font-semibold ${
              !selectedProviderExists
                ? "border-slate-600 bg-slate-800/60 text-slate-300"
                : isEgreso
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {!selectedProviderExists
              ? "Sin tipo"
              : isEgreso
                ? "Salida"
                : "Entrada"}
          </span>
        </div>

        <div className="grid gap-4">
          <div>
            <label className={labelClass}>
              <Search className="h-3.5 w-3.5" />
              Proveedor
            </label>
            <div className="relative group">
              {selectedProvider && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onProviderChange("");
                    setFilter("");
                  }}
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-red-400 transition-colors hover:text-red-300"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
              <input
                value={filter}
                onChange={(e) => {
                  const value = e.target.value;

                  setFilter(value);
                  setIsDropdownOpen(true);

                  if (value.trim() === "") {
                    onProviderChange("");
                  }
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsDropdownOpen(false), 200);
                }}
                onKeyDown={onFieldKeyDown}
                className={`${fieldBase} ${
                  selectedProvider ? "pl-10 pr-11" : "pr-11"
                } ${providerError ? "border-red-500" : ""} ${
                  isProviderSelectDisabled && providerDisabledTooltip
                    ? "cursor-not-allowed opacity-60"
                    : ""
                }`}
                disabled={isProviderSelectDisabled}
                placeholder={
                  providersLoading
                    ? "Cargando proveedores..."
                    : "Buscar proveedor"
                }
              />
              <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-cyan-100/80">
                {providersLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </span>
              {isProviderSelectDisabled && providerDisabledTooltip && (
                <div className="absolute bottom-full left-0 right-0 z-50 mx-auto mb-2 w-fit max-w-[90vw] rounded border border-yellow-500/40 bg-yellow-500 px-3 py-2 text-center text-sm font-medium text-black opacity-0 shadow-lg transition-opacity pointer-events-none group-hover:opacity-100 sm:max-w-sm">
                  {providerDisabledTooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500" />
                </div>
              )}
              {isDropdownOpen &&
                filteredProviders.length > 0 &&
                !isProviderSelectDisabled && (
                  <div className="absolute z-[9999] mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                    {filteredProviders.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                        className="w-full cursor-pointer border-b border-cyan-900/60 bg-[#0d1117] p-3 text-left transition-colors last:border-b-0 hover:bg-cyan-950/80"
                        onMouseDown={() => {
                          onProviderChange(p.code);
                          setFilter(`${p.name} (${p.code})`);
                          setIsDropdownOpen(false);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          onProviderChange(p.code);
                          setFilter(`${p.name} (${p.code})`);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          {(() => {
                            const category = getProviderCategory(p.type);
                            const isIngreso = category === "INGRESO";
                            const isEgresoProvider = category === "EGRESO";
                            const isGasto = category === "GASTO";
                            return (
                              <div className="flex min-w-0 items-center gap-2">
                                {isIngreso && (
                                  <ArrowDownRight className="h-4 w-4 shrink-0 text-emerald-400" />
                                )}
                                {(isEgresoProvider || isGasto) && (
                                  <ArrowUpRight className="h-4 w-4 shrink-0 text-red-400" />
                                )}
                                <div className="truncate text-sm text-[var(--foreground)]">
                                  {p.name} ({p.code})
                                </div>
                              </div>
                            );
                          })()}

                          {p.type && (
                            <span className="shrink-0 rounded border border-cyan-700/35 bg-cyan-950/30 px-2 py-0.5 text-[11px] text-cyan-100/70">
                              {formatMovementType(p.type)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
            </div>
            {providerError && (
              <p className="mt-1 text-xs text-red-400">{providerError}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              <FileText className="h-3.5 w-3.5" />
              Numero factura
            </label>
            <input
              placeholder="0000"
              value={invoiceNumber}
              onChange={(event) => onInvoiceNumberChange(event.target.value)}
              onKeyDown={onFieldKeyDown}
              className={`${fieldBase} ${
                invoiceError ? "border-red-500" : invoiceBorderClass
              } ${invoiceDisabled ? "cursor-not-allowed opacity-60" : ""}`}
              disabled={invoiceDisabled}
            />

            <div className="mt-3">
              <label className={labelClass}>
                <FileText className="h-3.5 w-3.5" />
                Tipo factura
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["FCO", "FCR"] as const).map((option) => {
                  const active = invoiceDocType === option;
                  const disabled = invoiceDisabled || Boolean(editingEntryId);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => !disabled && onInvoiceDocTypeChange(option)}
                      disabled={disabled}
                      className={`h-10 rounded border px-3 text-sm font-semibold transition-all duration-150 ${
                        active
                          ? "border-cyan-300/45 bg-cyan-500/25 text-cyan-50 shadow-sm shadow-cyan-950/20"
                          : "border-cyan-700/35 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-500/45 hover:bg-cyan-900/25"
                      } ${disabled ? "cursor-not-allowed opacity-45" : "active:scale-[0.99]"}`}
                    >
                      {option === "FCO" ? "Contado (FCO)" : "Crédito (FCR)"}
                    </button>
                  );
                })}
              </div>
            </div>
            {invoiceError && (
              <p className="mt-1 text-xs text-red-400">{invoiceError}</p>
            )}
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <label className={labelClass}>
          <WalletCards className="h-3.5 w-3.5" />
          Monto
        </label>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["CRC", "USD"] as const).map((option) => {
            const enabled = currencyEnabled[option];
            const active = currency === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => enabled && onCurrencyChange?.(option)}
                disabled={!enabled}
                className={`h-10 rounded border px-3 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? "border-cyan-300/45 bg-cyan-500/25 text-cyan-50 shadow-sm shadow-cyan-950/20"
                    : "border-cyan-700/35 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-500/45 hover:bg-cyan-900/25"
                } ${!enabled ? "cursor-not-allowed opacity-45" : "active:scale-[0.99]"}`}
              >
                {option === "CRC" ? "Colones (₡)" : "Dólares ($)"}
              </button>
            );
          })}
        </div>
        <input
          placeholder="0"
          value={formatInputDisplay(isEgreso ? egreso : ingreso)}
          onChange={(event) => {
            const digits = extractDigits(event.target.value);
            if (isEgreso) onEgresoChange(digits);
            else onIngresoChange(digits);
          }}
          onKeyDown={onFieldKeyDown}
          className={`${fieldBase} text-lg font-semibold ${
            amountError
              ? "border-red-500"
              : isEgreso
                ? egresoBorderClass
                : ingresoBorderClass
          } ${currencyEnabled[currency] ? "" : "cursor-not-allowed opacity-50"}`}
          inputMode="numeric"
          disabled={!currencyEnabled[currency]}
        />
        {amountError && (
          <p className="mt-1 text-xs text-red-400">{amountError}</p>
        )}
      </section>

      <section className={sectionClass}>
        <div className="grid gap-4">
          <div>
            <label className={labelClass}>
              <MessageSquare className="h-3.5 w-3.5" />
              Observacion
            </label>
            <input
              placeholder="Observacion"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              onKeyDown={onFieldKeyDown}
              className={fieldBase}
              maxLength={200}
            />
          </div>

          <div>
            <label className={labelClass}>
              <UserCircle className="h-3.5 w-3.5" />
              Encargado
            </label>
            <div
              className="relative"
              onBlur={() => {
                setTimeout(() => setIsManagerDropdownOpen(false), 150);
              }}
            >
              <button
                type="button"
                className={`${fieldBase} flex items-center justify-between text-left ${
                  managerError ? "border-red-500" : ""
                } ${
                  managerSelectDisabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer"
                }`}
                disabled={managerSelectDisabled}
                onClick={() => setIsManagerDropdownOpen((prev) => !prev)}
              >
                <span className={manager ? "" : "text-cyan-100/70"}>
                  {manager ||
                    (employeesLoading
                      ? "Cargando encargados..."
                      : "Seleccionar encargado")}
                </span>
                <span className="text-cyan-100/80">⌄</span>
              </button>
              {isManagerDropdownOpen && !managerSelectDisabled && (
                <div className="absolute z-[9999] mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] p-1 shadow-2xl shadow-black/70">
                  <button
                    type="button"
                    className="w-full rounded px-3 py-2 text-left text-sm text-cyan-100/70 transition-colors hover:bg-cyan-950/80"
                    onMouseDown={() => {
                      onManagerChange("");
                      setIsManagerDropdownOpen(false);
                    }}
                  >
                    Seleccionar encargado
                  </button>
                  {employeeOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                        manager === name
                          ? "bg-cyan-500/20 text-cyan-50"
                          : "text-[var(--foreground)]"
                      }`}
                      onMouseDown={() => {
                        onManagerChange(name);
                        setIsManagerDropdownOpen(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {managerError && (
              <p className="mt-1 text-xs text-red-400">{managerError}</p>
            )}
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-3 flex justify-center gap-2 border-t border-cyan-700/25 bg-[#0d1117]/95 px-3 py-3 backdrop-blur sm:-mx-0 sm:px-0">
        {editingEntryId && (
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-150 hover:border-cyan-500/45 hover:bg-cyan-950/25 active:scale-[0.99] disabled:opacity-50"
            onClick={onCancelEditing}
          >
            <XCircle className="h-4 w-4" />
            <span>Cancelar</span>
          </button>
        )}
        <button
          type="button"
          className="inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded border border-cyan-400/45 bg-cyan-500/20 px-5 text-sm font-semibold text-cyan-50 shadow-sm shadow-cyan-950/20 transition-all duration-150 hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-cyan-500/30 hover:shadow-md hover:shadow-cyan-950/30 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-[var(--input-border)] disabled:bg-cyan-950/15 disabled:text-[var(--muted-foreground)] disabled:opacity-60"
          onClick={onSubmit}
          disabled={isSubmitDisabled || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {editingEntryId ? "Actualizar" : "Guardar"}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AgregarMovimiento;
