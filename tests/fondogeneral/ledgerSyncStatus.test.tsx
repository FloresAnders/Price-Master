// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LedgerSyncStatus } from "@/app/fondogeneral/components/LedgerSyncStatus";

afterEach(cleanup);

describe("LedgerSyncStatus", () => {
  it.each([
    ["connecting", "Sincronizando saldo…"],
    ["synced", "Saldo actualizado"],
    ["offline", "Saldo sin conexión"],
    ["error", "No se pudo sincronizar el saldo"],
  ] as const)("announces %s without blocking the balance controls", (status, label) => {
    render(<LedgerSyncStatus status={status} />);
    expect(screen.getByRole("status", { name: label })).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    if (status === "error") expect(screen.queryByText("Saldo actualizado")).toBeNull();
  });

  it("keeps the synced state visually muted", () => {
    render(<LedgerSyncStatus status="synced" />);
    expect(screen.getByRole("status").className).toContain("text-[var(--muted-foreground)]");
  });

  it("animates connecting only when motion is allowed", () => {
    render(<LedgerSyncStatus status="connecting" />);
    expect(screen.getByRole("status").querySelector("[aria-hidden]")?.className).toContain("motion-safe:animate-pulse");
  });
});
