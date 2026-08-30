import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  collection: vi.fn((...args: unknown[]) => ({ kind: "collection", args })),
  deleteDoc: vi.fn(),
  doc: vi.fn((...args: unknown[]) => ({ kind: "doc", args })),
  getDocs: vi.fn(),
  limit: vi.fn((value: number) => ({ kind: "limit", value })),
  orderBy: vi.fn((field: string, direction: string) => ({
    kind: "orderBy",
    field,
    direction,
  })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({
    ref,
    constraints,
  })),
  setDoc: vi.fn(),
  startAfter: vi.fn((cursor: unknown) => ({ kind: "startAfter", cursor })),
  where: vi.fn((field: string, operator: string, value: unknown) => ({
    kind: "where",
    field,
    operator,
    value,
  })),
}));

vi.mock("@/config/firebase", () => ({ db: { kind: "database" } }));
vi.mock("firebase/firestore", () => firestore);

import { FacturasService } from "@/services/facturas";

const movementData = {
  empresa: "ACME",
  accountId: "FondoGeneral",
  amount: 100,
  amountEgreso: 100,
  amountIngreso: 0,
  createdAt: "2026-08-29T10:00:00.000Z",
  currency: "CRC",
  invoiceNumber: "1001",
  manager: "Ana",
  notes: "",
  invoiceDocType: "FCR",
  paymentType: "COMPRA INVENTARIO",
  providerCode: "0001",
  paymentStatus: "PENDIENTE",
  isPendingForClosing: true,
};

describe("pending invoice index query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries only indexed pending documents and caps a page at 50", async () => {
    const lastDoc = { id: "FAC-1", data: () => movementData };
    firestore.getDocs.mockResolvedValue({ docs: [lastDoc] });

    const page = await FacturasService.listPendingForClosingPage("ACME", {
      pageSize: 100,
    });

    expect(firestore.where).toHaveBeenCalledWith(
      "isPendingForClosing",
      "==",
      true,
    );
    expect(firestore.orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(firestore.limit).toHaveBeenCalledWith(50);
    expect(page.items.map((item) => item.id)).toEqual(["FAC-1"]);
    expect(page.cursor).toBe(lastDoc);
    expect(page.exhausted).toBe(true);
  });

  it("continues after the previous page cursor", async () => {
    const cursor = { id: "FAC-50" };
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await FacturasService.listPendingForClosingPage("ACME", {
      pageSize: 25,
      cursor: cursor as never,
    });

    expect(firestore.startAfter).toHaveBeenCalledWith(cursor);
    expect(firestore.limit).toHaveBeenCalledWith(25);
  });
});
