import { db } from "@/config/firebase";
import { waitForPendingWrites, type WriteBatch } from "firebase/firestore";
import { FacturasService } from "../../../services/facturas";
import {
  MovimientosFondosService,
  type MovementAccountKey,
  type MovementCurrencyKey,
  type MovementStorage,
} from "../../../services/movimientos-fondos";
import type { FondoEntry } from "../types";
import {
  getCanonicalClosingPaymentType,
  resolveEffectiveEgresoAmount,
  shouldDeleteFacturasMirror,
} from "../utils/helpers";
import { APERTURA_FONDO_PROVIDER_CODE } from "../constants";
import { buildV2MovementsCacheKey } from "../utils/v2movements";

type PersistMovementLedgerSnapshot = {
  initialCRC: number;
  currentCRC: number;
  initialUSD: number;
  currentUSD: number;
};

type V2MovementsCacheEntry = {
  loaded: boolean;
  movements: FondoEntry[];
  cursor: unknown;
  exhausted: boolean;
  loading: boolean;
  queryKey?: string;
  startIso?: string;
  endIsoExclusive?: string;
};

export interface PersistMovementDeps {
  company: string | null | undefined;
  accountKey: MovementAccountKey;
  initialAmount: string;
  initialAmountUSD: string;
  currencyEnabled: Record<MovementCurrencyKey, boolean>;
  ledgerSnapshot: PersistMovementLedgerSnapshot;
  storageSnapshotRef: { current: MovementStorage<FondoEntry> | null };
  v2MovementsCacheRef: { current: Record<string, V2MovementsCacheEntry> };
}

export async function persistMovementToFirestore(
  updatedEntries: FondoEntry[],
  operationType: "create" | "edit" | "delete",
  change: {
    upsert?: FondoEntry;
    deleteId?: string;
    before?: FondoEntry | null;
  } | undefined,
  extraWrites: ((batch: WriteBatch) => void) | undefined,
  deps: PersistMovementDeps,
): Promise<{
  ok: boolean;
  confirmed: boolean;
  ledgerSnapshot?: PersistMovementLedgerSnapshot;
}> {
  const {
    company,
    accountKey,
    initialAmount,
    initialAmountUSD,
    currencyEnabled,
    ledgerSnapshot,
    storageSnapshotRef,
    v2MovementsCacheRef,
  } = deps;

  const normalizedCompany = (company || "").trim();
  if (normalizedCompany.length === 0) {
    console.error("[PERSIST-IMMEDIATE] No company specified");
    return { ok: false, confirmed: false };
  }

  const companyKey =
    MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);

  try {
    const baseStorage = storageSnapshotRef.current
      ? MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
          storageSnapshotRef.current,
          normalizedCompany,
        )
      : MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
          normalizedCompany,
        );

    baseStorage.company = normalizedCompany;

    // V2: movements live in a subcollection. Never persist the array to the main document.
    baseStorage.operations = { movements: [] };

    // IMPORTANTE:
    // Con filtros de rango (Desde/Hasta) en v2, `updatedEntries` puede NO contener
    // todos los movimientos históricos. Por eso NO podemos recalcular currentBalance
    // sumando `updatedEntries`. En su lugar, actualizamos balances por delta:
    // - create: + (ingreso-egreso)
    // - delete: - (ingreso-egreso)
    // - edit:   + (after - before)

    const parseBalance = (value: unknown) => {
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
    };

    const normalizeCurrency = (value: unknown): MovementCurrencyKey =>
      value === "USD" ? "USD" : "CRC";

    const movementDelta = (
      entry: Partial<FondoEntry> | null | undefined,
    ): { currency: MovementCurrencyKey; delta: number } | null => {
      if (!entry) return null;
      const currency = normalizeCurrency(entry.currency);
      const ingreso = parseBalance((entry as any).amountIngreso ?? 0);
      const egreso = resolveEffectiveEgresoAmount(entry);
      return { currency, delta: ingreso - egreso };
    };

    const normalizedInitialCRC =
      initialAmount.trim().length > 0 ? initialAmount.trim() : "0";
    const normalizedInitialUSD =
      initialAmountUSD.trim().length > 0 ? initialAmountUSD.trim() : "0";
    const parsedInitialCRC = Number(normalizedInitialCRC) || 0;
    const parsedInitialUSD = Number(normalizedInitialUSD) || 0;

    const stateSnapshot =
      baseStorage.state ??
      MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
        normalizedCompany,
      ).state;

    const existingCRC = stateSnapshot.balancesByAccount.find(
      (balance) =>
        balance.accountId === accountKey && balance.currency === "CRC",
    );
    const existingUSD = stateSnapshot.balancesByAccount.find(
      (balance) => balance.accountId === accountKey && balance.currency === "USD",
    );

    const prevInitialCRC = existingCRC
      ? parseBalance(existingCRC.initialBalance ?? 0)
      : parseBalance(ledgerSnapshot.initialCRC);
    const prevInitialUSD = existingUSD
      ? parseBalance(existingUSD.initialBalance ?? 0)
      : parseBalance(ledgerSnapshot.initialUSD);
    const prevCurrentCRC = existingCRC
      ? parseBalance(existingCRC.currentBalance ?? prevInitialCRC)
      : parseBalance(ledgerSnapshot.currentCRC);
    const prevCurrentUSD = existingUSD
      ? parseBalance(existingUSD.currentBalance ?? prevInitialUSD)
      : parseBalance(ledgerSnapshot.currentUSD);

    const deltas: Record<MovementCurrencyKey, number> = { CRC: 0, USD: 0 };

    const resolveBeforeFallback = (): FondoEntry | null => {
      const targetId =
        operationType === "delete"
          ? change?.deleteId
          : operationType === "edit"
            ? change?.upsert?.id
            : null;
      if (!targetId) return null;
      const cacheKey = buildV2MovementsCacheKey(companyKey, accountKey);
      const cached = v2MovementsCacheRef.current[cacheKey];
      return cached?.movements?.find((m) => m.id === targetId) ?? null;
    };

    const beforeEntry = change?.before ?? resolveBeforeFallback();
    const afterEntry = change?.upsert;

    if (operationType === "create") {
      const isCashOpening =
        afterEntry?.providerCode === APERTURA_FONDO_PROVIDER_CODE;
      if (isCashOpening) {
        const openingCRC = Math.max(
          0,
          Math.trunc(Number((afterEntry as any)?.openingBalanceCRC ?? 0) || 0),
        );
        const openingUSD = Math.max(
          0,
          Math.trunc(Number((afterEntry as any)?.openingBalanceUSD ?? 0) || 0),
        );
        deltas.CRC += openingCRC - prevCurrentCRC;
        deltas.USD += openingUSD - prevCurrentUSD;
      } else {
        const d = movementDelta(afterEntry);
        if (d) deltas[d.currency] += d.delta;
      }
    } else if (operationType === "delete") {
      const isCashOpening =
        beforeEntry?.providerCode === APERTURA_FONDO_PROVIDER_CODE;
      if (isCashOpening) {
        const openingCRC = Math.max(
          0,
          Math.trunc(Number((beforeEntry as any)?.openingBalanceCRC ?? 0) || 0),
        );
        const openingUSD = Math.max(
          0,
          Math.trunc(Number((beforeEntry as any)?.openingBalanceUSD ?? 0) || 0),
        );
        const previousCRC = Math.max(
          0,
          Math.trunc(Number((beforeEntry as any)?.openingPreviousBalanceCRC ?? 0) || 0),
        );
        const previousUSD = Math.max(
          0,
          Math.trunc(Number((beforeEntry as any)?.openingPreviousBalanceUSD ?? 0) || 0),
        );
        deltas.CRC -= openingCRC - previousCRC;
        deltas.USD -= openingUSD - previousUSD;
      } else {
        const d = movementDelta(beforeEntry);
        if (d) deltas[d.currency] -= d.delta;
      }
    } else if (operationType === "edit") {
      const isCashOpeningBefore =
        beforeEntry?.providerCode === APERTURA_FONDO_PROVIDER_CODE;
      const isCashOpeningAfter =
        afterEntry?.providerCode === APERTURA_FONDO_PROVIDER_CODE;
      if (isCashOpeningBefore || isCashOpeningAfter) {
        const beforeCRC = Math.max(
          0,
          Math.trunc(Number((beforeEntry as any)?.openingBalanceCRC ?? 0) || 0),
        );
        const beforeUSD = Math.max(
          0,
          Math.trunc(Number((beforeEntry as any)?.openingBalanceUSD ?? 0) || 0),
        );
        const afterCRC = Math.max(
          0,
          Math.trunc(Number((afterEntry as any)?.openingBalanceCRC ?? 0) || 0),
        );
        const afterUSD = Math.max(
          0,
          Math.trunc(Number((afterEntry as any)?.openingBalanceUSD ?? 0) || 0),
        );
        deltas.CRC += afterCRC - beforeCRC;
        deltas.USD += afterUSD - beforeUSD;
      } else {
        const before = movementDelta(beforeEntry);
        if (before) deltas[before.currency] -= before.delta;
        const after = movementDelta(afterEntry);
        if (after) deltas[after.currency] += after.delta;
      }
    }

    const nextCurrentCRC =
      prevCurrentCRC + (parsedInitialCRC - prevInitialCRC) + deltas.CRC;
    const nextCurrentUSD =
      prevCurrentUSD + (parsedInitialUSD - prevInitialUSD) + deltas.USD;
    const nextAccountBalances = stateSnapshot.balancesByAccount.filter(
      (balance) => balance.accountId !== accountKey,
    );
    nextAccountBalances.push(
      {
        accountId: accountKey,
        currency: "CRC",
        enabled: currencyEnabled.CRC,
        initialBalance: parsedInitialCRC,
        currentBalance: nextCurrentCRC,
      },
      {
        accountId: accountKey,
        currency: "USD",
        enabled: currencyEnabled.USD,
        initialBalance: parsedInitialUSD,
        currentBalance: nextCurrentUSD,
      },
    );
    stateSnapshot.balancesByAccount = nextAccountBalances;
    stateSnapshot.updatedAt = new Date().toISOString();

    // Preservar lockedUntil del snapshot actual si existe
    if (storageSnapshotRef.current?.state?.lockedUntil) {
      stateSnapshot.lockedUntil = storageSnapshotRef.current.state.lockedUntil;
    }
    baseStorage.state = stateSnapshot;

    // Guardar en Firestore (ledger + movimiento) de forma ATÓMICA
    console.log(`[PERSIST-IMMEDIATE] Guardando ${operationType} a Firestore...`, {
      company: normalizedCompany,
      accountKey,
      entriesCount: updatedEntries.length,
    });

    let cacheUpdater: (() => void) | null = null;
    let movementChange:
      | {
          type: "upsert";
          movement: FondoEntry & { id: string };
          accountId?: MovementAccountKey;
        }
      | {
          type: "delete";
          movementId: string;
          accountId?: MovementAccountKey;
        }
      | { type: "none" } = { type: "none" };

    if (operationType === "delete") {
      const deleteId = change?.deleteId;
      if (!deleteId) {
        throw new Error("[PERSIST-IMMEDIATE] delete requires change.deleteId");
      }
      movementChange = {
        type: "delete",
        movementId: deleteId,
        accountId: accountKey,
      };
      cacheUpdater = () => {
        const cacheKey = buildV2MovementsCacheKey(companyKey, accountKey);
        const cached = v2MovementsCacheRef.current[cacheKey];
        if (cached?.loaded) {
          v2MovementsCacheRef.current[cacheKey] = {
            ...cached,
            loaded: true,
            movements: cached.movements.filter((m) => m.id !== deleteId),
          };
        }
      };
    } else {
      const movement = change?.upsert;
      if (!movement) {
        throw new Error("[PERSIST-IMMEDIATE] create/edit requires change.upsert");
      }
      const normalizedCurrency: MovementCurrencyKey =
        movement.currency === "USD" ? "USD" : "CRC";
      const canonicalPaymentType = getCanonicalClosingPaymentType(movement);
      const storedMovement: FondoEntry = {
        ...(movement as FondoEntry),
        paymentType: canonicalPaymentType,
        accountId: accountKey,
        currency: normalizedCurrency,
        empresa: normalizedCompany,
      };
      movementChange = {
        type: "upsert",
        movement: storedMovement,
        accountId: accountKey,
      };
      cacheUpdater = () => {
        const cacheKey = buildV2MovementsCacheKey(companyKey, accountKey);
        const cached = v2MovementsCacheRef.current[cacheKey];
        if (cached?.loaded) {
          const next = [
            storedMovement,
            ...cached.movements.filter((m) => m.id !== storedMovement.id),
          ];
          v2MovementsCacheRef.current[cacheKey] = {
            ...cached,
            loaded: true,
            movements: next,
          };
        }
      };
    }

    const shouldDeleteFacturaMirror =
      operationType === "delete" &&
      beforeEntry &&
      shouldDeleteFacturasMirror(beforeEntry);

    const mergedExtraWrites =
      extraWrites || shouldDeleteFacturaMirror
        ? (batch: WriteBatch) => {
            extraWrites?.(batch);
            if (shouldDeleteFacturaMirror) {
              const deletedId = String(beforeEntry?.id || "");
              batch.delete(FacturasService.buildMovementRef(normalizedCompany, deletedId));
              batch.delete(
                FacturasService.buildMovementRef(normalizedCompany, `${deletedId}-NC`),
              );
            }
          }
        : undefined;

    await MovimientosFondosService.commitLedgerAndMovement(
      companyKey,
      baseStorage,
      movementChange,
      mergedExtraWrites,
    );

    if (cacheUpdater) {
      try {
        cacheUpdater();
      } catch (cacheErr) {
        console.warn(
          "[PERSIST-IMMEDIATE] cache update failed after commit:",
          cacheErr,
        );
      }
    }

    // Guardar snapshot liviano en localStorage DESPUÉS del commit.
    // Esto evita que un fallo de Firestore deje un snapshot local inconsistente.
    try {
      localStorage.setItem(companyKey, JSON.stringify(baseStorage));
    } catch (storageError) {
      console.warn("[PERSIST-IMMEDIATE] localStorage write failed:", storageError);
    }

    // setDoc puede resolver con escritura local; esperamos un poco por confirmación del backend
    // para evitar casos de "se guardó" cuando el usuario estaba offline/intermitente.
    let confirmed = false;
    try {
      const timeoutMs = 8000;
      await Promise.race([
        waitForPendingWrites(db).then(() => {
          confirmed = true;
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("waitForPendingWrites timeout")), timeoutMs);
        }),
      ]);
    } catch (pendingErr) {
      console.warn(
        `[PERSIST-IMMEDIATE] ${operationType} guardado localmente pero sin confirmación del servidor aún`,
        pendingErr,
      );
    }

    console.log(
      `[PERSIST-IMMEDIATE] ? ${operationType} guardado (confirmed=${confirmed})`,
    );

    // Actualizar snapshot después de guardar
    storageSnapshotRef.current = baseStorage;

    return {
      ok: true,
      confirmed,
      ledgerSnapshot: {
        initialCRC: parsedInitialCRC,
        currentCRC: nextCurrentCRC,
        initialUSD: parsedInitialUSD,
        currentUSD: nextCurrentUSD,
      },
    };
  } catch (err) {
    console.error(
      `[PERSIST-IMMEDIATE] ? Error guardando ${operationType} a Firestore:`,
      err,
    );
    return { ok: false, confirmed: false };
  }
}
