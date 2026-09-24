import { MovimientosFondosService } from "@/services/movimientos-fondos";
import { APERTURA_FONDO_PROVIDER_CODE } from "../../constants";
import type { FondoEntry } from "../../types";
import { formatByCurrency, resolveEffectiveEgresoAmount, roundMoney2 } from "../helpers";

type IntegrityMovement = Partial<FondoEntry> & Pick<FondoEntry, "id" | "createdAt">;
type LedgerIntegrityBalances = {
  expectedCRC: number;
  expectedUSD: number;
  ledgerCRC: number;
  ledgerUSD: number;
  driftCRC: number;
  driftUSD: number;
};

export type LedgerIntegrityCalculation =
  | (LedgerIntegrityBalances & { ok: true; reason: "balanced"; openingId: string })
  | (LedgerIntegrityBalances & { ok: false; reason: "mismatch"; openingId: string })
  | {
      ok: false;
      reason: "opening-missing";
      openingId: null;
      expectedCRC: null;
      expectedUSD: null;
      ledgerCRC: number;
      ledgerUSD: number;
      driftCRC: null;
      driftUSD: null;
    };

export type LedgerIntegrityResult = LedgerIntegrityCalculation & {
  ledgerRevision: number;
  ledgerUpdatedAt: string;
};

export const LEDGER_CHANGED_DURING_INTEGRITY_CHECK = "LEDGER_CHANGED_DURING_INTEGRITY_CHECK";

export function calculateLedgerIntegrity(input: {
  ledgerCRC: number;
  ledgerUSD: number;
  opening: IntegrityMovement | null;
  movements: IntegrityMovement[];
}): LedgerIntegrityCalculation {
  const ledgerCRC = roundMoney2(input.ledgerCRC);
  const ledgerUSD = roundMoney2(input.ledgerUSD);
  const { opening } = input;
  if (!opening) {
    return {
      ok: false, reason: "opening-missing", openingId: null,
      expectedCRC: null, expectedUSD: null, ledgerCRC, ledgerUSD,
      driftCRC: null, driftUSD: null,
    };
  }
  let expectedCRC = roundMoney2(opening.openingBalanceCRC);
  let expectedUSD = roundMoney2(opening.openingBalanceUSD);
  const openingMs = Date.parse(opening.createdAt);
  for (const movement of input.movements) {
    if (
      movement.id === opening.id ||
      movement.providerCode === APERTURA_FONDO_PROVIDER_CODE ||
      Date.parse(movement.createdAt) <= openingMs
    ) continue;
    const delta = roundMoney2(movement.amountIngreso) - resolveEffectiveEgresoAmount(movement);
    if (movement.currency === "USD") expectedUSD = roundMoney2(expectedUSD + delta);
    else expectedCRC = roundMoney2(expectedCRC + delta);
  }
  const balances = {
    expectedCRC, expectedUSD, ledgerCRC, ledgerUSD,
    driftCRC: roundMoney2(ledgerCRC - expectedCRC),
    driftUSD: roundMoney2(ledgerUSD - expectedUSD),
  };
  return balances.driftCRC === 0 && balances.driftUSD === 0
    ? { ...balances, ok: true, reason: "balanced", openingId: opening.id }
    : { ...balances, ok: false, reason: "mismatch", openingId: opening.id };
}

export function buildOperationalStartISO(
  operationalDateKey: string,
  horarioApertura: string,
): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(operationalDateKey) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horarioApertura)
  ) {
    throw new Error("INVALID_LEDGER_INTEGRITY_RANGE");
  }
  const day = new Date(`${operationalDateKey}T00:00:00.000Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== operationalDateKey) {
    throw new Error("INVALID_LEDGER_INTEGRITY_RANGE");
  }
  return new Date(`${operationalDateKey}T${horarioApertura}:00.000-06:00`).toISOString();
}

export type LoadLedgerIntegrityInput = {
  company: string;
  accountId: "FondoGeneral";
  operationalStartISO: string;
  closingISO: string;
};

export async function loadLedgerIntegrity(input: LoadLedgerIntegrityInput): Promise<LedgerIntegrityResult> {
  const startMs = Date.parse(input.operationalStartISO);
  const closingMs = Date.parse(input.closingISO);
  if (!Number.isFinite(startMs) || !Number.isFinite(closingMs) || startMs > closingMs) {
    throw new Error("INVALID_LEDGER_INTEGRITY_RANGE");
  }
  const docId = MovimientosFondosService.buildCompanyMovementsKey(input.company);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await MovimientosFondosService.getDocumentFromServer(docId);
    if (!before) throw new Error("LEDGER_DOCUMENT_MISSING");
    const movements = await MovimientosFondosService.listAllMovementsByCreatedAtRange<IntegrityMovement>(docId, {
      accountId: input.accountId,
      startIso: new Date(startMs).toISOString(),
      endIsoExclusive: new Date(closingMs + 1).toISOString(),
    });
    const after = await MovimientosFondosService.getDocumentFromServer(docId);
    if (!after) throw new Error("LEDGER_DOCUMENT_MISSING");
    const ledgerRevision = after.state.revision ?? 0;
    const ledgerUpdatedAt = after.state.updatedAt;
    if (
      (before.state.revision ?? 0) !== ledgerRevision ||
      before.state.updatedAt !== ledgerUpdatedAt
    ) continue;
    const applicable = movements.filter((movement) => {
      const timestamp = Date.parse(movement.createdAt);
      return timestamp >= startMs && timestamp <= closingMs;
    });
    const opening = applicable
      .filter((movement) => movement.providerCode === APERTURA_FONDO_PROVIDER_CODE)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
    const balance = (currency: "CRC" | "USD") => after.state.balancesByAccount.find(
      (item) => item.accountId === input.accountId && item.currency === currency,
    )?.currentBalance ?? 0;
    return {
      ...calculateLedgerIntegrity({
        ledgerCRC: balance("CRC"), ledgerUSD: balance("USD"),
        opening, movements: applicable,
      }),
      ledgerRevision, ledgerUpdatedAt,
    };
  }
  throw new Error(LEDGER_CHANGED_DURING_INTEGRITY_CHECK);
}

export function formatLedgerIntegrityMismatch(result: LedgerIntegrityCalculation): string {
  const drifts = (["CRC", "USD"] as const).flatMap((currency) => {
    const drift = currency === "CRC" ? result.driftCRC : result.driftUSD;
    return drift ? [formatByCurrency(currency, Math.abs(drift))] : [];
  });
  return `No se puede cerrar el fondo. El ledger está desviado por ${drifts.join(" y ")}. Actualice la pantalla y solicite revisión administrativa.`;
}
