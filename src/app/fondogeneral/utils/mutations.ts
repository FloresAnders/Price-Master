import {
  DailyClosingsService,
  type DailyClosingRecord,
} from "../../../services/daily-closings";
import {
  MovimientosFondosService,
  type MovementStorage,
} from "../../../services/movimientos-fondos";
import type { FondoEntry } from "../types";
import {
  isAutoAdjustmentProvider,
  isIngresoDesdeFondoVentasMovement,
  parseLastCreatedCooldown,
  getEffectiveLastCreatedAtMs,
  normalizeInvoiceDocType,
  type LastCreatedCooldownPayload,
} from "./helpers";
import { forceClearClosingGuards } from "./closingGuards";
import { sendMovementNotification } from "./notifications";
import {
  CIERRE_FONDO_VENTAS_PROVIDER_NAME,
} from "../constants";
import type { WriteBatch } from "firebase/firestore";

type LedgerSnapshotShape = {
  initialCRC: number;
  currentCRC: number;
  initialUSD: number;
  currentUSD: number;
};

type PersistMovementToFirestoreFn = (
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
  ledgerSnapshot?: LedgerSnapshotShape;
}>;

type ShowToastFn = (msg: string, type?: "success" | "error" | "info" | "warning", duration?: number) => void;

export async function handleDeleteLatestDailyClosing(
  reason: string,
  deps: {
    isSuperAdminUser: boolean;
    company: string | null;
    accountKey: string;
    user: { id?: string; email?: string; name?: string; role?: string } | null;
    fondoEntries: FondoEntry[];
    setFondoEntries: (entries: FondoEntry[] | ((prev: FondoEntry[]) => FondoEntry[])) => void;
    setLedgerSnapshot: (snapshot: LedgerSnapshotShape | ((prev: LedgerSnapshotShape) => LedgerSnapshotShape)) => void;
    setDailyClosings: (closings: DailyClosingRecord[] | ((prev: DailyClosingRecord[]) => DailyClosingRecord[])) => void;
    setExpandedClosings: (closings: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    setPendingCierreDeCaja: (v: boolean | ((prev: boolean) => boolean)) => void;
    persistMovementToFirestore: PersistMovementToFirestoreFn;
    buildPhysicalCountStorageKey: () => string | null;
    cleanupPhysicalCountLegacyKeys: () => void;
    showToast: ShowToastFn;
    deleteLatestClosingInProgressRef: { current: boolean };
    lastDailyClosingSavedAtRef: { current: number };
    lastMovementCreatedAtRef: { current: number };
    lastMovementDedupeRef: { current: unknown };
    storageSnapshotRef: { current: MovementStorage<FondoEntry> | null };
  },
): Promise<void> {
  if (!deps.isSuperAdminUser) {
    throw new Error("No autorizado");
  }

  const normalizedCompany = (deps.company || "").trim();
  if (!normalizedCompany) {
    throw new Error("No se pudo identificar la empresa");
  }

  if (deps.accountKey !== "FondoGeneral") {
    throw new Error("Esta acción solo aplica al Fondo General");
  }

  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) {
    throw new Error("Debe indicar un motivo");
  }

  if (deps.deleteLatestClosingInProgressRef.current) {
    throw new Error("Ya hay una eliminación en progreso");
  }
  deps.deleteLatestClosingInProgressRef.current = true;

  try {
    const closingsDoc =
      await DailyClosingsService.getDocument(normalizedCompany);
    if (!closingsDoc) {
      throw new Error(
        "No se encontró historial de cierres para esta empresa",
      );
    }

    const sorted = DailyClosingsService.extractAllClosings(closingsDoc);
    const latest = sorted[0];
    if (!latest) {
      throw new Error("No hay cierres para eliminar");
    }
    const latestAfter = sorted[1] ?? null;

    const companyKey =
      MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);

    const related =
      await MovimientosFondosService.listMovementsByOriginalEntryId<FondoEntry>(
        companyKey,
        latest.id,
        { limitCount: 50 },
      );

    const relatedAdjustments = (related || []).filter((m) =>
      isAutoAdjustmentProvider((m as any)?.providerCode),
    );

    const lockedUntilBefore =
      deps.storageSnapshotRef.current?.state?.lockedUntil ?? null;
    const lockedUntilAfter = latestAfter?.createdAt ?? null;

    await DailyClosingsService.deleteLatestClosing(normalizedCompany, {
      expectedClosingId: latest.id,
      reason: trimmedReason,
      deletedBy: {
        uid: (deps.user as any)?.id,
        email: deps.user?.email,
        name: deps.user?.name,
        role: deps.user?.role,
      },
      relatedAdjustments,
      lockedUntilBefore,
      lockedUntilAfter,
    });

    deps.setDailyClosings((prev) => prev.filter((d) => d.id !== latest.id));
    deps.setExpandedClosings((prev) => {
      const next = new Set(prev);
      next.delete(latest.id);
      return next;
    });

    let latestLedgerSnapshot: LedgerSnapshotShape | null = null;

    for (const adj of relatedAdjustments) {
      const before =
        deps.fondoEntries.find((e) => e.id === adj.id) ?? (adj as any);
      const saved = await deps.persistMovementToFirestore(
        deps.fondoEntries,
        "delete",
        {
          deleteId: adj.id,
          before,
        },
      );
      if (!saved.ok) {
        throw new Error(
          "El cierre fue eliminado, pero no se pudo borrar un ajuste al saldo asociado. Revise los movimientos.",
        );
      }
      if (saved.ledgerSnapshot) {
        latestLedgerSnapshot = saved.ledgerSnapshot;
      }
    }

    if (relatedAdjustments.length > 0) {
      const ids = new Set(relatedAdjustments.map((a) => a.id));
      deps.setFondoEntries((prev) => prev.filter((e) => !ids.has(e.id)));
      if (latestLedgerSnapshot) {
        deps.setLedgerSnapshot(latestLedgerSnapshot);
      }
    }

    const baseLedger = deps.storageSnapshotRef.current
      ? MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
          deps.storageSnapshotRef.current,
          normalizedCompany,
        )
      : ((await MovimientosFondosService.getDocument<FondoEntry>(
          companyKey,
        )) ??
        MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
          normalizedCompany,
        ));

    baseLedger.company = normalizedCompany;
    baseLedger.operations = { movements: [] };
    if (!baseLedger.state) {
      baseLedger.state =
        MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
          normalizedCompany,
        ).state;
    }
    if (lockedUntilAfter) {
      baseLedger.state.lockedUntil = lockedUntilAfter;
    } else {
      delete (baseLedger.state as any).lockedUntil;
    }
    baseLedger.state.updatedAt = new Date().toISOString();

    await MovimientosFondosService.saveDocument(companyKey, baseLedger);
    deps.storageSnapshotRef.current = baseLedger;
    try {
      localStorage.setItem(companyKey, JSON.stringify(baseLedger));
    } catch {
      // ignore storage errors
    }

    try {
      const key = deps.buildPhysicalCountStorageKey();
      if (key) localStorage.setItem(key, "false");
      deps.cleanupPhysicalCountLegacyKeys();
    } catch {
      // ignore
    }
    deps.setPendingCierreDeCaja(false);

    await forceClearClosingGuards(
      normalizedCompany,
      "delete_latest_fondo_general",
      deps.user,
    );
    try {
      deps.lastDailyClosingSavedAtRef.current = 0;
      deps.lastMovementCreatedAtRef.current = 0;
      deps.lastMovementDedupeRef.current = null;
      if (typeof window !== "undefined") {
        const dailyKey = `fondogeneral-lastDailyClosingSavedAt:${normalizedCompany}`;
        const createdKey = `fondogeneral-lastMovementCreatedAt:${normalizedCompany}:${deps.accountKey}`;
        const dedupeKey = `fondogeneral-lastMovementDedupe:${normalizedCompany}:${deps.accountKey}`;
        localStorage.removeItem(dailyKey);
        localStorage.removeItem(createdKey);
        localStorage.removeItem(dedupeKey);
      }
    } catch {
      // ignore
    }

    deps.showToast("Último cierre eliminado", "success", 4000);
  } finally {
    deps.deleteLatestClosingInProgressRef.current = false;
  }
}

export async function persistCreatedMovement(
  entry: FondoEntry,
  updatedEntries: FondoEntry[],
  deps: {
    persistMovementToFirestore: PersistMovementToFirestoreFn;
    showToast: ShowToastFn;
    providers: { code: string; name?: string; correonotifi?: string }[];
    accountKey: string;
    company: string | null;
    user: { id?: string; email?: string } | null;
    buildPhysicalCountStorageKey: () => string | null;
    cleanupPhysicalCountLegacyKeys: () => void;
    resetFondoForm: () => void;
    movementAutoCloseLocked: boolean;
    isCajaNegra: boolean;
    setFondoEntries: (entries: FondoEntry[] | ((prev: FondoEntry[]) => FondoEntry[])) => void;
    setLedgerSnapshot: (snapshot: LedgerSnapshotShape | ((prev: LedgerSnapshotShape) => LedgerSnapshotShape)) => void;
    setPendingCierreDeCaja: (v: boolean | ((prev: boolean) => boolean)) => void;
    setMovementModalOpen: (v: boolean) => void;
    editingInProgressRef: { current: boolean };
    lastMovementDedupeRef: { current: unknown };
    lastMovementCreatedAtRef: { current: number };
  },
): Promise<boolean> {
  const saved = await deps.persistMovementToFirestore(updatedEntries, "create", {
    upsert: entry,
  });

  if (!saved.ok) {
    deps.showToast(
      "Error al guardar el movimiento. Por favor, intente de nuevo.",
      "error",
      5000,
    );
    deps.editingInProgressRef.current = false;
    return false;
  }

  try {
    const normalizedCompany = (deps.company || "").trim();
    if (normalizedCompany.length > 0) {
      const savedAtMs = Date.now();
      const fingerprintParts = [
        `provider=${entry.providerCode || ""}`,
        `invoice=${entry.invoiceNumber || ""}`,
        `invoiceDocType=${normalizeInvoiceDocType((entry as any).invoiceDocType)}`,
        `type=${entry.paymentType || ""}`,
        `egreso=${Math.trunc(entry.amountEgreso || 0)}`,
        `payment=${Math.trunc(entry.amountPayment || 0)}`,
        `ingreso=${Math.trunc(entry.amountIngreso || 0)}`,
        `manager=${(entry.manager || "").trim()}`,
        `currency=${(entry as any).currency || "CRC"}`,
        `notes=${(entry.notes || "").trim()}`,
      ];
      const fingerprint = fingerprintParts.join("|");
      const payload = { at: savedAtMs, fingerprint };
      deps.lastMovementDedupeRef.current = payload;
      const provider = deps.providers.find((p) => p.code === entry.providerCode);
      const providerDisplayName = provider?.name || entry.providerCode;
      const isIngresoDesdeFV = isIngresoDesdeFondoVentasMovement(
        entry,
        providerDisplayName,
      );
      const shouldMarkCreatedCooldown = !isIngresoDesdeFV && !deps.isCajaNegra;
      if (shouldMarkCreatedCooldown)
        deps.lastMovementCreatedAtRef.current = savedAtMs;
      if (typeof window !== "undefined") {
        const key = `fondogeneral-lastMovementDedupe:${normalizedCompany}:${deps.accountKey}`;
        const createdKey = `fondogeneral-lastMovementCreatedAt:${normalizedCompany}:${deps.accountKey}`;
        try {
          localStorage.setItem(key, JSON.stringify(payload));
          if (shouldMarkCreatedCooldown) {
            localStorage.setItem(
              createdKey,
              JSON.stringify({ at: savedAtMs }),
            );
          } else if (!deps.isCajaNegra) {
            const previous = parseLastCreatedCooldown(
              localStorage.getItem(createdKey),
            );
            const prevAt = getEffectiveLastCreatedAtMs(previous);
            const ignorePayload: LastCreatedCooldownPayload = {
              at: savedAtMs,
              kind: "INGRESO_DESDE_FONDO_VENTAS",
              ...(prevAt > 0 ? { prevAt } : {}),
            };
            localStorage.setItem(createdKey, JSON.stringify(ignorePayload));
          }
        } catch {
          // ignore storage errors
        }
      }
    }
  } catch {
    // ignore
  }

  deps.editingInProgressRef.current = false;

  deps.setFondoEntries(updatedEntries);
  if (saved.ledgerSnapshot) {
    deps.setLedgerSnapshot(saved.ledgerSnapshot);
  }
  if (saved.confirmed) {
    deps.showToast("Movimiento guardado correctamente", "success", 3000);
  } else {
    deps.showToast(
      "Movimiento guardado localmente; pendiente de sincronización (revisa tu conexión).",
      "warning",
      6000,
    );
  }

  sendMovementNotification(entry, "create", deps.company, deps.providers, deps.showToast).catch((err) => {
    console.error(
      "[NOTIFICATION] Error en notificación de movimiento:",
      err,
    );
  });

  if (
    deps.accountKey === "FondoGeneral" &&
    !isAutoAdjustmentProvider(entry.providerCode)
  ) {
    try {
      const key = deps.buildPhysicalCountStorageKey();
      if (key) localStorage.setItem(key, "false");
      deps.cleanupPhysicalCountLegacyKeys();
    } catch {
      // ignore storage errors
    }
  }

  const selectedProviderData = deps.providers.find(
    (p) => p.code === entry.providerCode,
  );
  if (
    selectedProviderData?.name?.toUpperCase() ===
    CIERRE_FONDO_VENTAS_PROVIDER_NAME
  ) {
    deps.setPendingCierreDeCaja(true);
  }
  deps.resetFondoForm();
  if (!deps.movementAutoCloseLocked) {
    deps.setMovementModalOpen(false);
  }

  return true;
}
