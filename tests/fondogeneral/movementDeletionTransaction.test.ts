import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("@/utils/serverTime", () => ({ getAuthoritativeNowISO: vi.fn(async () => "2026-09-23T00:00:01.000Z") }));
vi.mock("@/services/fondo-cache", () => ({ invalidateFondoCache: vi.fn(async () => undefined) }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts: unknown[]) => parts.join("/")),
  deleteDoc: vi.fn(),
  doc: vi.fn((...parts: unknown[]) => parts.join("/")),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ originalAmount: 500, paidAmount: 200 }) })),
  getDocs: vi.fn(),
  getCountFromServer: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  setDoc: vi.fn(),
  startAfter: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

import { getDoc, runTransaction } from "firebase/firestore";
import { MovimientosFondosService } from "@/services/movimientos-fondos";
import { persistMovementToFirestore } from "@/app/fondogeneral/utils/fondo/persistence";
import { confirmDeleteMovement, type MovementDeletionDeps } from "@/app/fondogeneral/utils/movementDeletion";
import type { FondoEntry } from "@/app/fondogeneral/types";

const company = "DELIKOR SINAI";
const paymentId = "fcr-pago-FAC-123-ABC-2026-09-23";
const serverPayment: FondoEntry = {
  id: paymentId,
  providerCode: "PROVIDER",
  invoiceNumber: "F-1",
  invoiceDocType: "FCR",
  paymentType: "COMPRA INVENTARIO",
  amountEgreso: 50,
  amountIngreso: 0,
  appliedCreditNotes: [{ id: "NC-SERVER", appliedAmount: 30 } as never],
  manager: "Admin",
  manager2: "Admin",
  notes: "",
  createdAt: "2026-09-23T00:00:00.000Z",
  updateAt: "2026-09-23T00:00:00.000Z",
  accountId: "FondoGeneral",
  currency: "CRC",
};
const stalePayment: FondoEntry = {
  ...serverPayment,
  amountEgreso: 20,
  appliedCreditNotes: [{ id: "NC-OLD", appliedAmount: 10 } as never],
};

describe("FCR deletion transaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses server payment and retry invoice/NC balances before any write", async () => {
    const attempts: Array<{
      events: string[];
      writes: Array<[string, Record<string, unknown>]>;
    }> = [];
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
      const attempt = async (invoicePaid: number, notePaid: number) => {
        const events: string[] = [];
        const writes: Array<[string, Record<string, unknown>]> = [];
        attempts.push({ events, writes });
        return callback({
          get: vi.fn(async (ref: string) => {
            events.push(`read:${ref}`);
            if (ref.endsWith(`/movements/${paymentId}`)) return { exists: () => true, data: () => serverPayment };
            if (ref.endsWith("/movements/FAC-123-ABC")) return { exists: () => true, data: () => ({ originalAmount: 500, paidAmount: invoicePaid }) };
            if (ref.endsWith("/movements/NC-SERVER")) return { exists: () => true, data: () => ({ originalAmount: 120, paidAmount: notePaid }) };
            if (ref.includes("/Facturas/")) throw new Error(`Unexpected related read: ${ref}`);
            const ledger = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(company);
            ledger.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")!.currentBalance = 450;
            return { exists: () => true, data: () => ledger };
          }),
          set: vi.fn((ref: string, data: Record<string, unknown>) => { events.push(`write:${ref}`); writes.push([ref, data]); }),
          delete: vi.fn((ref: string) => events.push(`write:${ref}`)),
          update: vi.fn(),
        } as never);
      };
      await attempt(300, 100);
      return attempt(350, 90);
    });

    const showToast = vi.fn();
    const persistDeps = {
      company,
      accountKey: "FondoGeneral" as const,
      initialAmount: "0",
      initialAmountUSD: "0",
      currencyEnabled: { CRC: true, USD: true },
      ledgerSnapshot: { initialCRC: 0, currentCRC: 400, initialUSD: 0, currentUSD: 0 },
      storageSnapshotRef: { current: null },
      v2MovementsCacheRef: { current: {} },
    };
    await confirmDeleteMovement({
      accountKey: "FondoGeneral",
      company,
      providers: [],
      cierreFondoVentasProviderCode: null,
      latestCierreFondoVentasMovementId: null,
      isPrincipalAdmin: true,
      isSuperAdminUser: false,
      showToast,
      setConfirmDeleteEntry: vi.fn(),
      confirmDeleteEntry: { open: true, entry: stalePayment },
      fondoEntries: [stalePayment],
      storageSnapshotRef: { current: null },
      persistMovementToFirestore: (entries, operation, change, extraWrites) =>
        persistMovementToFirestore(entries, operation, change, extraWrites, persistDeps),
    } as MovementDeletionDeps);

    expect(attempts).toHaveLength(2);
    expect(vi.mocked(getDoc)).not.toHaveBeenCalled();
    for (const attempt of attempts) {
      expect(attempt.events.findIndex((event) => event.startsWith("write:"))).toBe(4);
      expect(attempt.events.some((event) => event.endsWith("/movements/NC-OLD"))).toBe(false);
    }
    const committed = attempts[1].writes;
    expect(committed.find(([ref]) => ref.endsWith("/movements/FAC-123-ABC"))?.[1]).toMatchObject({
      paidAmount: 300,
      balanceDue: 200,
      paymentStatus: "PARCIAL",
    });
    expect(committed.find(([ref]) => ref.endsWith("/movements/NC-SERVER"))?.[1]).toMatchObject({
      paidAmount: 60,
      balanceDue: 60,
      paymentStatus: "PARCIAL",
    });
    expect(showToast).toHaveBeenCalledWith("Movimiento eliminado exitosamente", "success");
  });

  it("reports a missing linked invoice without committing any write", async () => {
    const writes = vi.fn();
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => {
        if (ref.endsWith(`/movements/${paymentId}`)) return { exists: (): boolean => true, data: () => serverPayment };
        if (ref.endsWith("/movements/FAC-123-ABC")) return { exists: (): boolean => false };
        return { exists: () => true, data: () => MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(company) };
      }),
      set: writes,
      delete: writes,
      update: writes,
    } as never));
    const showToast = vi.fn();
    await confirmDeleteMovement({
      accountKey: "FondoGeneral",
      company,
      providers: [],
      cierreFondoVentasProviderCode: null,
      latestCierreFondoVentasMovementId: null,
      isPrincipalAdmin: true,
      isSuperAdminUser: false,
      showToast,
      setConfirmDeleteEntry: vi.fn(),
      confirmDeleteEntry: { open: true, entry: stalePayment },
      fondoEntries: [stalePayment],
      storageSnapshotRef: { current: null },
      persistMovementToFirestore: (entries, operation, change, extraWrites) =>
        persistMovementToFirestore(entries, operation, change, extraWrites, {
          company,
          accountKey: "FondoGeneral",
          initialAmount: "0",
          initialAmountUSD: "0",
          currencyEnabled: { CRC: true, USD: true },
          ledgerSnapshot: { initialCRC: 0, currentCRC: 0, initialUSD: 0, currentUSD: 0 },
          storageSnapshotRef: { current: null },
          v2MovementsCacheRef: { current: {} },
        }),
    } as MovementDeletionDeps);
    expect(writes).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "No se encontró la factura asociada al pago eliminado.", "error", 5000,
    );
  });
});
