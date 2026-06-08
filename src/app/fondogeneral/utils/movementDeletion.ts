import { getDoc, type WriteBatch } from "firebase/firestore";
import { FacturasService, type FacturaMovement } from "../../../services/facturas";
import {
  APERTURA_FONDO_PROVIDER_CODE,
  CIERRE_FONDO_VENTAS_PROVIDER_NAME,
} from "../constants";
import type { FondoEntry } from "../types";
import {
  forceClearClosingGuards,
} from "./closing/closingGuards";
import {
  getFcrPaymentAmount,
  getFcrPaymentInvoiceId,
  isAutoAdjustmentProvider,
  isPaidFcrMovement,
  stripUndefinedDeep,
} from "../utils/helpers";

type LedgerSnapshot = {
  initialCRC: number;
  currentCRC: number;
  initialUSD: number;
  currentUSD: number;
};

type ToastType = "success" | "error" | "warning" | "info";

type MovementSnapshotRef = {
  current: { state?: { lockedUntil?: string } | null } | null;
};

type DeleteEntryState = {
  open: boolean;
  entry: FondoEntry | null;
};

type PersistMovementToFirestore = (
  updatedEntries: FondoEntry[],
  operationType: "create" | "edit" | "delete",
  change?: {
    upsert?: FondoEntry;
    deleteId?: string;
    before?: FondoEntry | null;
  },
  extraWrites?: (batch: WriteBatch) => void,
) => Promise<{
  ok: boolean;
  confirmed: boolean;
  ledgerSnapshot?: LedgerSnapshot;
}>;

export interface MovementDeletionDeps {
  accountKey: string;
  company: string;
  providers: Array<{ code: string; name?: string | null }>;
  cierreFondoVentasProviderCode: string | null;
  latestCierreFondoVentasMovementId: string | null;
  isPrincipalAdmin: boolean;
  isSuperAdminUser: boolean;
  isSaving?: boolean;
  showToast: (message: string, type: ToastType, durationMs?: number) => void;
  setConfirmDeleteEntry: (value: DeleteEntryState) => void;
  confirmDeleteEntry?: DeleteEntryState;
  setIsSaving?: (value: boolean) => void;
  fondoEntries?: FondoEntry[];
  setFondoEntries?: (value: FondoEntry[]) => void;
  setLedgerSnapshot?: (value: LedgerSnapshot) => void;
  persistMovementToFirestore?: PersistMovementToFirestore;
  user?: { email?: string | null; id?: string | null } | null;
  storageSnapshotRef: MovementSnapshotRef;
  lastDailyClosingSavedAtRef?: { current: number };
  lastMovementCreatedAtRef?: { current: number };
  lastMovementDedupeRef?: { current: { at: number; fingerprint: string } | null };
}

export function isMovementLocked(
  entry: FondoEntry,
  deps: Pick<MovementDeletionDeps, "accountKey" | "storageSnapshotRef">,
): boolean {
  if (isAutoAdjustmentProvider(entry.providerCode)) {
    return true;
  }

  if (deps.accountKey !== "FondoGeneral") {
    return false;
  }

  const lockedUntil = deps.storageSnapshotRef.current?.state?.lockedUntil;
  if (!lockedUntil) {
    return false;
  }

  try {
    const movementTime = new Date(entry.createdAt).getTime();
    const lockTime = new Date(lockedUntil).getTime();
    return movementTime <= lockTime;
  } catch {
    return false;
  }
}

export function isCierreFondoVentasMovement(
  entry: FondoEntry,
  deps: Pick<
    MovementDeletionDeps,
    "providers" | "cierreFondoVentasProviderCode"
  >,
): boolean {
  try {
    if (deps.cierreFondoVentasProviderCode) {
      return entry.providerCode === deps.cierreFondoVentasProviderCode;
    }
    const providerName = deps.providers
      .find((p) => p.code === entry.providerCode)
      ?.name?.toUpperCase();
    return providerName === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
  } catch {
    return false;
  }
}

export async function handleDeleteMovement(
  entry: FondoEntry,
  deps: MovementDeletionDeps,
): Promise<void> {
  if (isCierreFondoVentasMovement(entry, deps)) {
    if (
      !deps.latestCierreFondoVentasMovementId ||
      entry.id !== deps.latestCierreFondoVentasMovementId
    ) {
      deps.showToast(
        "Solo se permite eliminar el último cierre de Fondo Ventas.",
        "warning",
        6000,
      );
      return;
    }
  }

  if (!deps.isPrincipalAdmin && !deps.isSuperAdminUser) {
    deps.showToast(
      "Solo un admin duenio o un superadmin puede eliminar movimientos",
      "error",
    );
    return;
  }

  if (isMovementLocked(entry, deps)) {
    deps.showToast(
      "Este movimiento está bloqueado (anterior al último cierre) y no puede eliminarse.",
      "error",
    );
    return;
  }

  if (isAutoAdjustmentProvider(entry.providerCode)) {
    deps.showToast("Los ajustes automáticos no se pueden eliminar.", "error");
    return;
  }

  deps.setConfirmDeleteEntry({ open: true, entry });
}

export async function confirmDeleteMovement(
  deps: MovementDeletionDeps,
): Promise<void> {
  const entry = deps.confirmDeleteEntry?.entry;
  if (!entry) return;

  if (deps.isSaving) return;
  deps.setIsSaving?.(true);

  try {
    if (isCierreFondoVentasMovement(entry, deps)) {
      if (
        !deps.latestCierreFondoVentasMovementId ||
        entry.id !== deps.latestCierreFondoVentasMovementId
      ) {
        deps.showToast(
          "Solo se permite eliminar el último cierre de Fondo Ventas.",
          "warning",
          6000,
        );
        deps.setConfirmDeleteEntry({ open: false, entry: null });
        return;
      }
    }

    if (!deps.isPrincipalAdmin && !deps.isSuperAdminUser) {
      deps.showToast("No autorizado para eliminar este movimiento", "error", 5000);
      deps.setConfirmDeleteEntry({ open: false, entry: null });
      return;
    }

    const normalizedCompany = String(deps.company || "").trim();
    let facturaRollbackWrites: ((batch: WriteBatch) => void) | undefined;

    if (normalizedCompany.length > 0 && isPaidFcrMovement(entry)) {
      const invoiceId = getFcrPaymentInvoiceId(entry);
      if (invoiceId) {
        const invoiceRef = FacturasService.buildMovementRef(normalizedCompany, invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        if (!invoiceSnap.exists()) {
          deps.showToast(
            "No se encontró la factura asociada al pago eliminado.",
            "error",
            5000,
          );
          return;
        }

        const invoiceData = invoiceSnap.data() as FacturaMovement;
        const rollbackAt = new Date().toISOString();
        const paymentAmount = getFcrPaymentAmount(entry);
        const totalAmount = Math.max(
          0,
          Math.trunc(Number(invoiceData.originalAmount ?? invoiceData.amount) || 0),
        );
        const currentPaid = Math.max(0, Math.trunc(Number(invoiceData.paidAmount) || 0));
        const nextPaid = Math.max(0, Math.min(totalAmount, currentPaid - paymentAmount));
        const nextBalance = Math.max(0, totalAmount - nextPaid);
        const nextStatus =
          nextBalance === 0 ? "PAGADA" : nextPaid > 0 ? "PARCIAL" : "PENDIENTE";

        const appliedCreditNotes = Array.isArray(entry.appliedCreditNotes)
          ? entry.appliedCreditNotes
          : [];

        const noteWrites = await Promise.all(
          appliedCreditNotes.map(async (note) => {
            const noteId = String(note?.id || "").trim();
            const appliedAmount = Math.max(0, Math.trunc(Number(note?.appliedAmount) || 0));
            if (!noteId || appliedAmount <= 0) return null;

            const noteRef = FacturasService.buildMovementRef(normalizedCompany, noteId);
            const noteSnap = await getDoc(noteRef);
            if (!noteSnap.exists()) return null;

            const noteData = noteSnap.data() as FacturaMovement;
            const noteTotal = Math.max(
              0,
              Math.trunc(Number(noteData.originalAmount ?? noteData.amount) || 0),
            );
            const currentNotePaid = Math.max(0, Math.trunc(Number(noteData.paidAmount) || 0));
            const nextNotePaid = Math.max(
              0,
              Math.min(noteTotal, currentNotePaid - appliedAmount),
            );
            const nextNoteBalance = Math.max(0, noteTotal - nextNotePaid);
            const nextNoteStatus =
              nextNotePaid <= 0
                ? "PENDIENTE"
                : nextNoteBalance === 0
                  ? "REBAJADA"
                  : "PARCIAL";

            return {
              noteRef,
              payload: {
                ...noteData,
                id: noteId,
                empresa: normalizedCompany,
                paidAmount: nextNotePaid,
                balanceDue: nextNoteBalance,
                amountDue: nextNoteBalance,
                paymentStatus: nextNoteStatus,
                updateAt: rollbackAt,
              } as FacturaMovement,
            };
          }),
        );

        facturaRollbackWrites = (batch) => {
          batch.set(
            invoiceRef,
            stripUndefinedDeep({
              ...invoiceData,
              id: invoiceId,
              empresa: normalizedCompany,
              paidAmount: nextPaid,
              balanceDue: nextBalance,
              amountDue: nextBalance,
              paymentStatus: nextStatus,
              updateAt: rollbackAt,
            }),
            { merge: true },
          );

          noteWrites.forEach((noteWrite) => {
            if (!noteWrite) return;
            batch.set(noteWrite.noteRef, stripUndefinedDeep(noteWrite.payload), {
              merge: true,
            });
          });
        };
      }
    }

    const updatedEntries = (deps.fondoEntries || []).filter((e) => e.id !== entry.id);
    const saved = await deps.persistMovementToFirestore?.(
      updatedEntries,
      "delete",
      {
        deleteId: entry.id,
        before: entry,
      },
      facturaRollbackWrites,
    );

    if (!saved?.ok) {
      deps.showToast(
        "Error al eliminar el movimiento. Por favor, intente de nuevo.",
        "error",
        5000,
      );
      return;
    }

    try {
      const providerName = deps.providers
        .find((p) => p.code === entry.providerCode)
        ?.name?.toUpperCase();
      const isCierreVentas = providerName === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
      const isCashOpening =
        entry.providerCode === APERTURA_FONDO_PROVIDER_CODE ||
        providerName === APERTURA_FONDO_PROVIDER_CODE;
      if (normalizedCompany.length > 0 && isCierreVentas) {
        await forceClearClosingGuards(
          normalizedCompany,
          "delete_cierre_fondo_ventas",
          deps.user ?? null,
        );

        if (deps.lastDailyClosingSavedAtRef) deps.lastDailyClosingSavedAtRef.current = 0;
        if (deps.lastMovementCreatedAtRef) deps.lastMovementCreatedAtRef.current = 0;
        if (deps.lastMovementDedupeRef) deps.lastMovementDedupeRef.current = null;
        if (typeof window !== "undefined") {
          const dailyKey = `fondogeneral-lastDailyClosingSavedAt:${normalizedCompany}`;
          const createdKey = `fondogeneral-lastMovementCreatedAt:${normalizedCompany}:${deps.accountKey}`;
          const dedupeKey = `fondogeneral-lastMovementDedupe:${normalizedCompany}:${deps.accountKey}`;
          localStorage.removeItem(dailyKey);
          localStorage.removeItem(createdKey);
          localStorage.removeItem(dedupeKey);
        }
      }
    } catch {
      // ignore
    }

    deps.setFondoEntries?.(updatedEntries);
    if (saved.ledgerSnapshot) {
      deps.setLedgerSnapshot?.(saved.ledgerSnapshot);
    }

    deps.setConfirmDeleteEntry({ open: false, entry: null });

    if (saved.confirmed) {
      deps.showToast("Movimiento eliminado exitosamente", "success");
    } else {
      deps.showToast(
        "Eliminación guardada localmente; pendiente de sincronización (revisa tu conexión).",
        "warning",
        6000,
      );
    }
  } finally {
    deps.setIsSaving?.(false);
  }
}

export async function cancelDeleteMovement(
  deps: Pick<MovementDeletionDeps, "setConfirmDeleteEntry">,
): Promise<void> {
  deps.setConfirmDeleteEntry({ open: false, entry: null });
}
