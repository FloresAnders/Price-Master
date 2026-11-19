// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("removes the entrance delay before account selection interactions", () => {
    vi.useFakeTimers();
    render(<FondoPage />);

    const group = screen.getByRole("group", { name: "Cuentas" });
    const bcrButton = within(group)
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("BCR"));

    expect(bcrButton?.parentElement?.style.transitionDelay).toBe("70ms");

    act(() => vi.advanceTimersByTime(80));

    expect(bcrButton?.parentElement?.style.transitionDelay).toBe("0ms");
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
