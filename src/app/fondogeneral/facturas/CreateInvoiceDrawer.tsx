"use client";

import React from "react";
import { Loader2, Plus, Search, X, XCircle } from "lucide-react";
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

  // Update symbol when currency changes (if there's already a value)
  React.useEffect(() => {
    if (!createAmount) return;
    const symbol = createCurrency === "CRC" ? "₡" : "$";
    setDisplayAmount(symbol + Number(createAmount).toLocaleString("es-CR"));
  }, [createCurrency]);

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
            justifyContent: "space-between",
            px: 3,
            py: 2,
          }}
        >
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            Agregar FC/NC
          </Typography>
          <IconButton
            aria-label="Cerrar"
            onClick={onClose}
            sx={{ color: "var(--foreground)" }}
          >
            <X className="w-4 h-4" />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: "var(--input-border)" }} />

        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Empresa asignada:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {currentCompanyLabel}
            </span>
          </p>

          {createFormError && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {createFormError}
            </div>
          )}

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit();
            }}
          >
            <div className="relative group">
              <label className="mb-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={createOnlyInventoryProviders}
                  onChange={(event) =>
                    setCreateOnlyInventoryProviders(event.target.checked)
                  }
                  disabled={createSubmitting}
                  className="h-4 w-4 rounded border-[var(--input-border)] bg-[var(--card-bg)] text-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                />
                <span>Solo compra inventario</span>
              </label>

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
                    className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-red-400 transition-colors hover:text-red-300"
                  >
                    <XCircle className="h-4 w-4" />
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
                  className={`w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${
                    createProviderCode ? "pl-10 pr-11" : "px-3 pr-11"
                  }`}
                />

                <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-cyan-100/80">
                  {providersLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
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

            <input
              value={createInvoiceNumber}
              onChange={(event) =>
                setCreateInvoiceNumber(
                  event.target.value.replace(/\D/g, "").slice(0, 4),
                )
              }
              placeholder="Numero de factura"
              disabled={createSubmitting}
              maxLength={4}
              inputMode="numeric"
              className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            />

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
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
                          ? "border-cyan-300/45 bg-cyan-500/25 text-cyan-50"
                          : "border-cyan-700/35 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-500/45"
                      } ${createSubmitting ? "cursor-not-allowed opacity-60" : "active:scale-[0.99]"}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateCurrency("CRC")}
                disabled={createSubmitting}
                className={`h-10 rounded border px-3 text-sm font-semibold transition-all duration-150 ${
                  createCurrency === "CRC"
                    ? "border-cyan-300/45 bg-cyan-500/25 text-cyan-50"
                    : "border-cyan-700/35 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-500/45"
                } ${createSubmitting ? "cursor-not-allowed opacity-60" : "active:scale-[0.99]"}`}
              >
                Colones (CRC)
              </button>
              <button
                type="button"
                onClick={() => setCreateCurrency("USD")}
                disabled={createSubmitting}
                className={`h-10 rounded border px-3 text-sm font-semibold transition-all duration-150 ${
                  createCurrency === "USD"
                    ? "border-cyan-300/45 bg-cyan-500/25 text-cyan-50"
                    : "border-cyan-700/35 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-500/45"
                } ${createSubmitting ? "cursor-not-allowed opacity-60" : "active:scale-[0.99]"}`}
              >
                Dolares (USD)
              </button>
            </div>

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
              className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            />

            <select
              value={createManager}
              onChange={(event) => setCreateManager(event.target.value)}
              disabled={createSubmitting || employeesLoading}
              className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              <option value="">Seleccione un encargado</option>
              {paymentEmployeeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <textarea
              rows={4}
              value={createNotes}
              onChange={(event) => setCreateNotes(event.target.value)}
              placeholder="Observacion"
              disabled={createSubmitting}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            />

            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20"
                disabled={createSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {createSubmitting ? "Guardando..." : "Guardar FC/NC"}
              </button>
            </div>
          </form>
        </Box>
      </Box>
    </Drawer>
  );
}
