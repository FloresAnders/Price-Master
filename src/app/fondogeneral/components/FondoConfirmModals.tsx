"use client";

import ConfirmModal from "../../../components/ui/ConfirmModal";
import { AlertCircle, CheckCircle2, X, XCircle } from "lucide-react";

type ConfirmDeleteEntry = {
  open: boolean;
  entry?: {
    invoiceNumber?: string | null;
  } | null;
};

type FondoConfirmModalsProps = {
  confirmPhysicalCountOpen: boolean;
  handleCancelPhysicalCount: () => void;
  handleOpenCashOpening: () => void;
  pendingCierreModalOpen: boolean;
  closePendingCierreModal: () => void;
  confirmDeleteEntry: ConfirmDeleteEntry;
  confirmDeleteMovement: () => void;
  cancelDeleteMovement: () => void;
};

export function FondoConfirmModals({
  confirmPhysicalCountOpen,
  handleCancelPhysicalCount,
  handleOpenCashOpening,
  pendingCierreModalOpen,
  closePendingCierreModal,
  confirmDeleteEntry,
  confirmDeleteMovement,
  cancelDeleteMovement,
}: FondoConfirmModalsProps) {
  return (
    <>
      {confirmPhysicalCountOpen ? (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 px-3"
          onClick={handleCancelPhysicalCount}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-physical-title"
            className="relative w-full max-w-xl rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-[var(--foreground)] shadow-2xl shadow-black/40 sm:p-6 flex items-center justify-center min-h-screen md:min-h-0"
            onClick={(event) => event.stopPropagation()}
            onKeyDownCapture={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              handleCancelPhysicalCount();
            }}
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={handleCancelPhysicalCount}
              aria-label="Cerrar modal"
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted-foreground)] transition-colors hover:border-red-500/50 hover:text-red-600"
              title="Cerrar modal"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center justify-center text-center space-y-3">
              {/* Icono de alerta - tono amigable */}
              <AlertCircle className="mx-auto h-12 w-12 rounded-full bg-orange-50 p-3 text-orange-600" />

              <h3 id="confirm-physical-title" className="text-xl font-semibold leading-tight">
                Confirmar conteo físico
              </h3>

              {/* Texto centrado */}
              <p className="max-w-[75%] px-4 text-sm text-[var(--muted-foreground)] leading-relaxed">
                Antes de registrar el primer movimiento después del último cierre, confirma que el fondo fue contado físicamente.
              </p>

              {/* Espaciado adicional entre texto y botón */}
              <div className="flex items-center justify-center gap-3 mt-4" />

              {/* Botón centrado con icono - tono amigable */}
              <div className="flex items-center justify-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleOpenCashOpening}
                  className="inline-flex h-11 w-full max-w-[120%] min-w-[160px] items-center justify-center rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-600 to-yellow-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 active:scale-[0.98]"
                  title="Proceder con apertura de fondo"
                >
                  <CheckCircle2 className="mr-3 h-4 w-4 flex-shrink-0" />
                  Apertura de fondo
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={pendingCierreModalOpen}
        title="Cierre pendiente"
        message={
          "Existe un cierre pendiente. No se pueden procesar pagos hasta que el cierre sea confirmado o eliminado desde el historial de cierres."
        }
        singleButton
        singleButtonText="Entendido"
        onCancel={closePendingCierreModal}
        onConfirm={() => {}}
      />

      <ConfirmModal
        open={confirmDeleteEntry.open}
        title="Eliminar movimiento"
        message={`¿Está seguro que desea eliminar el movimiento #${confirmDeleteEntry.entry?.invoiceNumber || ""}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={confirmDeleteMovement}
        onCancel={cancelDeleteMovement}
        actionType="delete"
      />
    </>
  );
}
