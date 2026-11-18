import { Info, Pencil, Trash2 } from "lucide-react";
import type { FondoEntry } from "../types";
import styles from "./MovementActionsCell.module.css";

type MovementActionsCellProps = {
  variant?: "table" | "mobile";
  entry: FondoEntry;
  isCashOpeningMovement: boolean;
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
  variant = "table",
  entry,
  isCashOpeningMovement,
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
  const canManageCashOpeningMovement =
    !isCashOpeningMovement || isPrincipalAdmin || isSuperAdminUser;
  const canDelete =
    !isLockedMovement &&
    !isAutoAdjustment &&
    canManageCashOpeningMovement &&
    (isPrincipalAdmin || isSuperAdminUser) &&
    (!isCierreVentasRow || isLatestCierreVentas);
  const canEdit =
    !isLockedMovement &&
    !isAutoAdjustment &&
    canManageCashOpeningMovement &&
    (!isSuperAdminUser || !isCierreVentasRow);
  const hasVisibleActions =
    (!isLockedMovement || isPaidFcrEntry) &&
    (canEdit ||
      canDelete ||
      isPaidFcrEntry ||
      (hasAppliedCreditNotes && !isPaidFcrEntry));

  const content = (
    <>
      {(!isLockedMovement || isPaidFcrEntry) && (
        <div
          className={
            variant === "mobile"
              ? styles.mobileGrid
              : "flex items-center gap-2"
          }
        >
          {canEdit && (
            <button
              type="button"
              className={
                variant === "mobile"
                  ? `${styles.mobileAction} ${styles.editAction}`
                  : "inline-flex items-center justify-center gap-1.5 rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--muted)] disabled:translate-y-0 disabled:opacity-50"
              }
              onClick={() => onEdit(entry)}
              disabled={editingEntryId === entry.id}
              title={
                isAutoAdjustment
                  ? "Los ajustes automáticos no se pueden editar"
                  : "Editar movimiento"
              }
            >
              <Pencil
                className={variant === "mobile" ? styles.mobileIcon : "w-4 h-4"}
                aria-hidden="true"
              />
              {editingEntryId === entry.id ? "Editando" : "Editar"}
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className={
                variant === "mobile"
                  ? `${styles.mobileAction} ${styles.deleteAction}`
                  : "inline-flex items-center justify-center gap-1.5 rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-all duration-150 hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-500/20"
              }
              onClick={() => onDelete(entry)}
              title={
                isCierreVentasRow && isSuperAdminUser
                  ? 'Eliminar "CIERRE FONDO VENTAS" (superadmin)'
                  : isCierreVentasRow
                    ? "Eliminar último cierre de Fondo Ventas"
                    : "Eliminar movimiento"
              }
            >
              <Trash2
                className={variant === "mobile" ? styles.mobileIcon : "w-4 h-4"}
                aria-hidden="true"
              />
              Eliminar
            </button>
          )}

          {isPaidFcrEntry && (
            <button
              type="button"
              className={
                variant === "mobile"
                  ? `${styles.mobileAction} ${styles.infoAction}`
                  : "inline-flex items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-400 transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/20"
              }
              onClick={() => onToggleFcrInfo(entry.id)}
              title="Ver información de pago FCR"
              aria-label="Ver información de pago FCR"
              aria-expanded={isFcrInfoExpanded}
            >
              <Info
                className={variant === "mobile" ? styles.mobileIcon : "w-4 h-4"}
                aria-hidden="true"
              />
            </button>
          )}

          {hasAppliedCreditNotes && !isPaidFcrEntry && (
            <button
              type="button"
              className={
                variant === "mobile"
                  ? `${styles.mobileAction} ${styles.creditAction} ${
                      isAppliedCreditNotesExpanded ? styles.activeAction : ""
                    }`
                  : `inline-flex items-center justify-center rounded border border-sky-500/40 p-1.5 text-sky-300 transition-all duration-150 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-500/20 ${
                      isAppliedCreditNotesExpanded
                        ? "bg-sky-500/20"
                        : "bg-sky-500/10"
                    }`
              }
              onClick={() => onToggleAppliedCreditNotes(entry.id)}
              title="Ver notas de crédito aplicadas"
              aria-label="Ver notas de crédito aplicadas"
              aria-expanded={isAppliedCreditNotesExpanded}
            >
              <Info
                className={
                  variant === "mobile" ? styles.mobileIcon : "w-3.5 h-3.5"
                }
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      )}
    </>
  );

  if (variant === "mobile") {
    if (!hasVisibleActions) return null;

    return (
      <div
        aria-label="Acciones del movimiento"
        className={styles.mobileRoot}
        style={{ gridColumnStart: "1", gridColumnEnd: "span 2" }}
      >
        {content}
      </div>
    );
  }

  return <td className="px-3 py-2 align-top">{content}</td>;
}
