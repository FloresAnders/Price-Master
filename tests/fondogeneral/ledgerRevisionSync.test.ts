import { describe, expect, it } from "vitest";
import { decideLedgerRevisionSync, movementMatchesActiveQuery } from "../../src/app/fondogeneral/hooks/fondo/ledgerRevisionSync";
import type { LedgerMovementChange } from "../../src/services/movimientos-fondos";

const change: LedgerMovementChange = {
  kind: "movement", revision: 5, movementId: "m5", operation: "create",
  accountId: "FondoGeneral", currency: "CRC", updatedAt: "2026-09-23T00:00:00.000Z",
};
const input = { previousRevision: 4, nextRevision: 5, activeAccountId: "FondoGeneral" as const, lastChange: change, locallyAppliedMutationIds: new Set<string>() };

describe("ledger revision decisions", () => {
  it.each(["create", "edit"] as const)("fetches one consecutive remote %s", (operation) => {
    expect(decideLedgerRevisionSync({ ...input, lastChange: { ...change, operation } })).toEqual({ type: "fetch-one", movementId: "m5" });
  });
  it("removes consecutive deletes", () => {
    expect(decideLedgerRevisionSync({ ...input, lastChange: { ...change, operation: "delete" } })).toEqual({ type: "remove-one", movementId: "m5" });
  });
  it("only applies the ledger for another account", () => {
    expect(decideLedgerRevisionSync({ ...input, lastChange: { ...change, accountId: "BCR" } })).toEqual({ type: "ledger-only" });
  });
  it.each([4, 3, 0])("ignores a same or lower revision %s", (nextRevision) => {
    expect(decideLedgerRevisionSync({ ...input, nextRevision })).toEqual({ type: "ignore" });
  });
  it("does not refresh legacy initial zero", () => {
    expect(decideLedgerRevisionSync({ ...input, previousRevision: 0, nextRevision: 0, lastChange: null })).toEqual({ type: "ignore" });
  });
  it("suppresses consecutive local echoes", () => {
    expect(decideLedgerRevisionSync({ ...input, lastChange: { ...change, clientMutationId: "local" }, locallyAppliedMutationIds: new Set(["local"]) })).toEqual({ type: "ledger-only" });
  });
  it("refreshes a gap even when latest mutation is local", () => {
    expect(decideLedgerRevisionSync({ ...input, previousRevision: 2, lastChange: { ...change, clientMutationId: "local" }, locallyAppliedMutationIds: new Set(["local"]) })).toEqual({ type: "refresh-range" });
  });
  it("refreshes a gap without lastChange", () => {
    expect(decideLedgerRevisionSync({ ...input, previousRevision: 2, lastChange: null })).toEqual({ type: "refresh-range" });
  });
  it("does not trust a change describing an older revision", () => {
    expect(decideLedgerRevisionSync({ ...input, lastChange: { ...change, revision: 3 } })).toEqual({ type: "ledger-only" });
  });
});

describe("movementMatchesActiveQuery", () => {
  const query = { startIso: "2026-09-23T06:00:00.000Z", endIsoExclusive: "2026-09-24T06:00:00.000Z" };
  it.each([
    ["2026-09-23T05:59:59.999Z", false], ["2026-09-23T06:00:00.000Z", true],
    ["2026-09-24T05:59:59.999Z", true], ["2026-09-24T06:00:00.000Z", false],
  ])("checks boundary %s", (createdAt, expected) => {
    expect(movementMatchesActiveQuery({ createdAt }, query)).toBe(expected);
  });
  it.each(["providerCode", "paymentType", "invoiceNumber"] as const)("requires exact active %s", (field) => {
    const entry = { createdAt: query.startIso, [field]: "match" };
    expect(movementMatchesActiveQuery(entry, { ...query, [field]: "match" })).toBe(true);
    expect(movementMatchesActiveQuery(entry, { ...query, [field]: "other" })).toBe(false);
    expect(movementMatchesActiveQuery(entry, query)).toBe(true);
  });
});
