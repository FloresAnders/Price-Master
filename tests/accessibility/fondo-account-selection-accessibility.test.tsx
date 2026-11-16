// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FondoPage from "@/app/fondogeneral/page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    user: {
      name: "Ada",
      role: "superadmin",
      permissions: {
        fondogeneral: true,
        fondogeneralBCR: true,
        fondogeneralBN: true,
        fondogeneralBAC: true,
        cajaNegra: true,
        tucan: true,
        tiempos: true,
      },
    },
  }),
}));

vi.mock("@/app/fondogeneral/hooks/useFondoGeneralTabLock", () => ({
  useFondoGeneralTabLock: () => "owner",
}));

vi.mock("@/components/business/cash-counter-tabs/hooks/useFondoAccountCashCounters", () => ({
  useFondoAccountCashCounters: () => ({}),
}));

vi.mock("@/app/fondogeneral/components", () => ({
  FondoSection: () => <section aria-label="Contenido de cuenta" />,
}));

vi.mock("@/app/fondogeneral/components/modals/DuplicateFondoGeneralModal", () => ({
  default: () => null,
}));

vi.mock("@/app/fondogeneral/components/FondoTransferModal", () => ({
  FondoTransferModal: () => null,
}));

describe("Fondo account selection", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("keeps every account keyboard-reachable without claiming tab semantics", () => {
    render(<FondoPage />);

    const group = screen.getByRole("group", { name: "Cuentas" });
    const accountButtons = within(group)
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-pressed"));

    expect(accountButtons).toHaveLength(7);
    accountButtons.forEach((button) => expect(button.tabIndex).toBe(0));

    const bcrButton = accountButtons.find((button) =>
      button.textContent?.includes("BCR"),
    );
    expect(bcrButton).toBeDefined();
    fireEvent.click(bcrButton!);

    expect(bcrButton!.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });
});
