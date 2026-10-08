// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CashOpeningModal from "@/app/fondogeneral/components/modals/CashOpeningModal";

afterEach(cleanup);

const renderModal = (required: boolean, onClose = vi.fn()) => {
  const result = render(
    <CashOpeningModal
      open
      required={required}
      onClose={onClose}
      onConfirm={vi.fn()}
      initialValues={{
        openingDate: "2026-10-08T21:46:00.000Z",
        manager: "Encargado",
        notes: "",
        totalCRC: 0,
        totalUSD: 0,
        breakdownCRC: {},
        breakdownUSD: {},
      }}
      employees={["Encargado"]}
      loadingEmployees={false}
      currentBalanceCRC={0}
      currentBalanceUSD={0}
    />,
  );
  return { ...result, onClose };
};

describe("CashOpeningModal required mode", () => {
  it("cannot be dismissed with Escape, backdrop, or a close button", () => {
    const { onClose } = renderModal(true);

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cerrar modal" })).toBeNull();
    expect(screen.getByText(/apertura es obligatoria/i)).toBeTruthy();
  });

  it("keeps the existing dismiss behavior when the opening is not mandatory", () => {
    const { onClose } = renderModal(false);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cerrar modal" })).toBeTruthy();
  });
});
