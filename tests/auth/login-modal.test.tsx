// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginModal from "@/components/auth/LoginModal";

const {
  authenticateWithPasskey,
  registerPasskey,
  getPasskeyPreference,
  isPasskeySupported,
} = vi.hoisted(() => ({
  authenticateWithPasskey: vi.fn(),
  registerPasskey: vi.fn(),
  getPasskeyPreference: vi.fn(),
  isPasskeySupported: vi.fn(),
}));

vi.mock("@/lib/passkeys/client", () => ({
  authenticateWithPasskey,
  registerPasskey,
  isPasskeySupported,
  PasskeyClientError: class PasskeyClientError extends Error {},
}));

vi.mock("@/lib/passkeys/preference.client", () => ({
  getPasskeyPreference,
}));

vi.mock("@/hooks/useVersion", () => ({
  useVersion: () => ({ version: "1.0.0", isLocalNewer: false, dbVersion: "1.0.0" }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} />
  ),
}));

vi.mock("@/components/auth/PasswordRecoveryModal", () => ({
  PasswordRecoveryModal: () => null,
}));

const user = {
  id: "user-1",
  name: "ALCHACAS",
  role: "user" as const,
};

function renderLogin(onLoginSuccess = vi.fn()) {
  render(
    <LoginModal
      isOpen
      onClose={() => undefined}
      onLoginSuccess={onLoginSuccess}
      title="Time Master"
      canClose={false}
    />,
  );
  return onLoginSuccess;
}

describe("reformulated passkey login", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    isPasskeySupported.mockReturnValue(true);
    getPasskeyPreference.mockResolvedValue({
      passkeyAvailable: false,
      lastSuccessfulUse: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows password login and opt-in activation on a new browser", async () => {
    renderLogin();

    expect(await screen.findByLabelText("Usuario")).toBeVisible();
    expect(screen.getByLabelText("Contraseña")).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "Mantener sesión activa" }),
    ).toBeChecked();
    expect(screen.queryByText("Recordar usuario")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Activar passkey en este dispositivo",
      }),
    ).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Regístrese/ })).toBeDisabled();
    expect(screen.getByText("Próximamente")).toBeVisible();
  });

  it("removes the legacy remembered username without restoring it", async () => {
    localStorage.setItem("timemaster_remembered_user", "ALCHACAS");

    renderLogin();

    expect(await screen.findByLabelText("Usuario")).toHaveValue("");
    expect(localStorage.getItem("timemaster_remembered_user")).toBeNull();
  });

  it("uses passkey as the primary launcher when IndexedDB marks it active", async () => {
    getPasskeyPreference.mockResolvedValue({
      passkeyAvailable: true,
      lastSuccessfulUse: 1,
    });

    renderLogin();

    expect(
      await screen.findByRole("button", { name: "Ingresar con biometría" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Usuario")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ingresar con contraseña" }));

    expect(screen.getByLabelText("Usuario")).toBeVisible();
    expect(screen.getByLabelText("Contraseña")).toBeVisible();
  });

  it("authenticates with a discoverable passkey and reports the user", async () => {
    getPasskeyPreference.mockResolvedValue({
      passkeyAvailable: true,
      lastSuccessfulUse: 1,
    });
    authenticateWithPasskey.mockResolvedValue(user);
    const onLoginSuccess = renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: "Ingresar con biometría" }),
    );

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(user));
  });

  it("registers a passkey after the first successful password login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, user, enrollmentGrantId: "grant-1" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    registerPasskey.mockResolvedValue({ id: "credential-hash", label: "Este dispositivo" });
    const onLoginSuccess = renderLogin();
    await screen.findByLabelText("Usuario");

    fireEvent.change(screen.getByLabelText("Usuario"), {
      target: { value: "ALCHACAS" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "secret" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Activar passkey en este dispositivo",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => expect(registerPasskey).toHaveBeenCalledWith("grant-1"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        credentials: "same-origin",
        body: JSON.stringify({
          username: "ALCHACAS",
          password: "secret",
          enrollPasskey: true,
          keepSessionActive: true,
        }),
      }),
    );
    expect(onLoginSuccess).toHaveBeenCalledWith(user);
  });

  it("requests a fixed session when the active-session toggle is disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, user }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderLogin();
    await screen.findByLabelText("Usuario");

    fireEvent.change(screen.getByLabelText("Usuario"), {
      target: { value: "ALCHACAS" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "secret" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Mantener sesión activa" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        body: JSON.stringify({
          username: "ALCHACAS",
          password: "secret",
          enrollPasskey: false,
          keepSessionActive: false,
        }),
      }),
    );
  });
});
