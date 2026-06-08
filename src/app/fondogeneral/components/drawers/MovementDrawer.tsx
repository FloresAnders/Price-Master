"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { Lock, LockOpen, X } from "lucide-react";

import AgregarMovimiento from "../AgregarMovimiento";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { FondoEntry } from "../../types";

type MovementDrawerProps = ComponentProps<typeof AgregarMovimiento> & {
  open: boolean;
  onClose: () => void;
  editingEntry: FondoEntry | null;
  movementAutoCloseLocked: boolean;
  onToggleMovementAutoCloseLocked: () => void;
};

export function MovementDrawer({
  open,
  onClose,
  editingEntry,
  movementAutoCloseLocked,
  onToggleMovementAutoCloseLocked,
  ...agregarMovimientoProps
}: MovementDrawerProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const {
    onSubmit,
    isSaving,
    selectedProvider,
    providers,
    invoiceNumber,
    isEgreso,
    egreso,
    ingreso,
    currency,
  } = agregarMovimientoProps;
  const providerName = useMemo(() => {
    if (!selectedProvider) return "—";
    const p = providers?.find((p) => p.code === selectedProvider);
    return p?.name || selectedProvider;
  }, [selectedProvider, providers]);
  const amountStr = (isEgreso ? egreso : ingreso) || "0";
  const formattedAmount =
    currency === "USD"
      ? `$${Number(amountStr).toLocaleString("en-US")}`
      : `₡${Number(amountStr).toLocaleString("es-CR")}`;
  const handleSaveClick = () => setShowConfirmModal(true);
  const handleConfirmSave = () => {
    setShowConfirmModal(false);
    onSubmit?.();
  };
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100vw", sm: 520 },
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
            sx={{ fontWeight: 600, textAlign: "center", width: "100%" }}
          >
            {editingEntry
              ? `Editar movimiento #${editingEntry.invoiceNumber}`
              : "Registrar movimiento"}
          </Typography>
          <Box
            sx={{
              position: "absolute",
              right: 12,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <IconButton
              aria-label={
                movementAutoCloseLocked
                  ? "Desbloquear cierre automatico"
                  : "Bloquear cierre automatico"
              }
              onClick={onToggleMovementAutoCloseLocked}
              sx={{ color: "var(--foreground)" }}
            >
              {movementAutoCloseLocked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <LockOpen className="w-4 h-4" />
              )}
            </IconButton>
            <IconButton
              aria-label="Cerrar registro de movimiento"
              onClick={onClose}
              sx={{ color: "var(--foreground)" }}
            >
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
        </Box>
        <Divider sx={{ borderColor: "var(--input-border)" }} />
        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
          {editingEntry && (
            <Typography
              variant="caption"
              component="p"
              sx={{ color: "var(--muted-foreground)", mb: 2 }}
            >
              Editando movimiento #{editingEntry.invoiceNumber}. Actualiza los
              datos y presiona &quot;Actualizar&quot; o cancela para volver al
              modo de registro.
            </Typography>
          )}
          <AgregarMovimiento {...agregarMovimientoProps} onSubmit={handleSaveClick} />
        </Box>
      </Box>
      {createPortal(
        <ConfirmModal
          open={showConfirmModal}
          title="Confirmar guardado"
          message={
            <>
              ¿Estás seguro de que deseas guardar este movimiento?
              <div className="mt-3 space-y-1 rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Proveedor:</span>
                  <span className="font-medium text-[var(--foreground)]">{providerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">N° Factura:</span>
                  <span className="font-medium text-[var(--foreground)]">{invoiceNumber || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Monto:</span>
                  <span className="font-medium text-[var(--foreground)]">{formattedAmount}</span>
                </div>
              </div>
            </>
          }
          confirmText="Guardar"
          cancelText="Cancelar"
          actionType="assign"
          loading={isSaving}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirmModal(false)}
        />,
        document.body,
      )}
    </Drawer>
  );
}
