import { FacturasService } from "../../../../services/facturas";
import {
  MovimientosFondosService,
  type LedgerExtraWrites,
  type MovementAccountKey,
  type MovementStorage,
} from "../../../../services/movimientos-fondos";
import type { FondoEntry } from "../../types";
import {
  getCanonicalClosingPaymentType,
  shouldDeleteFacturasMirror,
} from "../helpers";
import { buildV2MovementsCacheKey } from "../v2movements";
import { getAuthoritativeNowISO } from "@/utils/serverTime";
import { invalidateFondoCache } from "@/services/fondo-cache";
import {
  applyLedgerMovementMutation,
  type LedgerBalanceSnapshot,
} from "./ledgerState";

type V2MovementsCacheEntry = {
  loaded: boolean;
  movements: FondoEntry[];
  cursor: unknown;
  exhausted: boolean;
  loading: boolean;
  queryKey?: string;
  startIso?: string;
  endIsoExclusive?: string;
  revision?: number;
};

export interface PersistMovementDeps {
  company: string | null | undefined;
  accountKey: MovementAccountKey;
  storageSnapshotRef: { current: MovementStorage<FondoEntry> | null };
  v2MovementsCacheRef: { current: Record<string, V2MovementsCacheEntry> };
  registerLocalMutation?: (clientMutationId: string) => void;
}

export async function persistMovementToFirestore(
  updatedEntries: FondoEntry[],
  operationType: "create" | "edit" | "delete",
  change: {
    upsert?: FondoEntry;
    deleteId?: string;
    before?: FondoEntry | null;
  } | undefined,
  extraWrites: LedgerExtraWrites<FondoEntry> | undefined,
  deps: PersistMovementDeps,
): Promise<{
  ok: boolean;
  confirmed: boolean;
  ledgerSnapshot?: LedgerBalanceSnapshot;
  revision?: number;
  clientMutationId?: string;
}> {
  const { company, accountKey, storageSnapshotRef, v2MovementsCacheRef } = deps;
  const normalizedCompany = (company || "").trim();
  if (!normalizedCompany) {
    console.error("[PERSIST-IMMEDIATE] No company specified");
    return { ok: false, confirmed: false };
  }

  const companyKey = MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
  try {
    const nowISO = await getAuthoritativeNowISO();
    const clientMutationId = crypto.randomUUID();
    deps.registerLocalMutation?.(clientMutationId);
    const movementId = change?.upsert?.id ?? change?.deleteId ?? "";
    if (!movementId) throw new Error("MOVEMENT_ID_REQUIRED");

    let storedMovement: FondoEntry | undefined;
    if (operationType !== "delete") {
      const movement = change?.upsert;
      if (!movement) throw new Error("MOVEMENT_ID_REQUIRED");
      storedMovement = {
        ...movement,
        paymentType: getCanonicalClosingPaymentType(movement),
        accountId: accountKey,
        currency: movement.currency === "USD" ? "USD" : "CRC",
        empresa: normalizedCompany,
      };
    }

    console.log(`[PERSIST-IMMEDIATE] Guardando ${operationType} a Firestore...`, {
      company: normalizedCompany,
      accountKey,
      entriesCount: updatedEntries.length,
    });

    let committedSnapshot: LedgerBalanceSnapshot | null = null;
    const committed = await MovimientosFondosService.commitLedgerTransaction<FondoEntry, FondoEntry>({
      docId: companyKey,
      company: normalizedCompany,
      operation: operationType,
      movementId,
      accountId: accountKey,
      after: storedMovement,
      prepareExtraWrites: typeof extraWrites === "function"
        ? undefined
        : extraWrites?.prepare,
      mutateLedger: ({ ledger, before }) => {
        const result = applyLedgerMovementMutation({
          storage: MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
            ledger,
            normalizedCompany,
          ),
          operation: operationType,
          before,
          after: storedMovement,
          nowISO,
          clientMutationId,
        });
        // V2 movement documents live in the subcollection, never in the ledger.
        result.storage.operations = { movements: [] };
        committedSnapshot = result.ledgerSnapshot;
        return { ledger: result.storage, storedMovement };
      },
      extraWrites: (writer, { before }) => {
        if (typeof extraWrites === "function") extraWrites(writer);
        if (operationType === "delete" && before && shouldDeleteFacturasMirror(before)) {
          const deletedId = before.id;
          writer.delete(FacturasService.buildMovementRef(normalizedCompany, deletedId));
          writer.delete(FacturasService.buildMovementRef(normalizedCompany, `${deletedId}-NC`));
          const manualCreditNotes = Array.isArray(before.appliedCreditNotes)
            ? before.appliedCreditNotes.filter((note) =>
                String(note?.id || "").startsWith(`manual-nc-${deletedId}-`),
              )
            : [];
          manualCreditNotes.forEach((_, index) => {
            writer.delete(FacturasService.buildMovementRef(
              normalizedCompany,
              `${deletedId}-NC-${index + 1}`,
            ));
          });
        }
      },
    });

    const cacheKey = buildV2MovementsCacheKey(companyKey, accountKey);
    try {
      const cached = v2MovementsCacheRef.current[cacheKey];
      const movements = operationType === "delete"
        ? (cached?.movements ?? []).filter((entry) => entry.id !== movementId)
        : [storedMovement!, ...(cached?.movements ?? []).filter((entry) => entry.id !== movementId)];
      v2MovementsCacheRef.current[cacheKey] = {
        ...(cached ?? {
          loaded: true,
          movements: [],
          cursor: null,
          exhausted: false,
          loading: false,
        }),
        loaded: true,
        loading: false,
        revision: (cached?.revision ?? 0) + 1,
        movements,
      };
    } catch (cacheErr) {
      console.warn("[PERSIST-IMMEDIATE] cache update failed after commit:", cacheErr);
    }

    try {
      await invalidateFondoCache({
        companyId: normalizedCompany,
        accountId: accountKey,
        resource: "movements",
      });
    } catch (cacheErr) {
      console.warn("[PERSIST-IMMEDIATE] cache invalidation failed after commit:", cacheErr);
    }

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(companyKey, JSON.stringify(committed.ledger));
      }
    } catch (storageError) {
      console.warn("[PERSIST-IMMEDIATE] localStorage write failed:", storageError);
    }
    storageSnapshotRef.current = committed.ledger;
    console.log(`[PERSIST-IMMEDIATE] ${operationType} guardado (confirmed=true)`);
    return {
      ok: true,
      confirmed: true,
      ledgerSnapshot: committedSnapshot ?? undefined,
      revision: committed.ledger.state.revision ?? 0,
      clientMutationId,
    };
  } catch (err) {
    console.error(`[PERSIST-IMMEDIATE] Error guardando ${operationType} a Firestore:`, err);
    return { ok: false, confirmed: false };
  }
}
