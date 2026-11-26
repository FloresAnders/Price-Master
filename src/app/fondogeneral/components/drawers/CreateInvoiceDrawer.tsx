"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Search,
  UserCircle,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useFloatingActionsSuppression } from "@/components/ui/FloatingActionsDock";
import type { MovementCurrencyKey } from "@/services/movimientos-fondos";

type ProviderOption = {
  code: string;
  name: string;
};

type CreateInvoiceDrawerProps = {
  open: boolean;
  onClose: () => void;
  currentCompanyLabel: string;
  createFormError: string | null;
  onSubmit: () => void | Promise<void>;
  createProviderCode: string;
  setCreateProviderCode: (value: string) => void;
  createProviderFilter: string;
  setCreateProviderFilter: (value: string) => void;
  createOnlyInventoryProviders: boolean;
  setCreateOnlyInventoryProviders: (value: boolean) => void;
  isCreateProviderDropdownOpen: boolean;
  setIsCreateProviderDropdownOpen: (value: boolean) => void;
  createSubmitting: boolean;
  providersLoading: boolean;
  filteredCreateProviders: ProviderOption[];
  createPaymentType: string;
  createInvoiceNumber: string;
  setCreateInvoiceNumber: (value: string) => void;
  createAdditionalInvoices: Array<{ invoiceNumber: string; amount: string }>;
  setCreateAdditionalInvoices: (
    value: Array<{ invoiceNumber: string; amount: string }>,
  ) => void;
  createInvoiceDocType: "FCR" | "NC";
  setCreateInvoiceDocType: (value: "FCR" | "NC") => void;
  createCurrency: MovementCurrencyKey;
  setCreateCurrency: (value: MovementCurrencyKey) => void;
  createAmount: string;
  setCreateAmount: (value: string) => void;
  createManager: string;
  setCreateManager: (value: string) => void;
  managerSelectDisabled: boolean;
  employeesLoading: boolean;
  paymentEmployeeOptions: string[];
  createNotes: string;
  setCreateNotes: (value: string) => void;
  formatMovementType: (value: string) => string;
};

export default function CreateInvoiceDrawer({
  open,
  onClose,
  currentCompanyLabel,
  createFormError,
  onSubmit,
  createProviderCode,
  setCreateProviderCode,
  createProviderFilter,
  setCreateProviderFilter,
  createOnlyInventoryProviders,
  setCreateOnlyInventoryProviders,
  isCreateProviderDropdownOpen,
  setIsCreateProviderDropdownOpen,
  createSubmitting,
  providersLoading,
  filteredCreateProviders,
  createPaymentType,
  createInvoiceNumber,
  setCreateInvoiceNumber,
  createAdditionalInvoices,
  setCreateAdditionalInvoices,
  createInvoiceDocType,
  setCreateInvoiceDocType,
  createCurrency,
  setCreateCurrency,
  createAmount,
  setCreateAmount,
  createManager,
  setCreateManager,
  managerSelectDisabled,
  employeesLoading,
  paymentEmployeeOptions,
  createNotes,
  setCreateNotes,
  formatMovementType,
}: CreateInvoiceDrawerProps) {
  const [displayAmount, setDisplayAmount] = React.useState("");
  const [isManagerDropdownOpen, setIsManagerDropdownOpen] = React.useState(false);
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const canAddInvoice = createAdditionalInvoices.length < 9;
  useFloatingActionsSuppression("create-invoice-drawer", open);

  const providerName = React.useMemo(() => {
    if (!createProviderCode) return "—";
    const p = filteredCreateProviders?.find((p) => p.code === createProviderCode);
    return p?.name || createProviderCode;
  }, [createProviderCode, filteredCreateProviders]);
  const formatAmount = React.useCallback(
    (raw: string) => {
      if (!raw || raw.trim().length === 0) return createCurrency === "CRC" ? "₡ 0" : "$ 0";
      const n = Math.round((Number(raw) || 0) * 100) / 100;
      const formatted =
        createCurrency === "CRC"
          ? n.toLocaleString("es-CR")
          : n.toLocaleString("en-US");
      return createCurrency === "CRC" ? `₡ ${formatted}` : `$ ${formatted}`;
    },
    [createCurrency],
  );
  const sanitizeAmountInput = React.useCallback((value: string) => {
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
  }, []);
  const formatAmountInput = React.useCallback(
    (raw: string) => {
      if (!raw) return "";
      const normalized = sanitizeAmountInput(raw);
      const [integerPart, fractionPart] = normalized.split(".");
      const integerValue = Number(integerPart || "0");
      const formattedInteger = integerValue.toLocaleString(
        createCurrency === "CRC" ? "es-CR" : "en-US",
      );
      const decimalSeparator = createCurrency === "CRC" ? "," : ".";
      const suffix = normalized.includes(".")
        ? `${decimalSeparator}${fractionPart ?? ""}`
        : "";
      return createCurrency === "CRC"
        ? `₡ ${formattedInteger}${suffix}`
        : `$ ${formattedInteger}${suffix}`;
    },
    [createCurrency, sanitizeAmountInput],
  );

  React.useEffect(() => {
    if (!createAmount) {
      setDisplayAmount("");
      return;
    }
    setDisplayAmount(formatAmountInput(createAmount));
  }, [createAmount, formatAmountInput]);

  const invoiceDrafts = React.useMemo(
    () => [
      { invoiceNumber: createInvoiceNumber, amount: createAmount },
      ...createAdditionalInvoices,
    ],
    [createAdditionalInvoices, createAmount, createInvoiceNumber],
  );
  const totalAmount = React.useMemo(
    () =>
      invoiceDrafts.reduce(
        (total, invoice) => total + (Number(invoice.amount) || 0),
        0,
      ),
    [invoiceDrafts],
  );
  const addInvoice = () => {
    if (!canAddInvoice) return;
    setCreateAdditionalInvoices([
      ...createAdditionalInvoices,
      { invoiceNumber: "", amount: "" },
    ]);
  };
  const updateInvoice = (
    index: number,
    patch: Partial<{ invoiceNumber: string; amount: string }>,
  ) => {
    setCreateAdditionalInvoices(
      createAdditionalInvoices.map((invoice, currentIndex) =>
        currentIndex === index ? { ...invoice, ...patch } : invoice,
      ),
    );
  };
  const removeInvoice = (index: number) => {
    setCreateAdditionalInvoices(
      createAdditionalInvoices.filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    );
  };

  const sectionClass =
    "rounded-xl border border-cyan-700/25 bg-cyan-950/10 p-3 sm:p-4";
  const labelClass =
    "mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-100/70";
  const iconBoxClass =
    "flex h-7 w-7 items-center justify-center rounded border border-cyan-700/35 bg-cyan-900/25 text-cyan-100/80";
  const fieldBase =
    "h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)]";

  return (
    <><Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100vw", sm: 460 },
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
            sx={{ fontWeight: 600, textAlign: "center" }}
          >
            Agregar FC/NC
          </Typography>
          <IconButton
            aria-label="Cerrar"
            onClick={onClose}
            sx={{
              color: "var(--foreground)",
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: "var(--input-border)" }} />

        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
          {createFormError && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {createFormError}
            </div>
          )}

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setShowConfirmModal(true);
            }}
          >
            <div className="flex items-center gap-3 rounded-lg border border-cyan-700/20 bg-cyan-950/10 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-cyan-100/50">
                Empresa
              </span>
              <span className="ml-auto text-xs font-semibold text-[var(--foreground)]">
                {currentCompanyLabel}
              </span>
            </div>

            <section className={sectionClass}>
              <div className="mb-3 flex items-center gap-2">
                <span className={iconBoxClass}>
                  <WalletCards className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Movimiento
                  </div>
                  {createPaymentType && (
                    <div className="text-xs text-cyan-100/60">
                      {formatMovementType(createPaymentType)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className={labelClass}>
                      <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Proveedor
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={createOnlyInventoryProviders}
                        onChange={(event) =>
                          setCreateOnlyInventoryProviders(event.target.checked)
                        }
                        disabled={!createSubmitting}
                        className="h-3.5 w-3.5 rounded border-cyan-700/35 bg-cyan-950/25 text-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100/60">
                        Solo inventario
                      </span>
                    </label>
                  </div>
                  <div className="relative">
                    {createProviderCode && (
                      <button
                        type="button"
                        aria-label="Limpiar proveedor seleccionado"
                        title="Limpiar proveedor seleccionado"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setCreateProviderCode("");
                          setCreateProviderFilter("");
                          setIsCreateProviderDropdownOpen(false);
                        }}
                        className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-red-400 transition-colors hover:text-red-300"
                      >
                        <XCircle className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    )}
                    <input
                      value={createProviderFilter}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateProviderFilter(value);
                        setIsCreateProviderDropdownOpen(true);
                        if (value.trim() === "") {
                          setCreateProviderCode("");
                        }
                      }}
                      onFocus={() => setIsCreateProviderDropdownOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setIsCreateProviderDropdownOpen(false), 200);
                      }}
                      disabled={createSubmitting}
                      placeholder={
                        providersLoading
                          ? "Cargando proveedores..."
                          : "Buscar proveedor"
                      }
                      className={`${fieldBase} ${
                        createProviderCode ? "pl-10 pr-11" : "pr-11"
                      }`}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-cyan-100/80">
                      {providersLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Search className="h-4 w-4" strokeWidth={1.5} />
                      )}
                    </span>
                    {isCreateProviderDropdownOpen &&
                      filteredCreateProviders.length > 0 &&
                      !createSubmitting && (
                        <div className="absolute z-[9999] mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                          {filteredCreateProviders.map((provider) => (
                            <button
                              key={provider.code}
                              type="button"
                              className="w-full cursor-pointer border-b border-cyan-900/60 bg-[#0d1117] p-3 text-left transition-colors last:border-b-0 hover:bg-cyan-950/80"
                              onMouseDown={() => {
                                setCreateProviderCode(provider.code);
                                setCreateProviderFilter(
                                  `${provider.name} (${provider.code})`,
                                );
                                setIsCreateProviderDropdownOpen(false);
                              }}
                              onTouchEnd={(event) => {
                                event.preventDefault();
                                setCreateProviderCode(provider.code);
                                setCreateProviderFilter(
                                  `${provider.name} (${provider.code})`,
                                );
                                setIsCreateProviderDropdownOpen(false);
                              }}
                            >
                              <div className="truncate text-sm text-[var(--foreground)]">
                                {provider.name} ({provider.code})
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>

                <div>
                  <label htmlFor="create-invoice-number-0" className={labelClass}>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Numero factura
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="create-invoice-number-0"
                        aria-label="Numero factura #1"
                        value={createInvoiceNumber}
                        onChange={(event) =>
                          setCreateInvoiceNumber(
                            event.target.value.replace(/\D/g, "").slice(0, 4),
                          )
                        }
                        placeholder="Factura #1"
                        disabled={createSubmitting}
                        maxLength={4}
                        inputMode="numeric"
                        className={fieldBase}
                      />
                      {canAddInvoice && (
                        <button
                          type="button"
                          aria-label="Agregar factura"
                          title="Agregar factura"
                          onClick={addInvoice}
                          disabled={createSubmitting}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {createAdditionalInvoices.map((invoice, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          id={`create-invoice-number-${index + 1}`}
                          aria-label={`Numero factura #${index + 2}`}
                          value={invoice.invoiceNumber}
                          onChange={(event) =>
                            updateInvoice(index, {
                              invoiceNumber: event.target.value
                                .replace(/\D/g, "")
                                .slice(0, 4),
                            })
                          }
                          placeholder={`Factura #${index + 2}`}
                          disabled={createSubmitting}
                          maxLength={4}
                          inputMode="numeric"
                          className={fieldBase}
                        />
                        <button
                          type="button"
                          aria-label={`Quitar factura #${index + 2}`}
                          title="Quitar factura"
                          onClick={() => removeInvoice(index)}
                          disabled={createSubmitting}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-red-500/30 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <label className={labelClass}>
                <WalletCards className="h-3.5 w-3.5" strokeWidth={1.5} />
                Monto
              </label>
              <div className="mb-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-cyan-100/70">
                  Tipo de documento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "FCR", label: "Factura de Credito (FCR)" },
                      { value: "NC", label: "Nota de Credito (NC)" },
                    ] as const
                  ).map((option) => {
                    const active = createInvoiceDocType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCreateInvoiceDocType(option.value)}
                        disabled={createSubmitting}
                        className={`h-10 rounded border px-2 text-xs font-semibold transition-all duration-150 ${
                          active
                            ? "border-cyan-300/45 bg-cyan-500/25 text-cyan-50 shadow-sm shadow-cyan-950/20"
                            : "border-cyan-700/35 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-500/45 hover:bg-cyan-900/25"
                        } ${createSubmitting ? "cursor-not-allowed opacity-60" : "active:scale-[0.99]"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-cyan-100/70">
                  Moneda
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["CRC", "USD"] as const).map((option) => {
                    const active = createCurrency === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setCreateCurrency(option)}
                        disabled={createSubmitting}
                        className={`h-10 rounded border px-3 text-sm font-semibold transition-all duration-150 ${
                          active
                            ? "border-cyan-300/45 bg-cyan-500/25 text-cyan-50 shadow-sm shadow-cyan-950/20"
                            : "border-cyan-700/35 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-500/45 hover:bg-cyan-900/25"
                        } ${createSubmitting ? "cursor-not-allowed opacity-60" : "active:scale-[0.99]"}`}
                      >
                        {option === "CRC" ? "Colones (₡)" : "Dólares ($)"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="create-invoice-amount-0" className="sr-only">
                  Monto factura #1
                </label>
                <input
                  id="create-invoice-amount-0"
                  type="text"
                  inputMode="decimal"
                  value={displayAmount}
                  onChange={(e) => {
                    const raw = sanitizeAmountInput(e.target.value);
                    setDisplayAmount(formatAmountInput(raw));
                    setCreateAmount(raw);
                  }}
                  placeholder={createCurrency === "CRC" ? "₡0" : "$0"}
                  disabled={createSubmitting}
                  className={`${fieldBase} text-lg font-semibold`}
                />
                {createAdditionalInvoices.map((invoice, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <label
                      htmlFor={`create-invoice-amount-${index + 1}`}
                      className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-cyan-100/60"
                    >
                      Factura #{index + 2}
                    </label>
                    <input
                      id={`create-invoice-amount-${index + 1}`}
                      type="text"
                      inputMode="decimal"
                      value={formatAmountInput(invoice.amount)}
                      onChange={(event) =>
                        updateInvoice(index, {
                          amount: sanitizeAmountInput(event.target.value),
                        })
                      }
                      placeholder={createCurrency === "CRC" ? "₡0" : "$0"}
                      disabled={createSubmitting}
                      className={`${fieldBase} text-lg font-semibold`}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className={sectionClass}>
              <div className="grid gap-4">
                <div>
                  <label className={labelClass}>
                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Observacion
                  </label>
                  <textarea
                    rows={3}
                    value={createNotes}
                    onChange={(event) => setCreateNotes(event.target.value)}
                    placeholder="Observacion"
                    disabled={createSubmitting}
                    className="w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    <UserCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
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
                        createSubmitting ||
                        employeesLoading ||
                        managerSelectDisabled
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      }`}
                      disabled={createSubmitting || employeesLoading || managerSelectDisabled}
                      onClick={() => setIsManagerDropdownOpen((prev) => !prev)}
                    >
                      <span className={createManager ? "" : "text-cyan-100/70"}>
                        {createManager ||
                          (employeesLoading
                            ? "Cargando encargados..."
                            : "Seleccionar encargado")}
                      </span>
                      <span className="text-cyan-100/80">⌄</span>
                    </button>
                    {isManagerDropdownOpen &&
                      !createSubmitting &&
                      !employeesLoading &&
                      !managerSelectDisabled && (
                        <div className="absolute z-[9999] mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] p-1 shadow-2xl shadow-black/70">
                          <button
                            type="button"
                            className="w-full rounded px-3 py-2 text-left text-sm text-cyan-100/70 transition-colors hover:bg-cyan-950/80"
                            onMouseDown={() => {
                              setCreateManager("");
                              setIsManagerDropdownOpen(false);
                            }}
                          >
                            Seleccionar encargado
                          </button>
                          {paymentEmployeeOptions.map((name) => (
                            <button
                              key={name}
                              type="button"
                              className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                                createManager === name
                                  ? "bg-cyan-500/20 text-cyan-50"
                                  : "text-[var(--foreground)]"
                              }`}
                              onMouseDown={() => {
                                setCreateManager(name);
                                setIsManagerDropdownOpen(false);
                              }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
                  Totales
                </div>
                <div className="text-[11px] text-cyan-100/50">
                  {invoiceDrafts.length > 1
                    ? "Resumen de facturas"
                    : "Resumen de factura"}
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-xs">
                {invoiceDrafts.map((invoice, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-cyan-100/70">
                      Factura #{index + 1}
                    </span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {formatAmount(invoice.amount)}
                    </span>
                  </div>
                ))}
                <div className="h-px bg-cyan-700/25" />
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[var(--foreground)]">
                    Total a guardar
                  </span>
                  <span className="font-semibold text-cyan-100">
                    {formatAmount(String(totalAmount))}
                  </span>
                </div>
              </div>
            </section>

            <div className="sticky bottom-0 -mx-3 flex justify-center gap-2 border-t border-cyan-700/25 bg-[#0d1117]/95 px-3 py-3 backdrop-blur sm:-mx-0 sm:px-0">
              <button
                type="button"
                onClick={onClose}
                disabled={createSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-150 hover:border-cyan-500/45 hover:bg-cyan-950/25 active:scale-[0.99] disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" strokeWidth={1.5} />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createSubmitting}
                className="inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded border border-cyan-400/45 bg-cyan-500/20 px-5 text-sm font-semibold text-cyan-50 shadow-sm shadow-cyan-950/20 transition-all duration-150 hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-cyan-500/30 hover:shadow-md hover:shadow-cyan-950/30 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-[var(--input-border)] disabled:bg-cyan-950/15 disabled:text-[var(--muted-foreground)] disabled:opacity-60"
              >
                {createSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" strokeWidth={1.5} />
                    {invoiceDrafts.length > 1
                      ? "Guardar facturas"
                      : "Guardar FC/NC"}
                  </>
                )}
              </button>
            </div>

          </form>
        </Box>
      </Box>
    </Drawer>
      {createPortal(
        <ConfirmModal
          open={showConfirmModal}
          title="Confirmar guardado"
          message={
            <>
              ¿Estás seguro de que deseas guardar{" "}
              {invoiceDrafts.length > 1 ? "estas facturas" : "esta FC/NC"}?
              <div className="mt-3 space-y-1 rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Proveedor:</span>
                  <span className="font-medium text-[var(--foreground)]">{providerName}</span>
                </div>
                {invoiceDrafts.map((invoice, index) => (
                  <div key={index} className="flex justify-between gap-4">
                    <span className="text-[var(--muted-foreground)]">
                      Factura #{index + 1}: {invoice.invoiceNumber || "—"}
                    </span>
                    <span className="font-medium text-[var(--foreground)]">
                      {formatAmount(invoice.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-[var(--input-border)] pt-1">
                  <span className="font-medium text-[var(--muted-foreground)]">
                    Total:
                  </span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {formatAmount(String(totalAmount))}
                  </span>
                </div>
              </div>
            </>
          }
          confirmText={
            invoiceDrafts.length > 1 ? "Guardar facturas" : "Guardar FC/NC"
          }
          cancelText="Cancelar"
          actionType="assign"
          loading={createSubmitting}
          onConfirm={() => {
            setShowConfirmModal(false);
            void onSubmit();
          }}
          onCancel={() => setShowConfirmModal(false)}
        />,
        document.body,
      )}
    </>
  );
}
