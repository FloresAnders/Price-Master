import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Search,
  UserCircle,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { FondoMovementType } from "../types";
import {
  CIERRE_FONDO_VENTAS_PROVIDER_NAME,
  SINGLE_CLOSING_REASON_PREFIX,
} from "../constants";
import {
  formatMovementType,
  isEgresoType,
  isGastoType,
  isIngresoType,
} from "../utils/movementTypes/movementTypes";

type ProviderOption = {
  code: string;
  name: string;
  type?: FondoMovementType;
  category?: "Ingreso" | "Gasto" | "Egreso";
  movementCount?: number;
  pendingCreditNotesCount?: number;
  pendingCreditInvoicesCount?: number;
};

type PendingCreditNoteOption = {
  id: string;
  invoiceNumber: string;
  amount: number;
  balanceDue: number;
  currency: "CRC" | "USD";
};

type PendingCreditInvoiceOption = {
  id: string;
  invoiceNumber: string;
  amount: number;
  balanceDue: number;
  currency: "CRC" | "USD";
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
  allowCreditInvoiceOption?: boolean;
  lockInvoiceDocTypeToContado?: boolean;
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
  manager2?: string;
  onManager2Change?: (value: string) => void;
  showManager2?: boolean;
  accountKey?: string;
  managerSelectDisabled: boolean;
  manager2SelectDisabled?: boolean;
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
  currencySelectDisabled?: boolean;
  currencyEnabled?: Record<"CRC" | "USD", boolean>;
  providerError?: string;
  invoiceError?: string;
  amountError?: string;
  managerError?: string;
  manager2Error?: string;
  pendingCreditNotesCount?: number;
  pendingCreditInvoicesCount?: number;
  pendingCreditInvoicesBalanceLabel?: string;
  pendingCreditInvoices?: PendingCreditInvoiceOption[];
  onSelectPendingCreditInvoice?: (id: string) => void;
  pendingCreditNotes?: PendingCreditNoteOption[];
  selectedCreditNoteIds?: string[];
  onToggleCreditNote?: (id: string) => void;
  creditNotesAppliedTotal?: number;
  amountPayment?: number;
  onAddManualCreditNote?: () => void;
  // En el type AgregarMovimientoProps agrega:
  balanceCRC?: number;
  balanceUSD?: number;
  isCompraInventarioProvider?: boolean;
  closingTimeRequest?: {
    visible: boolean;
    label?: string;
    disabled?: boolean;
    onClick: () => void;
  };
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
  allowCreditInvoiceOption = false,
  lockInvoiceDocTypeToContado = false,
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
  currencySelectDisabled = false,
  currencyEnabled = { CRC: true, USD: true },
  providerError = "",
  invoiceError = "",
  amountError = "",
  managerError = "",
  manager2Error = "",
  pendingCreditNotesCount = 0,
  pendingCreditInvoicesCount = 0,
  pendingCreditInvoicesBalanceLabel = "",
  pendingCreditInvoices = [],
  onSelectPendingCreditInvoice,
  pendingCreditNotes = [],
  selectedCreditNoteIds = [],
  onToggleCreditNote,
  creditNotesAppliedTotal = 0,
  amountPayment,
  onAddManualCreditNote,
  manager2 = "",
  onManager2Change,
  showManager2 = false,
  manager2SelectDisabled = false,
  accountKey,
  balanceCRC = 0,
  balanceUSD = 0,
  isCompraInventarioProvider = true,
  closingTimeRequest,
}) => {
  const invoiceBorderClass =
    invoiceValid || invoiceNumber.length === 0
      ? "border-cyan-700/35"
      : "border-red-500";

  const inputFormatterCRC = React.useMemo(
    () =>
      new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [],
  );
  const inputFormatterUSD = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const sanitizeAmountInput = (value: string) => {
    const stripped = value.replace(/\s/g, "").replace(/[^\d.,]/g, "");
    const decimalIndex = Math.max(
      stripped.lastIndexOf(","),
      stripped.lastIndexOf("."),
    );
    if (decimalIndex === -1) return stripped.replace(/[.,]/g, "");
    const integerPart = stripped.slice(0, decimalIndex).replace(/[.,]/g, "");
    const fractionPart = stripped
      .slice(decimalIndex + 1)
      .replace(/[.,]/g, "")
      .slice(0, 2);
    return fractionPart.length > 0
      ? `${integerPart}.${fractionPart}`
      : `${integerPart}.`;
  };
  const formatInputDisplay = (raw: string) => {
    if (!raw || raw.trim().length === 0) return "";
    const n = Number(raw);
    if (Number.isNaN(n)) return raw;
    const normalized = sanitizeAmountInput(raw);
    const [integerPart, fractionPart] = normalized.split(".");
    const integerValue = Number(integerPart || "0");
    const formattedInteger =
      currency === "USD"
        ? inputFormatterUSD.format(integerValue)
        : inputFormatterCRC.format(integerValue);
    const decimalSeparator = currency === "USD" ? "." : ",";
    const suffix = normalized.includes(".")
      ? `${decimalSeparator}${fractionPart ?? ""}`
      : "";
    return currency === "USD"
      ? `$ ${formattedInteger}${suffix}`
      : `₡ ${formattedInteger}${suffix}`;
  };

  const [filter, setFilter] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isManagerDropdownOpen, setIsManagerDropdownOpen] = useState(false);
  const [isManager2DropdownOpen, setIsManager2DropdownOpen] = useState(false);
  const montoRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!lockInvoiceDocTypeToContado) return;
    if (invoiceDocType !== "FCO") onInvoiceDocTypeChange("FCO");
  }, [invoiceDocType, lockInvoiceDocTypeToContado, onInvoiceDocTypeChange]);

  useEffect(() => {
    if (!selectedProvider) return;
    const prov = providers.find((p) => p.code === selectedProvider);
    const isCierre =
      selectedProvider.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME ||
      prov?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
    if (isCierre) {
      montoRef.current?.focus();
    }
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

  const getProviderCategory = (
    type?: FondoMovementType,
    category?: "Ingreso" | "Gasto" | "Egreso",
  ) => {
    if (!type && !category) return null;
    if (type) {
      if (isIngresoType(type)) return "INGRESO" as const;
      if (isEgresoType(type)) return "EGRESO" as const;
      if (isGastoType(type)) return "GASTO" as const;
    }
    if (category === "Ingreso") return "INGRESO" as const;
    if (category === "Egreso") return "EGRESO" as const;
    if (category === "Gasto") return "GASTO" as const;
    return null;
  };

  const fieldBase =
    "h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)]";
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
  const selectedCreditNoteIdSet = React.useMemo(
    () => new Set(selectedCreditNoteIds),
    [selectedCreditNoteIds],
  );
  const formatCurrencyAmount = (value: number, targetCurrency = currency) =>
    targetCurrency === "USD"
      ? `$ ${inputFormatterUSD.format(Math.round(value * 100) / 100)}`
      : `₡ ${inputFormatterCRC.format(Math.round(value * 100) / 100)}`;
  const normalizeAccountAmount = (value: unknown) => {
    const parsed = Number(value) || 0;
    return Math.round(parsed * 100) / 100;
  };
  const baseAmount = Math.max(0, normalizeAccountAmount(isEgreso ? egreso : ingreso));
  const appliedCreditNotesTotal =
    isEgreso && invoiceDocType === "FCO"
      ? Math.max(0, Math.trunc(creditNotesAppliedTotal))
      : 0;
  const selectedCreditNotesRequestedTotal = React.useMemo(() => {
    if (!isEgreso || invoiceDocType !== "FCO") return 0;
    return pendingCreditNotes.reduce((sum, note) => {
      if (!selectedCreditNoteIdSet.has(note.id)) return sum;
      if (note.currency !== currency) return sum;
      return sum + Math.max(0, Math.round((Number(note.balanceDue) || 0) * 100) / 100);
    }, 0);
  }, [
    pendingCreditNotes,
    selectedCreditNoteIdSet,
    currency,
    isEgreso,
    invoiceDocType,
  ]);
  const creditNotesOverLimit =
    isEgreso &&
    invoiceDocType === "FCO" &&
    baseAmount > 0 &&
    selectedCreditNotesRequestedTotal > baseAmount;
  const totalAfterCreditNotes = Math.max(
    0,
    baseAmount - appliedCreditNotesTotal,
  );
  const totalToSave =
    isEgreso &&
    invoiceDocType === "FCO" &&
    currency === "CRC" &&
    (!accountKey || accountKey === "FondoGeneral")
      ? Math.floor(totalAfterCreditNotes / 1000) * 1000
      : totalAfterCreditNotes;
  const adjustmentApplied = Math.max(0, totalAfterCreditNotes - totalToSave);

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
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className={labelClass}>
                <Search className="h-3.5 w-3.5" />
                Proveedor
              </label>
              <span className="flex flex-wrap justify-end gap-1">
                {closingTimeRequest?.visible && (
                  <button
                    type="button"
                    disabled={closingTimeRequest.disabled}
                    onClick={closingTimeRequest.onClick}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Clock className="h-3 w-3" />
                    {closingTimeRequest.label || "Solicitar tiempo"}
                  </button>
                )}
                {pendingCreditInvoicesCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                    <AlertTriangle className="h-3 w-3" />
                    Pago pendiente
                    {pendingCreditInvoicesCount > 1
                      ? `s (${pendingCreditInvoicesCount})`
                      : ""}
                  </span>
                )}
                {pendingCreditNotesCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                    <AlertTriangle className="h-3 w-3" />
                    NC pendiente
                    {pendingCreditNotesCount > 1
                      ? `s (${pendingCreditNotesCount})`
                      : ""}
                  </span>
                )}
              </span>
            </div>
            <div className="relative group">
              {selectedProvider && (
                <button
                  type="button"
                  aria-label="Limpiar proveedor seleccionado"
                  title="Limpiar proveedor seleccionado"
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
                            const category = getProviderCategory(
                              p.type,
                              p.category,
                            );
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

                          <div className="flex shrink-0 items-center gap-1.5">
                            {p.pendingCreditInvoicesCount ? (
                              <span className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                                FCR {p.pendingCreditInvoicesCount}
                              </span>
                            ) : null}
                            {p.pendingCreditNotesCount ? (
                              <span className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                                NC {p.pendingCreditNotesCount}
                              </span>
                            ) : null}
                            {p.type && (
                              <span className="rounded border border-cyan-700/35 bg-cyan-950/30 px-2 py-0.5 text-[11px] text-cyan-100/70">
                                {formatMovementType(p.type)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
            </div>
            {providerError && (
              <p className="mt-1 text-xs text-red-400">{providerError}</p>
            )}
            {pendingCreditInvoicesCount > 0 && (
              <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <div className="font-semibold">
                  Proveedor con pagos pendientes
                </div>
                <div className="mt-0.5 text-amber-100/80">
                  {pendingCreditInvoicesCount} factura
                  {pendingCreditInvoicesCount === 1 ? "" : "s"} a crédito sin
                  saldar
                  {pendingCreditInvoicesBalanceLabel
                    ? `: ${pendingCreditInvoicesBalanceLabel}`
                    : "."}
                </div>
                {pendingCreditInvoices.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {pendingCreditInvoices.map((invoice) => {
                      const disabled = invoice.currency !== currency;
                      return (
                        <button
                          key={invoice.id}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            onSelectPendingCreditInvoice?.(invoice.id)
                          }
                          className={`flex w-full items-center justify-between gap-3 rounded border px-2.5 py-2 text-sm text-left ${
                            disabled
                              ? "cursor-not-allowed border-amber-500/25 bg-black/10 text-cyan-50 opacity-45"
                              : "cursor-pointer border-amber-500/25 bg-black/10 text-cyan-50 hover:border-amber-400/45 hover:bg-amber-500/15"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                Factura #{invoice.invoiceNumber || invoice.id}
                              </span>
                              {disabled && (
                                <span className="block text-[11px] text-amber-100/70">
                                  Moneda distinta
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold">
                            {formatCurrencyAmount(
                              invoice.balanceDue,
                              invoice.currency,
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
        <div className="mb-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-cyan-100/70">
            Tipo factura
          </p>
          <div
            className={`grid gap-2 ${
              allowCreditInvoiceOption ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {(allowCreditInvoiceOption
              ? (["FCO", "FCR"] as const)
              : (["FCO"] as const)
            ).map((option) => {
              const active = invoiceDocType === option;
              const disabled =
                invoiceDisabled ||
                Boolean(editingEntryId) ||
                (lockInvoiceDocTypeToContado && option === "FCR");
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
                  {option === "FCO" ? "Contado" : "Crédito"}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["CRC", "USD"] as const).map((option) => {
            const enabled = currencyEnabled[option];
            const active = currency === option;
            const disabled = !enabled || currencySelectDisabled;
            return (
              <button
                key={option}
                type="button"
                onClick={() => !disabled && onCurrencyChange?.(option)}
                disabled={disabled}
                className={`h-10 rounded border px-3 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? "border-cyan-300/45 bg-cyan-500/25 text-cyan-50 shadow-sm shadow-cyan-950/20"
                    : "border-cyan-700/35 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-500/45 hover:bg-cyan-900/25"
                } ${disabled ? "cursor-not-allowed opacity-45" : "active:scale-[0.99]"}`}
              >
                {option === "CRC" ? "Colones (₡)" : "Dólares ($)"}
              </button>
            );
          })}
        </div>
        <input
          ref={montoRef}
          placeholder="0"
          value={formatInputDisplay(isEgreso ? egreso : ingreso)}
          onChange={(event) => {
            const amount = sanitizeAmountInput(event.target.value);
            if (isEgreso) onEgresoChange(amount);
            else onIngresoChange(amount);
          }}
          onKeyDown={onFieldKeyDown}
          className={`${fieldBase} text-lg font-semibold ${
            amountError
              ? "border-red-500"
              : isEgreso
                ? egresoBorderClass
                : ingresoBorderClass
          } ${currencyEnabled[currency] ? "" : "cursor-not-allowed opacity-50"}`}
          inputMode="decimal"
          disabled={!currencyEnabled[currency]}
        />
        {amountError && (
          <p className="mt-1 text-xs text-red-400">{amountError}</p>
        )}
        {isEgreso &&
          !editingEntryId &&
          onAddManualCreditNote && (
            <button
              type="button"
              onClick={onAddManualCreditNote}
              disabled={!isCompraInventarioProvider}
              title={
                !isCompraInventarioProvider
                  ? "Solo proveedores de tipo Compra Inventario pueden usar notas de crédito"
                  : undefined
              }
              className={`mt-3 inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                !isCompraInventarioProvider
                  ? "cursor-not-allowed border-gray-600/40 bg-gray-700/20 text-gray-500"
                  : "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-500/20"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar Nota de Crédito
            </button>
          )}
        {isEgreso && pendingCreditNotes.length > 0 && !editingEntryId && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-100">
                Notas de credito pendientes
              </div>
              <div className="text-xs font-semibold text-amber-100">
                - {formatCurrencyAmount(creditNotesAppliedTotal)}
              </div>
            </div>
            <div className="space-y-2">
              {pendingCreditNotes.map((note) => {
                const checked = selectedCreditNoteIdSet.has(note.id);
                const wouldExceed =
                  !checked &&
                  baseAmount > 0 &&
                  selectedCreditNotesRequestedTotal +
                            Math.max(0, Math.round((Number(note.balanceDue) || 0) * 100) / 100) >
                    baseAmount;
                const disabled =
                  note.currency !== currency || baseAmount <= 0 || wouldExceed;
                return (
                  <label
                    key={note.id}
                    title={
                      disabled
                        ? note.currency !== currency
                          ? "Moneda distinta"
                          : baseAmount <= 0
                            ? "Ingresa un monto para aplicar NC"
                            : wouldExceed
                              ? "Supera el saldo disponible"
                              : ""
                        : undefined
                    }
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
                        {disabled && note.currency !== currency && (
                          <span className="block text-[11px] text-amber-100/70">
                            Moneda distinta
                          </span>
                        )}
                        {disabled && baseAmount <= 0 && (
                          <span className="block text-[11px] text-amber-100/70">
                            Ingresa un monto para aplicar NC
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
                Las notas de credito seleccionadas superan el saldo disponible.
                Desmarca alguna para continuar.
              </p>
            )}
            {selectedCreditNoteIds.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-amber-500/25 pt-3 text-xs">
                <div className="text-cyan-100/70">Pago generado</div>
                <div className="text-right font-semibold text-emerald-200">
                  {formatCurrencyAmount(Math.max(0, amountPayment ?? 0))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <div className="grid gap-4">
          {/* Observacion */}
          <div className="">
            <label className={labelClass}>
              <MessageSquare className="h-3.5 w-3.5" />
              Observacion
            </label>
            {notes.startsWith(SINGLE_CLOSING_REASON_PREFIX) ? (
              <div
                className={`
    ${fieldBase}
    h-auto min-h-[72px] p-0 overflow-hidden
    flex flex-col
    sm:min-h-[44px] sm:flex-row sm:items-stretch
  `}
              >
                <div
                  className="
      flex min-h-[36px] w-full items-center justify-center
      bg-cyan-800/30 px-3 py-2
      text-center text-[10px] font-semibold uppercase leading-tight
      tracking-wide text-cyan-100/80 select-none
      sm:min-h-0 sm:w-[45%] sm:border-r sm:border-cyan-800/40
    "
                >
                  {SINGLE_CLOSING_REASON_PREFIX}
                </div>

                <div
                  className="
      flex w-full min-w-0 items-center
      border-t border-cyan-800/40
      sm:border-t-0 sm:w-[55%]
    "
                >
                  <input
                    placeholder="especifique el motivo"
                    value={notes.slice(SINGLE_CLOSING_REASON_PREFIX.length)}
                    onChange={(event) =>
                      onNotesChange(
                        SINGLE_CLOSING_REASON_PREFIX + event.target.value,
                      )
                    }
                    onKeyDown={onFieldKeyDown}
                    className="
        w-full min-w-0 bg-transparent px-3 py-2.5
        text-sm text-[var(--foreground)] outline-none
        placeholder:text-cyan-100/50
      "
                    maxLength={200 - SINGLE_CLOSING_REASON_PREFIX.length}
                  />
                </div>
              </div>
            ) : (
              <input
                placeholder="Observacion"
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                onKeyDown={onFieldKeyDown}
                className={fieldBase}
                maxLength={200}
              />
            )}
          </div>

          {/* Encargado */}
          <div>
            <label className={labelClass}>
              <UserCircle className="h-3.5 w-3.5" />
              Encargado
            </label>
            <div
              className="relative"
              onBlur={() =>
                setTimeout(() => setIsManagerDropdownOpen(false), 150)
              }
            >
              <button
                type="button"
                className={`${fieldBase} flex w-full items-center justify-between text-left ${
                  managerError ? "border-red-500" : ""
                } ${
                  managerSelectDisabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer"
                }`}
                disabled={managerSelectDisabled}
                onClick={() => setIsManagerDropdownOpen((prev) => !prev)}
              >
                <span
                  className={`truncate ${manager ? "" : "text-cyan-100/70"}`}
                >
                  {manager ||
                    (employeesLoading
                      ? "Cargando encargados..."
                      : "Seleccionar encargado")}
                </span>
                <span className="ml-2 shrink-0 text-cyan-100/80">⌄</span>
              </button>

              {isManagerDropdownOpen && !managerSelectDisabled && (
                <div className="absolute left-0 right-0 z-[9999] mt-2 max-h-56 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] p-1 shadow-2xl shadow-black/70">
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

          {/* Encargado pago */}
          {showManager2 && onManager2Change && (
            <div>
              <label className={labelClass}>
                <UserCircle className="h-3.5 w-3.5" />
                Encargado pago
              </label>
              <div
                className="relative"
                onBlur={() =>
                  setTimeout(() => setIsManager2DropdownOpen(false), 150)
                }
              >
                <button
                  type="button"
                  className={`${fieldBase} flex w-full items-center justify-between text-left ${
                    manager2SelectDisabled
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  }`}
                  disabled={manager2SelectDisabled}
                  onClick={() => setIsManager2DropdownOpen((prev) => !prev)}
                >
                  <span
                    className={`truncate ${manager2 ? "" : "text-cyan-100/70"}`}
                  >
                    {manager2 ||
                      (employeesLoading
                        ? "Cargando encargados..."
                        : "Seleccionar encargado pago")}
                  </span>
                  <span className="ml-2 shrink-0 text-cyan-100/80">⌄</span>
                </button>

                {isManager2DropdownOpen && !manager2SelectDisabled && (
                  <div className="absolute left-0 right-0 z-[9999] mt-2 max-h-56 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] p-1 shadow-2xl shadow-black/70">
                    <button
                      type="button"
                      className="w-full rounded px-3 py-2 text-left text-sm text-cyan-100/70 transition-colors hover:bg-cyan-950/80"
                      onMouseDown={() => {
                        onManager2Change("");
                        setIsManager2DropdownOpen(false);
                      }}
                    >
                      Seleccionar encargado pago
                    </button>
                    {employeeOptions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                          manager2 === name
                            ? "bg-cyan-500/20 text-cyan-50"
                            : "text-[var(--foreground)]"
                        }`}
                        onMouseDown={() => {
                          onManager2Change(name);
                          setIsManager2DropdownOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {manager2Error && (
                <p className="mt-1 text-xs text-red-400">{manager2Error}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
            Totales
          </div>
          <div className="text-[11px] text-cyan-100/50">Resumen de factura</div>
        </div>
        <div className="mt-2 grid gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-cyan-100/70">Total factura</span>
            <span className="font-semibold text-[var(--foreground)]">
              {formatCurrencyAmount(baseAmount)}
            </span>
          </div>
          {appliedCreditNotesTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-cyan-100/70">NC aplicadas</span>
              <span className="font-semibold text-amber-200">
                - {formatCurrencyAmount(appliedCreditNotesTotal)}
              </span>
            </div>
          )}
          {adjustmentApplied > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-cyan-100/70">Redondeo Aplicado</span>
              <span className="font-semibold text-amber-200">
                - {formatCurrencyAmount(adjustmentApplied)}
              </span>
            </div>
          )}
          <div className="h-px bg-cyan-700/25" />
          <div className="flex items-center justify-between text-base">
            <span className="font-semibold text-[var(--foreground)]">
              Total a guardar
            </span>
            <span className="text-xl font-bold text-cyan-50">
              {formatCurrencyAmount(totalToSave)}
            </span>
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
