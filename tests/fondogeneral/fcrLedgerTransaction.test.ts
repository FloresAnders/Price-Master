import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts: unknown[]) => parts.join("/")),
  deleteDoc: vi.fn(),
  doc: vi.fn((...parts: unknown[]) => parts.join("/")),
  getCountFromServer: vi.fn(),
  getDocFromServer: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  setDoc: vi.fn(),
  startAfter: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

import { runTransaction } from "firebase/firestore";
import { commitFcrPayments } from "@/app/fondogeneral/utils/invoicePayment/fcrLedgerTransaction";
import { MovimientosFondosService } from "@/services/movimientos-fondos";
import type { FacturaMovement } from "@/services/facturas";

const company = "EMPRESA PRUEBA";
const nowISO = "2026-09-28T12:00:00.000Z";

const invoice: FacturaMovement = {
  id: "FCR-3778",
  empresa: company,
  accountId: "FondoGeneral",
  amount: 36_131.91,
  originalAmount: 36_131.91,
  amountEgreso: 36_131.91,
  amountIngreso: 0,
  balanceDue: 36_131.91,
  createdAt: "2026-09-20T12:00:00.000Z",
  currency: "CRC",
  invoiceNumber: "3778",
  manager: "Encargado",
  notes: "",
  invoiceDocType: "FCR",
  paymentType: "FCR",
  providerCode: "0018",
  paymentStatus: "PENDIENTE",
};

describe("commitFcrPayments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pays an FCR from the active fund even when it differs from the invoice account", async () => {
    const ledger = MovimientosFondosService.createEmptyMovementStorage(company);
    const bcrBalance = ledger.state.balancesByAccount.find(
      (item) => item.accountId === "BCR" && item.currency === "CRC",
    );
    if (!bcrBalance) throw new Error("Missing BCR balance fixture");
    bcrBalance.currentBalance = 100_000;

    const writes: Array<[string, unknown]> = [];
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) =>
      callback({
        get: vi.fn(async (ref: string) => {
          if (ref.includes("MovimientosFondos/") && ref.includes("/movements/")) {
            return { exists: (): boolean => false };
          }
          return {
            exists: (): boolean => true,
            data: () => (ref.includes("MovimientosFondos/") ? ledger : invoice),
          };
        }),
        set: vi.fn((ref: string, value: unknown) => writes.push([ref, value])),
        delete: vi.fn(),
        update: vi.fn(),
      } as never),
    );

    const result = await commitFcrPayments({
      company,
      accountId: "BCR",
      nowISO,
      applications: [{
        invoice,
        cashDebit: 10_000,
        totalAppliedToInvoice: 10_000,
        roundingAbsorbed: 0,
      }],
    });

    expect(result.invoices[0]).toMatchObject({
      id: "FCR-3778",
      accountId: "BCR",
      paidAmount: 10_000,
      balanceDue: 26_131.91,
    });
    expect(result.paymentMovements[0]).toMatchObject({
      accountId: "BCR",
      amountEgreso: 10_000,
    });
    expect(
      result.ledger.state.balancesByAccount.find(
        (item) => item.accountId === "BCR" && item.currency === "CRC",
      )?.currentBalance,
    ).toBe(90_000);
    expect(writes.find(([ref]) => ref.endsWith("/FCR-3778"))?.[1]).toMatchObject({
      accountId: "BCR",
    });
  });
});
