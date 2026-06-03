"use client";

import type { Dispatch, SetStateAction } from "react";
import ConfirmModal from "../../../components/ui/ConfirmModal";

type ConfirmDeleteEntry = {
  open: boolean;
  entry?: {
    invoiceNumber?: string | null;
  } | null;
};

type FondoConfirmModalsProps = {
  confirmPhysicalCountOpen: boolean;
  physicalCountWasDone: boolean;
  setPhysicalCountWasDone: Dispatch<SetStateAction<boolean>>;
  handleConfirmPhysicalCount: () => void;
  handleCancelPhysicalCount: () => void;
  pendingCierreModalOpen: boolean;
  closePendingCierreModal: () => void;
  confirmDeleteEntry: ConfirmDeleteEntry;
  confirmDeleteMovement: () => void;
  cancelDeleteMovement: () => void;
};

export function FondoConfirmModals({
  confirmPhysicalCountOpen,
  physicalCountWasDone,
  setPhysicalCountWasDone,
  handleConfirmPhysicalCount,
  handleCancelPhysicalCount,
  pendingCierreModalOpen,
  closePendingCierreModal,
  confirmDeleteEntry,
  confirmDeleteMovement,
  cancelDeleteMovement,
}: FondoConfirmModalsProps) {
  return (
    <>
      <ConfirmModal
        open={confirmPhysicalCountOpen}
        title="Confirmar conteo físico"
        message={
          <div className="text-left space-y-3">
            <div className="text-sm text-[var(--muted-foreground)]">
              Antes de registrar el primer movimiento después del último cierre,
              confirma que el fondo fue contado físicamente.
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 cursor-pointer"
                checked={physicalCountWasDone}
                onChange={(e) => setPhysicalCountWasDone(e.target.checked)}
                aria-label="Confirmar que el fondo fue contado físicamente"
              />
              <span className="text-sm">
                Sí, el fondo fue contado físicamente
              </span>
            </label>
          </div>
        }
        confirmText="Continuar"
        cancelText="Cancelar"
        actionType="change"
        confirmDisabled={!physicalCountWasDone}
        onConfirm={handleConfirmPhysicalCount}
        onCancel={handleCancelPhysicalCount}
      />

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
