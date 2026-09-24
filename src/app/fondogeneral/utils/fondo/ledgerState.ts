import { APERTURA_FONDO_PROVIDER_CODE } from "../../constants";
import type { FondoEntry } from "../../types";
import { resolveEffectiveEgresoAmount } from "../helpers";
import type {
  MovementAccountKey,
  MovementCurrencyKey,
  MovementStorage,
} from "@/services/movimientos-fondos";

export type LedgerBalanceSnapshot = {
  initialCRC: number;
  currentCRC: number;
  initialUSD: number;
  currentUSD: number;
};

export type LedgerMovementValue = Partial<FondoEntry> &
  Pick<FondoEntry, "id" | "createdAt">;

export type LedgerMovementMutationInput = {
  storage: MovementStorage<FondoEntry>;
  operation: "create" | "edit" | "delete";
  before?: LedgerMovementValue | null;
  after?: LedgerMovementValue | null;
  nowISO: string;
  clientMutationId?: string;
};

export type LedgerStateMutationResult = {
  storage: MovementStorage<FondoEntry>;
  ledgerSnapshot: LedgerBalanceSnapshot;
};

const money = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const currencyOf = (entry: LedgerMovementValue): MovementCurrencyKey =>
  entry.currency === "USD" ? "USD" : "CRC";

const accountOf = (entry: LedgerMovementValue): MovementAccountKey =>
  entry.accountId ?? "FondoGeneral";

const isOpening = (entry: LedgerMovementValue): boolean =>
  entry.providerCode === APERTURA_FONDO_PROVIDER_CODE;

export function extractLedgerSnapshot(
  storage: MovementStorage<FondoEntry>,
  accountKey: MovementAccountKey,
): LedgerBalanceSnapshot {
  const balance = (currency: MovementCurrencyKey) =>
    storage.state.balancesByAccount.find(
      (item) => item.accountId === accountKey && item.currency === currency,
    );
  const crc = balance("CRC");
  const usd = balance("USD");
  return {
    initialCRC: money(crc?.initialBalance),
    currentCRC: money(crc?.currentBalance),
    initialUSD: money(usd?.initialBalance),
    currentUSD: money(usd?.currentBalance),
  };
}

export function applyLedgerMovementMutation(
  input: LedgerMovementMutationInput,
): LedgerStateMutationResult {
  const { before, after, operation } = input;
  if (operation === "create" && !after) throw new Error("Create requires after movement");
  if (operation === "edit" && (!before || !after)) {
    throw new Error("Edit requires before and after movements");
  }
  if (operation === "delete" && !before) throw new Error("Delete requires before movement");

  const movement = operation === "delete" ? before! : after!;
  const accountKey = accountOf(movement);
  const storage: MovementStorage<FondoEntry> = {
    ...input.storage,
    state: {
      ...input.storage.state,
      balancesByAccount: input.storage.state.balancesByAccount.map((item) => ({ ...item })),
    },
  };

  const adjust = (
    account: MovementAccountKey,
    currency: MovementCurrencyKey,
    delta: number,
  ) => {
    const balance = storage.state.balancesByAccount.find(
      (item) => item.accountId === account && item.currency === currency,
    );
    if (balance) balance.currentBalance = money(money(balance.currentBalance) + delta);
  };
  const setOpening = (entry: LedgerMovementValue) => {
    const account = accountOf(entry);
    for (const currency of ["CRC", "USD"] as const) {
      const balance = storage.state.balancesByAccount.find(
        (item) => item.accountId === account && item.currency === currency,
      );
      if (balance) {
        balance.currentBalance = money(
          currency === "CRC" ? entry.openingBalanceCRC : entry.openingBalanceUSD,
        );
      }
    }
  };
  const adjustMovement = (entry: LedgerMovementValue, multiplier: number) => {
    const delta = money(entry.amountIngreso) - resolveEffectiveEgresoAmount(entry);
    adjust(accountOf(entry), currencyOf(entry), money(multiplier * delta));
  };

  if (operation === "create") {
    if (isOpening(after!)) setOpening(after!);
    else adjustMovement(after!, 1);
  } else if (operation === "delete") {
    if (isOpening(before!)) {
      adjust(accountOf(before!), "CRC", money(before!.openingPreviousBalanceCRC) - money(before!.openingBalanceCRC));
      adjust(accountOf(before!), "USD", money(before!.openingPreviousBalanceUSD) - money(before!.openingBalanceUSD));
    } else adjustMovement(before!, -1);
  } else if (isOpening(before!) || isOpening(after!)) {
    adjust(accountOf(movement), "CRC", money(after!.openingBalanceCRC) - money(before!.openingBalanceCRC));
    adjust(accountOf(movement), "USD", money(after!.openingBalanceUSD) - money(before!.openingBalanceUSD));
  } else {
    adjustMovement(before!, -1);
    adjustMovement(after!, 1);
  }

  const previousRevision = input.storage.state.revision;
  const revision = (typeof previousRevision === "number" && Number.isFinite(previousRevision)
    ? Math.max(0, Math.trunc(previousRevision))
    : 0) + 1;
  storage.state.revision = revision;
  storage.state.updatedAt = input.nowISO;
  storage.state.lastChange = {
    kind: "movement",
    revision,
    movementId: movement.id,
    operation,
    accountId: accountKey,
    currency: currencyOf(movement),
    updatedAt: input.nowISO,
    ...(input.clientMutationId ? { clientMutationId: input.clientMutationId } : {}),
  };

  return { storage, ledgerSnapshot: extractLedgerSnapshot(storage, accountKey) };
}
