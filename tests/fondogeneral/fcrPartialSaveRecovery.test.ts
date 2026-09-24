import { describe, expect, it, vi } from "vitest";
import { reportFcrPaymentAfterMainSaveFailure } from "@/app/fondogeneral/utils/invoicePayment/fcrPartialSaveRecovery";

describe("FCR payment after main movement save failure", () => {
  it("identifies the committed main movement and directs safe invoice-only retry", () => {
    const showToast = vi.fn();
    const clearSelection = vi.fn();
    const setRecovery = vi.fn();
    reportFcrPaymentAfterMainSaveFailure({
      company: "DELIKOR SINAI",
      mainMovementId: "main-123",
      invoiceNumbers: ["F-1", "F-2"],
      showToast,
      clearSelection,
      setRecovery,
    });
    expect(clearSelection).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("main-123"), "error", expect.any(Number),
    );
    expect(showToast.mock.calls[0][0]).toContain("F-1, F-2");
    expect(showToast.mock.calls[0][0]).toContain("Facturas");
    expect(showToast.mock.calls[0][0]).toContain("No vuelva a guardar el movimiento");
    expect(setRecovery).toHaveBeenCalledWith({
      company: "DELIKOR SINAI", mainMovementId: "main-123", invoiceNumbers: ["F-1", "F-2"],
    });
  });
});
