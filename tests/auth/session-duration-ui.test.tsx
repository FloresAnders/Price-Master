// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FloatingSessionTimer from "@/components/session/FloatingSessionTimer";
import SecuritySettings from "@/components/auth/SecuritySettings";

const authState = vi.hoisted(() => ({
  user: { id: "admin-1", name: "ADMIN", role: "admin" as const },
  useTokenAuth: false,
  getFormattedTimeLeft: vi.fn(() => "5h 0m"),
  getSessionTimeLeft: vi.fn(() => 5),
  isSuperAdmin: vi.fn(() => true),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/services/tokenService", () => ({
  TokenService: {
    getTokenInfo: vi.fn(() => ({ isValid: false, timeLeft: 0 })),
  },
}));

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: vi.fn() }),
}));

describe("role-based session duration UI", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a new five-hour admin session as fully remaining", async () => {
    render(
      <FloatingSessionTimer
        visible
        onToggleVisibility={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByText("5h 0m"));

    expect(await screen.findByText("100.0% restante")).toBeVisible();
  });

  it("uses five hours as the security-settings default for administrators", () => {
    render(<SecuritySettings />);

    const adminInput = screen
      .getByText("Admin (horas)")
      .parentElement?.querySelector("input");

    expect(adminInput).toHaveValue(5);
  });
});
