// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setPreference: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "regular-user", name: "Usuario", role: "user" },
    updateCurrentUser: vi.fn(),
  }),
}));
vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: mocks.showToast }),
}));
vi.mock("@/contexts/SessionListenerPreferencesContext", () => ({
  useSessionListenerPreferences: () => ({
    preferences: {
      pendingCompanyRequests: false,
      chatReadMuteState: false,
    },
    loaded: true,
    setPreference: mocks.setPreference,
  }),
}));
vi.mock("@/components/session/TokenInfo", () => ({
  default: () => <div>Token info</div>,
}));

import ConfigurationModal from "@/components/modals/ConfigurationModal";

describe("ConfigurationModal session listener permissions", () => {
  beforeEach(() => {
    mocks.setPreference.mockReset();
    mocks.setPreference.mockResolvedValue(undefined);
    mocks.showToast.mockReset();
  });

  afterEach(() => cleanup());

  it("shows both off-by-default listener switches to a regular user", () => {
    render(
      <ConfigurationModal
        isOpen
        onClose={vi.fn()}
        showSessionTimer={false}
        onToggleSessionTimer={vi.fn()}
        showCalculator={false}
        onToggleCalculator={vi.fn()}
        showCashCounterFloating={false}
        onToggleCashCounterFloating={vi.fn()}
        showSupplierWeekInMenu={false}
        onToggleSupplierWeekInMenu={vi.fn()}
        enableHomeMenuSortMobile={false}
        onToggleHomeMenuSortMobile={vi.fn()}
        onLogoutClick={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /permisos de sesión/i }),
    );

    expect(
      (
        screen.getByRole("checkbox", {
          name: "Solicitudes pendientes de la empresa",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Estado de lectura/silencio del chat",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
    expect(screen.getByText(/Escucha solicitudes nuevas/i)).toBeTruthy();
    expect(screen.getByText(/Sincroniza mensajes leídos/i)).toBeTruthy();
  });

  it("persists a changed listener switch", async () => {
    render(
      <ConfigurationModal
        isOpen
        onClose={vi.fn()}
        showSessionTimer={false}
        onToggleSessionTimer={vi.fn()}
        showCalculator={false}
        onToggleCalculator={vi.fn()}
        showCashCounterFloating={false}
        onToggleCashCounterFloating={vi.fn()}
        showSupplierWeekInMenu={false}
        onToggleSupplierWeekInMenu={vi.fn()}
        enableHomeMenuSortMobile={false}
        onToggleHomeMenuSortMobile={vi.fn()}
        onLogoutClick={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /permisos de sesión/i }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Solicitudes pendientes de la empresa",
      }),
    );

    await waitFor(() => {
      expect(mocks.setPreference).toHaveBeenCalledWith(
        "pendingCompanyRequests",
        true,
      );
    });
  });
});
