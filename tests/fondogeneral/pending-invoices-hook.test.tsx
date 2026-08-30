// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listPendingPage = vi.hoisted(() => vi.fn());

vi.mock("@/services/facturas", () => ({
  FacturasService: {
    listPendingForClosingPage: listPendingPage,
  },
}));

import { usePendingClosingCreditInvoices } from "@/app/fondogeneral/hooks/usePendingClosingCreditInvoices";

const movement = (
  id: string,
  invoiceDocType: "FCR" | "NC",
  amount = 100,
) => ({
  id,
  empresa: "ACME",
  accountId: "FondoGeneral",
  amount,
  amountEgreso: amount,
  amountIngreso: 0,
  createdAt: "2026-08-29T10:00:00.000Z",
  currency: "CRC",
  invoiceNumber: id,
  manager: "Ana",
  notes: "",
  invoiceDocType,
  paymentType: "COMPRA INVENTARIO",
  providerCode: "0001",
  paymentStatus: "PENDIENTE",
  isPendingForClosing: true,
});

describe("usePendingClosingCreditInvoices", () => {
  beforeEach(() => {
    listPendingPage.mockReset();
  });

  it("stays idle until enabled and then loads deduplicated 50-item pages", async () => {
    const firstCursor = { id: "NC-0" };
    listPendingPage
      .mockResolvedValueOnce({
        items: [
          movement("FCR-1", "FCR"),
          movement("NC-1", "NC"),
          movement("NC-0", "NC", 0),
        ],
        cursor: firstCursor,
        exhausted: false,
      })
      .mockResolvedValueOnce({
        items: [movement("FCR-1", "FCR"), movement("FCR-2", "FCR")],
        cursor: { id: "FCR-2" },
        exhausted: true,
      });

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        usePendingClosingCreditInvoices({ company: "ACME", enabled }),
      { initialProps: { enabled: false } },
    );

    expect(listPendingPage).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.pendingClosingCreditInvoices).toHaveLength(1);
    });
    expect(result.current.pendingCreditNotes).toHaveLength(2);
    expect(result.current.pendingZeroAmountCreditNotes).toHaveLength(1);
    expect(result.current.hasMorePendingInvoices).toBe(true);
    expect(listPendingPage).toHaveBeenNthCalledWith(1, "ACME", {
      pageSize: 50,
      cursor: null,
    });

    await act(async () => {
      await result.current.loadMorePendingInvoices();
    });

    expect(result.current.pendingClosingCreditInvoices.map(({ id }) => id)).toEqual([
      "FCR-1",
      "FCR-2",
    ]);
    expect(result.current.hasMorePendingInvoices).toBe(false);
    expect(listPendingPage).toHaveBeenNthCalledWith(2, "ACME", {
      pageSize: 50,
      cursor: firstCursor,
    });
  });
});
