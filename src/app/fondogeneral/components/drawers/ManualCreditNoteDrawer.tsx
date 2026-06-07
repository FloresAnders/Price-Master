"use client";

import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { X } from "lucide-react";
import type { FondoEntry } from "../../types";

type ManualCreditNoteDrawerProps = {
  open: boolean;
  error: string;
  target: FondoEntry | null;
  invoiceNumber: string;
  amount: string;
  observation: string;
  saving: boolean;
  providersMap: Map<string, string>;
  formatByCurrency: (currency: "CRC" | "USD", amount: number) => string;
  onClose: () => void;
  onInvoiceNumberChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onObservationChange: (value: string) => void;
  onSubmit: () => void;
};

export function ManualCreditNoteDrawer({
  open,
  error,
  target,
  invoiceNumber,
  amount,
  observation,
  saving,
  providersMap,
  formatByCurrency,
  onClose,
  onInvoiceNumberChange,
  onAmountChange,
  onObservationChange,
  onSubmit,
}: ManualCreditNoteDrawerProps) {
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
            Agregar nota de Crédito
          </Typography>
          <IconButton
            aria-label="Cerrar"
            onClick={onClose}
            sx={{ color: "var(--foreground)" }}
            disabled={saving}
          >
            <X className="w-4 h-4" />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: "var(--input-border)" }} />

        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {target && (
            <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-sm text-[var(--foreground)]">
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-[var(--muted-foreground)]">
                    Proveedor:
                  </span>{" "}
                  <span className="font-medium">
                    {providersMap.get(target.providerCode) || target.providerCode}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)]">
                    Encargado:
                  </span>{" "}
                  <span className="font-medium">{target.manager || "-"}</span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)]">
                    Factura origen:
                  </span>{" "}
                  <span className="font-medium">#{target.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)]">
                    Moneda:
                  </span>{" "}
                  <span className="font-medium">{target.currency || "CRC"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[var(--muted-foreground)]">
                    Saldo disponible:
                  </span>{" "}
                  <span className="font-semibold text-sky-100">
                    {formatByCurrency(
                      (target.currency as "CRC" | "USD") || "CRC",
                      Math.max(
                        0,
                        Math.trunc(
                          Number(target.amountEgreso || target.amountIngreso || 0) ||
                            0,
                        ),
                      ),
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <input
              value={invoiceNumber}
              onChange={(event) =>
                onInvoiceNumberChange(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="Numero de factura de la NC"
              disabled={saving}
              maxLength={4}
              inputMode="numeric"
              className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            />

            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(event) =>
                onAmountChange(event.target.value.replace(/\D/g, ""))
              }
              placeholder="Monto"
              disabled={saving}
              className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            />

            <textarea
              value={observation}
              onChange={(event) => onObservationChange(event.target.value)}
              placeholder="Observacion"
              disabled={saving}
              rows={4}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/25 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-sky-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar NC"}
              </button>
            </div>
          </form>
        </Box>
      </Box>
    </Drawer>
  );
}
