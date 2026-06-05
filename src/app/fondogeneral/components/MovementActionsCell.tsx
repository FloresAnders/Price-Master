import { Info, Pencil, Trash2 } from "lucide-react";
import type { FondoEntry } from "../types";

type MovementActionsCellProps = {
  entry: FondoEntry;
  isLockedMovement: boolean;
  isPaidFcrEntry: boolean;
  hasAppliedCreditNotes: boolean;
  isAppliedCreditNotesExpanded: boolean;
  isFcrInfoExpanded: boolean;
  isAutoAdjustment: boolean;
  isPrincipalAdmin: boolean;
  isSuperAdminUser: boolean;
  latestCierreFondoVentasMovementId?: string | null;
  editingEntryId: string | null;
  isCierreFondoVentasMovement: (entry: FondoEntry) => boolean;
  onEdit: (entry: FondoEntry) => void;
  onDelete: (entry: FondoEntry) => void;
  onToggleFcrInfo: (entryId: string) => void;
  onToggleAppliedCreditNotes: (entryId: string) => void;
};

export function MovementActionsCell({
  entry,
  isLockedMovement,
  isPaidFcrEntry,
  hasAppliedCreditNotes,
  isAppliedCreditNotesExpanded,
  isFcrInfoExpanded,
  isAutoAdjustment,
  isPrincipalAdmin,
  isSuperAdminUser,
  latestCierreFondoVentasMovementId,
  editingEntryId,
  isCierreFondoVentasMovement,
  onEdit,
  onDelete,
  onToggleFcrInfo,
  onToggleAppliedCreditNotes,
}: MovementActionsCellProps) {
  const isCierreVentasRow = isCierreFondoVentasMovement(entry);
  const isLatestCierreVentas =
    isCierreVentasRow &&
    Boolean(latestCierreFondoVentasMovementId) &&
    entry.id === latestCierreFondoVentasMovementId;
  const canDelete =
    !isLockedMovement &&
    !isAutoAdjustment &&
    (isPrincipalAdmin || isSuperAdminUser) &&
    (!isCierreVentasRow || isLatestCierreVentas);
  const canEdit =
    !isLockedMovement &&
    !isAutoAdjustment &&
    (!isSuperAdminUser || !isCierreVentasRow);

  return (
    <td className="px-3 py-2 align-top">
      {(!isLockedMovement || isPaidFcrEntry) && (
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--muted)] disabled:translate-y-0 disabled:opacity-50"
              onClick={() => onEdit(entry)}
              disabled={editingEntryId === entry.id}
              title={
                isAutoAdjustment
                  ? "Los ajustes automáticos no se pueden editar"
                  : "Editar movimiento"
              }
            >
              <Pencil className="w-4 h-4" />
              {editingEntryId === entry.id ? "Editando" : "Editar"}
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-all duration-150 hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-500/20"
              onClick={() => onDelete(entry)}
              title={
                isCierreVentasRow && isSuperAdminUser
                  ? 'Eliminar "CIERRE FONDO VENTAS" (superadmin)'
                  : isCierreVentasRow
                    ? "Eliminar último cierre de Fondo Ventas"
                    : "Eliminar movimiento"
              }
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          )}

          {isPaidFcrEntry && (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-400 transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/20"
              onClick={() => onToggleFcrInfo(entry.id)}
              title="Ver información de pago FCR"
              aria-label="Ver información de pago FCR"
              aria-expanded={isFcrInfoExpanded}
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          {hasAppliedCreditNotes && !isPaidFcrEntry && (
            <button
              type="button"
              className={`inline-flex items-center justify-center rounded border border-sky-500/40 p-1.5 text-sky-300 transition-all duration-150 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-500/20 ${
                isAppliedCreditNotesExpanded
                  ? "bg-sky-500/20"
                  : "bg-sky-500/10"
              }`}
              onClick={() => onToggleAppliedCreditNotes(entry.id)}
              title="Ver notas de crédito aplicadas"
              aria-label="Ver notas de crédito aplicadas"
              aria-expanded={isAppliedCreditNotesExpanded}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </td>
  );
}
