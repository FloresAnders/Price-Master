import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((...parts: unknown[]) => parts.join("/")),
  collection: vi.fn((...parts: unknown[]) => parts.join("/")),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  getDocs: vi.fn(), getCountFromServer: vi.fn(), limit: vi.fn(), orderBy: vi.fn(),
  query: vi.fn(), startAfter: vi.fn(), where: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

import { runTransaction } from "firebase/firestore";
import { MovimientosFondosService } from "@/services/movimientos-fondos";
import { commitFcrPayments } from "@/app/fondogeneral/utils/invoicePayment/fcrLedgerTransaction";
import type { FacturaMovement } from "@/services/facturas";

const company = "DELIKOR SINAI";
const invoice = (id: string, paidAmount = 0): FacturaMovement => ({
  id, empresa: company, accountId: "FondoGeneral", amount: 27_250,
  originalAmount: 27_250, amountEgreso: 0, amountIngreso: 0,
  balanceDue: 27_250 - paidAmount, paidAmount, createdAt: "2026-09-23T00:00:00.000Z",
  currency: "CRC", invoiceNumber: id, manager: "M", notes: "", invoiceDocType: "FCR",
  paymentType: "FCR", providerCode: "P", paymentStatus: paidAmount ? "PARCIAL" : "PENDIENTE",
});
const storage = (crc: number) => {
  const value = MovimientosFondosService.createEmptyMovementStorage(company);
  value.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")!.currentBalance = crc;
  return value;
};
const application = (id: string, cashDebit: number, totalAppliedToInvoice: number, creditNotes: Array<{ id: string; appliedAmount: number }> = []) => ({
  invoice: invoice(id), cashDebit, totalAppliedToInvoice,
  roundingAbsorbed: totalAppliedToInvoice - cashDebit - creditNotes.reduce((sum, note) => sum + note.appliedAmount, 0),
  appliedCreditNotes: creditNotes.map((note) => ({ ...note, amount: 3_560, currency: "CRC" as const, invoiceNumber: note.id })),
});

describe("commitFcrPayments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("re-reads ledger, invoice and NC on retry, then commits cash and application amounts", async () => {
    const attempts: Array<{ reads: string[]; writes: Array<[string, any]> }> = [];
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
      const attempt = async (crc: number, paid: number) => {
        const reads: string[] = [];
        const writes: Array<[string, any]> = [];
        attempts.push({ reads, writes });
        const result = await callback({
          get: vi.fn(async (ref: string) => {
            reads.push(ref);
            if (ref.includes("MovimientosFondos/") && ref.includes("/movements/")) return { exists: (): boolean => false };
            const data = ref.includes("MovimientosFondos/") ? storage(crc) :
              ref.endsWith("/NC-1") ? { ...invoice("NC-1"), invoiceDocType: "NC", amount: 5_000, originalAmount: 5_000, balanceDue: 5_000 } : invoice("FCR-1", paid);
            return { exists: (): boolean => true, data: () => data };
          }),
          set: vi.fn((ref: string, value: any) => writes.push([ref, value])),
          delete: vi.fn(), update: vi.fn(),
        } as never);
        return result;
      };
      await attempt(103_000, 0);
      return attempt(138_000, 0);
    });
    const result = await commitFcrPayments({ company, accountId: "FondoGeneral", nowISO: "2026-09-23T01:00:00.000Z", applications: [application("FCR-1", 23_000, 27_250, [{ id: "NC-1", appliedAmount: 3_560 }])] });
    expect(attempts).toHaveLength(2);
    for (const attempt of attempts) {
      expect(attempt.reads).toHaveLength(4);
      expect(attempt.reads[0]).toContain("MovimientosFondos/");
      expect(attempt.writes[0]).toBeDefined();
    }
    const committed = attempts[1].writes;
    expect(result.ledger.state.revision).toBe(1);
    expect(result.ledger.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(115_000);
    expect(committed.find(([ref]) => ref.endsWith("/FCR-1"))?.[1]).toMatchObject({ paidAmount: 27_250, balanceDue: 0 });
    expect(committed.find(([ref]) => ref.endsWith("/NC-1"))?.[1]).toMatchObject({ paidAmount: 3_560 });
    expect(result.paymentMovements[0]).toMatchObject({ cashDebit: 23_000, totalAppliedToInvoice: 27_250, roundingAbsorbed: 690, appliedCreditNotes: [{ id: "NC-1", appliedAmount: 3_560 }] });
  });

  it("handles multiple invoices in one ledger transaction", async () => {
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => ref.includes("MovimientosFondos/") && ref.includes("/movements/")
        ? { exists: (): boolean => false }
        : { exists: (): boolean => true, data: () => ref.includes("MovimientosFondos/") ? storage(100_000) : invoice(ref.endsWith("/A") ? "A" : "B") }),
      set: vi.fn(), delete: vi.fn(), update: vi.fn(),
    } as never));
    const result = await commitFcrPayments({ company, accountId: "FondoGeneral", nowISO: "2026-09-23T01:00:00.000Z", applications: [application("A", 10_000, 10_000), application("B", 5_000, 5_000)] });
    expect(result.paymentMovements).toHaveLength(2);
    expect(result.ledger.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(85_000);
    expect(result.ledger.state.revision).toBe(2);
  });

  it("allows credit-note-only payment without cash movement", async () => {
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => ({ exists: (): boolean => true, data: () => ref.includes("MovimientosFondos/") ? storage(100_000) : ref.endsWith("/NC-1") ? { ...invoice("NC-1"), invoiceDocType: "NC" } : invoice("FCR-1") })),
      set: vi.fn(), delete: vi.fn(), update: vi.fn(),
    } as never));
    const result = await commitFcrPayments({ company, accountId: "FondoGeneral", nowISO: "2026-09-23T01:00:00.000Z", applications: [application("FCR-1", 0, 3_560, [{ id: "NC-1", appliedAmount: 3_560 }])] });
    expect(result.paymentMovements).toHaveLength(0);
    expect(result.ledger.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(100_000);
    expect(result.ledger.state).toMatchObject({ revision: 1, lastChange: { kind: "invoice-payment", invoiceId: "FCR-1", revision: 1 } });
  });

  it("uses one unique movement ID across retries and reads it before writing", async () => {
    const attempts: Array<{ reads: string[]; writes: Array<[string, unknown]>; events: string[] }> = [];
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
      const attempt = async () => {
        const reads: string[] = [];
        const writes: Array<[string, unknown]> = [];
        const events: string[] = [];
        attempts.push({ reads, writes, events });
        return callback({
          get: vi.fn(async (ref: string) => {
            reads.push(ref);
            events.push(`read:${ref}`);
            if (ref.includes("MovimientosFondos/") && ref.includes("/movements/")) return { exists: (): boolean => false };
            return { exists: (): boolean => true, data: () => ref.includes("MovimientosFondos/") ? storage(100_000) : invoice("FCR-1") };
          }),
          set: vi.fn((ref: string, value: unknown) => { events.push(`write:${ref}`); writes.push([ref, value]); }),
          delete: vi.fn(), update: vi.fn(),
        } as never);
      };
      await attempt();
      return attempt();
    });
    await commitFcrPayments({ company, accountId: "FondoGeneral", nowISO: "2026-09-23T01:00:00.000Z", applications: [application("FCR-1", 5_000, 5_000)] });
    const movementRef = attempts[1].writes.find(([ref]) => ref.includes("MovimientosFondos/") && ref.includes("/movements/"))?.[0];
    expect(movementRef).toBeDefined();
    expect(attempts[0].writes.find(([ref]) => ref.includes("MovimientosFondos/") && ref.includes("/movements/"))?.[0]).toBe(movementRef);
    expect(attempts[1].reads).toContain(movementRef);
    for (const attempt of attempts) {
      expect(attempt.events.findIndex((event) => event.startsWith("write:"))).toBe(attempt.reads.length);
    }
  });

  it("rejects an existing payment movement before any write", async () => {
    const set = vi.fn();
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => ({ exists: (): boolean => true, data: () => ref.includes("MovimientosFondos/") ? storage(100_000) : invoice("FCR-1") })),
      set, delete: vi.fn(), update: vi.fn(),
    } as never));
    await expect(commitFcrPayments({ company, accountId: "FondoGeneral", nowISO: "2026-09-23T01:00:00.000Z", applications: [application("FCR-1", 5_000, 5_000)] })).rejects.toThrow("FCR_PAYMENT_ID_COLLISION");
    expect(set).not.toHaveBeenCalled();
  });

  it("uses different payment IDs for separate calls sharing the same server timestamp", async () => {
    const refs: string[] = [];
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => ref.includes("MovimientosFondos/") && ref.includes("/movements/")
        ? { exists: (): boolean => false }
        : { exists: (): boolean => true, data: () => ref.includes("MovimientosFondos/") ? storage(100_000) : invoice("FCR-1") }),
      set: vi.fn((ref: string) => { if (ref.includes("MovimientosFondos/") && ref.includes("/movements/")) refs.push(ref); }),
      delete: vi.fn(), update: vi.fn(),
    } as never));
    const input = { company, accountId: "FondoGeneral" as const, nowISO: "2026-09-23T01:00:00.000Z", applications: [application("FCR-1", 5_000, 5_000)] };
    await commitFcrPayments(input);
    await commitFcrPayments(input);
    expect(refs).toHaveLength(2);
    expect(refs[0]).not.toBe(refs[1]);
  });

  it("rejects a collision with a manual NC document before any write", async () => {
    const set = vi.fn();
    const manual = { ...invoice("manual-nc-1"), invoiceDocType: "NC" as const, amount: 1_000, originalAmount: 1_000 };
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => {
        if (ref.includes("MovimientosFondos/") && ref.includes("/movements/")) return { exists: (): boolean => false };
        if (ref.endsWith("/manual-nc-1")) return { exists: (): boolean => true, data: () => manual };
        return { exists: (): boolean => true, data: () => ref.includes("MovimientosFondos/") ? storage(100_000) : invoice("FCR-1") };
      }),
      set, delete: vi.fn(), update: vi.fn(),
    } as never));
    await expect(commitFcrPayments({
      company, accountId: "FondoGeneral", nowISO: "2026-09-23T01:00:00.000Z",
      applications: [{ ...application("FCR-1", 5_000, 6_000, [{ id: "manual-nc-1", appliedAmount: 1_000 }]), manualCreditNoteMovements: [manual] }],
    })).rejects.toThrow("FCR_CREDIT_NOTE_ID_COLLISION");
    expect(set).not.toHaveBeenCalled();
  });

  it.each([
    { currency: "USD", providerCode: "P" },
    { currency: "CRC", providerCode: "OTHER" },
  ])("rejects changed persisted NC identity %j before writes", async ({ currency, providerCode }) => {
    const set = vi.fn();
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => {
        if (ref.includes("MovimientosFondos/") && ref.includes("/movements/")) return { exists: (): boolean => false };
        const data = ref.includes("MovimientosFondos/") ? storage(100_000) : ref.endsWith("/NC-1")
          ? { ...invoice("NC-1"), invoiceDocType: "NC", amount: 5_000, originalAmount: 5_000, currency, providerCode }
          : invoice("FCR-1");
        return { exists: (): boolean => true, data: () => data };
      }),
      set, delete: vi.fn(), update: vi.fn(),
    } as never));
    await expect(commitFcrPayments({ company, accountId: "FondoGeneral", nowISO: "2026-09-23T01:00:00.000Z", applications: [application("FCR-1", 1_440, 5_000, [{ id: "NC-1", appliedAmount: 3_560 }])] })).rejects.toThrow("FCR_CREDIT_NOTE_CHANGED");
    expect(set).not.toHaveBeenCalled();
  });
});
