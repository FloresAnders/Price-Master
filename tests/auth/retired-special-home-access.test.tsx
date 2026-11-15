// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

describe("legacy /home route", () => {
  it("redirects to normal authentication even when a forged special session exists", async () => {
    window.localStorage.setItem(
      "timemaster_session",
      JSON.stringify({
        id: "special-user-sebastian",
        isSpecialUser: true,
        role: "superadmin",
        permissions: { mantenimiento: true },
      }),
    );

    const { default: LegacyHomePage } = await import("@/app/home/page");
    render(<LegacyHomePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
