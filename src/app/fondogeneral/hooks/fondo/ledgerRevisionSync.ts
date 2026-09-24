import type { LedgerLastChange, MovementAccountKey } from "../../../../services/movimientos-fondos";
import type { FondoEntry } from "../../types";
import type { resolveActiveMovementsQuery } from "../../utils/v2movements";

export type LedgerRevisionAction =
  | { type: "ignore" }
  | { type: "ledger-only" }
  | { type: "fetch-one"; movementId: string }
  | { type: "remove-one"; movementId: string }
  | { type: "refresh-range" };

export function decideLedgerRevisionSync(input: {
  previousRevision: number;
  nextRevision: number;
  activeAccountId: MovementAccountKey;
  lastChange?: LedgerLastChange | null;
  locallyAppliedMutationIds: ReadonlySet<string>;
}): LedgerRevisionAction {
  const { previousRevision, nextRevision, lastChange, activeAccountId, locallyAppliedMutationIds } = input;
  if (nextRevision <= previousRevision) return { type: "ignore" };
  if (nextRevision > previousRevision + 1) return { type: "refresh-range" };
  if (!lastChange || lastChange.revision !== nextRevision || lastChange.accountId !== activeAccountId ||
    (lastChange.clientMutationId && locallyAppliedMutationIds.has(lastChange.clientMutationId))) {
    return { type: "ledger-only" };
  }
  if (lastChange.kind === "invoice-payment") return { type: "ledger-only" };
  return { type: lastChange.operation === "delete" ? "remove-one" : "fetch-one", movementId: lastChange.movementId };
}

export function movementMatchesActiveQuery(
  entry: Pick<FondoEntry, "createdAt"> & Partial<Pick<FondoEntry, "providerCode" | "paymentType" | "invoiceNumber">>,
  query: Omit<ReturnType<typeof resolveActiveMovementsQuery>, "queryKey">,
): boolean {
  return entry.createdAt >= query.startIso && entry.createdAt < query.endIsoExclusive &&
    (!query.providerCode || entry.providerCode === query.providerCode) &&
    (!query.paymentType || entry.paymentType === query.paymentType) &&
    (!query.invoiceNumber || entry.invoiceNumber === query.invoiceNumber);
}
