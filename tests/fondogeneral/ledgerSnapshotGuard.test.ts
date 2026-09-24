import { describe, expect, it } from "vitest";
import { acceptLedgerSnapshot, writeLedgerLocalCacheIfCurrent } from "@/app/fondogeneral/hooks/fondo/ledgerSnapshotGuard";
import { MovimientosFondosService } from "@/services/movimientos-fondos";

const storage = (revision: number, crc: number, updatedAt = "2026-09-23T01:00:00.000Z") => {
  const value = MovimientosFondosService.createEmptyMovementStorage("DELIKOR SINAI");
  value.state.revision = revision;
  value.state.updatedAt = updatedAt;
  value.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")!.currentBalance = crc;
  return value;
};

describe("acceptLedgerSnapshot", () => {
  it("keeps revision N+1 when a local commit for N completes late", () => {
    const ref = { current: storage(8, 138_000) };
    expect(acceptLedgerSnapshot(ref, storage(7, 103_000), "DELIKOR SINAI")).toBe(false);
    expect(ref.current.state.revision).toBe(8);
    expect(ref.current.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(138_000);
  });

  it("keeps revision N+1 when an older hydration finishes late", () => {
    const ref = { current: storage(8, 138_000) };
    expect(acceptLedgerSnapshot(ref, storage(7, 103_000), "DELIKOR SINAI")).toBe(false);
    expect(ref.current.state.revision).toBe(8);
  });

  it("rejects a result for another company and an older same-revision lock", () => {
    const ref = { current: storage(8, 138_000) };
    expect(acceptLedgerSnapshot(ref, storage(9, 200_000), "OTHER COMPANY")).toBe(false);
    expect(acceptLedgerSnapshot(ref, storage(8, 103_000, "2026-09-23T00:00:00.000Z"), "DELIKOR SINAI")).toBe(false);
  });
  it("keeps revision N+1 in local storage when a Facturas payment for N completes late", () => {
    const values = new Map([["movements_DELIKOR SINAI", JSON.stringify(storage(8, 138_000))]]);
    const cache = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(writeLedgerLocalCacheIfCurrent(cache, "movements_DELIKOR SINAI", storage(7, 103_000), "DELIKOR SINAI")).toBe(false);
    expect(JSON.parse(values.get("movements_DELIKOR SINAI")!).state.revision).toBe(8);
  });
});
