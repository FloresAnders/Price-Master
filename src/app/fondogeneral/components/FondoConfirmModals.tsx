"use client";

import ConfirmModal from "../../../components/ui/ConfirmModal";
import { X } from "lucide-react";

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
            className="relative w-full max-w-xl rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-[var(--foreground)] shadow-2xl shadow-black/40 sm:p-6"
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
              aria-label="Cerrar"
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-4 pr-10">
              <div className="space-y-2 text-center sm:text-left">
                <h3 id="confirm-physical-title" className="text-xl font-semibold">
                  Confirmar conteo físico
                </h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Antes de registrar el primer movimiento después del último cierre,
                  confirma que el fondo fue contado físicamente.
                </p>
              </div>

              <div className="flex justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={handleOpenCashOpening}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
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
