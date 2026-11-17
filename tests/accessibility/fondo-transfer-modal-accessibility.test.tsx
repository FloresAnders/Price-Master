// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FondoTransferModal } from "@/app/fondogeneral/components/FondoTransferModal";
import type { FondoAccountTab } from "@/lib/fondoAccountTabs";

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/services/cashCounterDb", () => ({
  getOrCreateCashCounterSnapshot: vi.fn().mockResolvedValue({ counters: [] }),
}));

vi.mock("@/services/empresas", () => ({
  EmpresasService: { getAllEmpresas: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/services/schedules", () => ({
  SchedulesService: {
    getSchedulesByLocationYearMonth: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/services/providers", () => ({
  ProvidersService: {
    getProviders: vi.fn().mockResolvedValue([
      {
        code: "SAL-1",
        name: "Proveedor Salida",
        company: "Acme",
        category: "Egreso",
      },
      {
        code: "BCR-1",
        name: "Proveedor BCR",
        company: "Acme",
        accountId: "BCR",
      },
    ]),
  },
}));

vi.mock("@/components/business/cash-counter-tabs/accountCounters", () => ({
  resolveAvailableCashTransferBreakdown: vi.fn().mockReturnValue(null),
  transferCashCounterAmount: vi.fn(),
}));

const accounts: FondoAccountTab[] = [
  {
    id: "fondo",
    label: "Fondo General",
    namespace: "fg",
    accountId: "FondoGeneral",
    permission: "fondogeneral",
  },
  {
    id: "bcr",
    label: "Cuenta BCR",
    namespace: "bcr",
    accountId: "BCR",
    permission: "fondogeneralBCR",
  },
];

describe("FondoTransferModal accessibility", () => {
  beforeEach(() => {
    window.localStorage.setItem("fg_selected_company_shared", "Acme");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("navigates provider comboboxes with arrows, Enter and Escape", async () => {
    render(
      <FondoTransferModal
        open
        accounts={accounts}
        initialAccountId="FondoGeneral"
        userName="Ana"
        companyKey="Acme"
        onClose={vi.fn()}
      />,
    );

    const source = screen.getByRole("combobox", {
      name: "Proveedor de salida",
    });
    fireEvent.focus(source);
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Proveedor Salida (SAL-1)" }),
      ).toBeTruthy(),
    );

    fireEvent.keyDown(source, { key: "ArrowDown" });
    expect(source.getAttribute("aria-activedescendant")).toBeTruthy();
    fireEvent.keyDown(source, { key: "Enter" });
    expect((source as HTMLInputElement).value).toBe(
      "Proveedor Salida (SAL-1)",
    );

    const destination = screen.getByRole("combobox", {
      name: "Proveedor de destino",
    });
    fireEvent.keyDown(destination, { key: "Escape" });
    expect(destination.getAttribute("aria-expanded")).toBe("false");
  });
});
