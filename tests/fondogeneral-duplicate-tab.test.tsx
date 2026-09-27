// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  permissions: {
    fondogeneral: true,
    fondogeneralBCR: true,
    fondogeneralBN: true,
    fondogeneralBAC: true,
    cajaNegra: true,
    tucan: true,
    tiempos: true,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    user: {
      role: "admin",
      permissions: authState.permissions,
    },
  }),
}));

vi.mock("@/app/fondogeneral/components", () => ({
  FondoSection: ({ namespace }: { namespace: string }) => (
    <div data-testid="fondo-section">namespace-{namespace}</div>
  ),
}));

import FondoPage from "@/app/fondogeneral/page";

function installUnavailableLockManager() {
  const request = vi.fn(
    (
      _name: string,
      options: LockOptions,
      callback: (lock: Lock | null) => unknown,
    ) => {
      if (options.ifAvailable) {
        return Promise.resolve(callback(null));
      }

      return new Promise(() => undefined);
    },
  );

  Object.defineProperty(window.navigator, "locks", {
    configurable: true,
    value: { request },
  });
}

describe("proteccion contra Fondo General duplicado", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#fondogeneral";
    authState.permissions = {
      fondogeneral: true,
      fondogeneralBCR: true,
      fondogeneralBN: true,
      fondogeneralBAC: true,
      cajaNegra: true,
      tucan: true,
      tiempos: true,
    };
    installUnavailableLockManager();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("muestra el modal con Atrás y Ok! sin montar la cuenta duplicada", async () => {
    render(<FondoPage />);

    expect(
      await screen.findByRole("dialog", {
        name: "Fondo General duplicado",
      }),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Atrás" })).not.toBeNull();
    expect(
      (screen.getByRole("button", { name: "Ok!" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(screen.queryByTestId("fondo-section")).toBeNull();
  });

  it("Ok! abre aleatoriamente otra cuenta disponible", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.51);
    render(<FondoPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Ok!" }));

    await waitFor(() => {
      expect(screen.getByTestId("fondo-section").textContent).toContain(
        "namespace-cn",
      );
    });
    expect(
      screen.queryByRole("dialog", { name: "Fondo General duplicado" }),
    ).toBeNull();
  });

  it("Atrás vuelve al home", async () => {
    render(<FondoPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Atrás" }));

    expect(window.location.hash).toBe("");
  });

  it("deshabilita Ok! cuando no existe otra cuenta disponible", async () => {
    authState.permissions = {
      fondogeneral: true,
      fondogeneralBCR: false,
      fondogeneralBN: false,
      fondogeneralBAC: false,
      cajaNegra: false,
      tucan: false,
      tiempos: false,
    };
    render(<FondoPage />);

    expect(
      (await screen.findByRole("button", {
        name: "Ok!",
      })) as HTMLButtonElement,
    ).toHaveProperty("disabled", true);
  });
});
