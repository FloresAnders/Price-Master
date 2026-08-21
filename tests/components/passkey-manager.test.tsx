// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PasskeyManagerModal from "@/components/auth/PasskeyManagerModal";

const { registerPasskey } = vi.hoisted(() => ({ registerPasskey: vi.fn() }));

vi.mock("@/lib/passkeys/client", () => ({ registerPasskey }));

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const activePasskey = {
  id: "credential-hash",
  label: "Teléfono personal",
  deviceType: "multiDevice",
  backedUp: true,
  createdAt: new Date(2026, 7, 15, 10, 0).getTime(),
  lastUsedAt: new Date(2026, 7, 15, 15, 40).getTime(),
  revokedAt: null,
};

describe("passkey manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lists passkeys and explains whether they are synchronized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: true, passkeys: [activePasskey] })),
    );

    render(<PasskeyManagerModal isOpen onClose={() => undefined} />);

    expect(await screen.findByText("Teléfono personal")).toBeVisible();
    expect(screen.getByText("Sincronizada")).toBeVisible();
    expect(screen.getByText(/Último uso:/)).toBeVisible();
  });

  it("renames a passkey", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, passkeys: [activePasskey] }))
      .mockResolvedValueOnce(
        response({
          ok: true,
          passkey: { ...activePasskey, label: "OnePlus 13R" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<PasskeyManagerModal isOpen onClose={() => undefined} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Renombrar Teléfono personal" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre de la passkey"), {
      target: { value: "OnePlus 13R" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));

    expect(await screen.findByText("OnePlus 13R")).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/passkeys/credential-hash",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        body: JSON.stringify({ label: "OnePlus 13R" }),
      }),
    );
  });

  it("asks for confirmation and revokes the selected passkey", async () => {
    const revoked = { ...activePasskey, revokedAt: Date.now() };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, passkeys: [activePasskey] }))
      .mockResolvedValueOnce(response({ ok: true, passkey: revoked }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PasskeyManagerModal isOpen onClose={() => undefined} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Revocar Teléfono personal" }),
    );

    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText("Revocada")).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/passkeys/credential-hash",
      expect.objectContaining({ method: "DELETE", credentials: "same-origin" }),
    );
  });

  it("requests a fresh password before adding a passkey", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, passkeys: [] }))
      .mockResolvedValueOnce(response({ ok: true, enrollmentGrantId: "grant-1" }))
      .mockResolvedValueOnce(response({ ok: true, passkeys: [activePasskey] }));
    vi.stubGlobal("fetch", fetchMock);
    registerPasskey.mockResolvedValue(activePasskey);
    render(<PasskeyManagerModal isOpen onClose={() => undefined} />);

    expect(await screen.findByText("Aún no tienes passkeys registradas.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Agregar passkey" }));
    fireEvent.change(screen.getByLabelText("Contraseña actual"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar y registrar" }));

    await waitFor(() => expect(registerPasskey).toHaveBeenCalledWith("grant-1"));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/passkeys/reauth",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ password: "secret" }),
      }),
    );
  });

  it("loads a selected user for superadmin without offering enrollment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ ok: true, passkeys: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PasskeyManagerModal
        isOpen
        onClose={() => undefined}
        targetUserId="user-2"
        targetUserName="USUARIO DOS"
      />,
    );

    expect(await screen.findByText("Passkeys de USUARIO DOS")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/passkeys?userId=user-2",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(
      screen.queryByRole("button", { name: "Agregar passkey" }),
    ).not.toBeInTheDocument();
  });
});
