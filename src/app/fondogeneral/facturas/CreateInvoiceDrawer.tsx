"use client";

import React from "react";
import {
  FileText,
  Loader2,
  MessageSquare,
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
  createInvoiceDocType: "FCR" | "NC";
  setCreateInvoiceDocType: (value: "FCR" | "NC") => void;
  createCurrency: MovementCurrencyKey;
  setCreateCurrency: (value: MovementCurrencyKey) => void;
  createAmount: string;
  setCreateAmount: (value: string) => void;
  createManager: string;
  setCreateManager: (value: string) => void;
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
  createInvoiceDocType,
  setCreateInvoiceDocType,
  createCurrency,
  setCreateCurrency,
  createAmount,
  setCreateAmount,
  createManager,
  setCreateManager,
  employeesLoading,
  paymentEmployeeOptions,
  createNotes,
  setCreateNotes,
  formatMovementType,
}: CreateInvoiceDrawerProps) {
  const [displayAmount, setDisplayAmount] = React.useState("");
  const [isManagerDropdownOpen, setIsManagerDropdownOpen] = React.useState(false);

  const formatAmount = React.useCallback(
    (raw: string) => {
      if (!raw || raw.trim().length === 0) return createCurrency === "CRC" ? "₡ 0" : "$ 0";
      const n = Math.trunc(Number(raw) || 0);
      const formatted =
        createCurrency === "CRC"
          ? n.toLocaleString("es-CR")
          : n.toLocaleString("en-US");
      return createCurrency === "CRC" ? `₡ ${formatted}` : `$ ${formatted}`;
    },
    [createCurrency],
  );

  React.useEffect(() => {
    if (!createAmount) {
      setDisplayAmount("");
      return;
    }
    const symbol = createCurrency === "CRC" ? "₡" : "$";
    setDisplayAmount(symbol + Number(createAmount).toLocaleString("es-CR"));
  }, [createCurrency, createAmount]);

  const sectionClass =
    "rounded-xl border border-cyan-700/25 bg-cyan-950/10 p-3 sm:p-4";
  const labelClass =
    "mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-100/70";
  const iconBoxClass =
    "flex h-7 w-7 items-center justify-center rounded border border-cyan-700/35 bg-cyan-900/25 text-cyan-100/80";
  const fieldBase =
    "h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)]";

  return (
    <Drawer
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
              void onSubmit();
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
                        disabled={createSubmitting}
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
                  <label className={labelClass}>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Numero factura
                  </label>
                  <input
                    value={createInvoiceNumber}
                    onChange={(event) =>
                      setCreateInvoiceNumber(
                        event.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    placeholder="0000"
                    disabled={createSubmitting}
                    maxLength={4}
                    inputMode="numeric"
                    className={fieldBase}
                  />
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

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const symbol = createCurrency === "CRC" ? "₡" : "$";
                    setDisplayAmount(
                      raw ? symbol + Number(raw).toLocaleString("es-CR") : "",
                    );
                    setCreateAmount(raw);
                  }}
                  placeholder={createCurrency === "CRC" ? "₡0" : "$0"}
                  disabled={createSubmitting}
                  className={`${fieldBase} text-lg font-semibold`}
                />
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
                        createSubmitting || employeesLoading
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      }`}
                      disabled={createSubmitting || employeesLoading}
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
                      !employeesLoading && (
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
                <div className="text-[11px] text-cyan-100/50">Resumen de factura</div>
              </div>
              <div className="mt-2 grid gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-100/70">
                    Total {createInvoiceDocType === "NC" ? "nota credito" : "factura"}
                  </span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {formatAmount(createAmount)}
                  </span>
                </div>
                <div className="h-px bg-cyan-700/25" />
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[var(--foreground)]">
                    Total a guardar
                  </span>
                  <span className="font-semibold text-cyan-100">
                    {formatAmount(createAmount)}
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
                    Guardar FC/NC
                  </>
                )}
              </button>
            </div>
          </form>
        </Box>
      </Box>
    </Drawer>
  );
}
