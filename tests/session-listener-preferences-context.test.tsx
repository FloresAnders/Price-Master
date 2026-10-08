// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  setPreference: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/services/layoutPrefsDb", () => ({
  DEFAULT_SESSION_LISTENER_PREFERENCES: {
    pendingCompanyRequests: false,
    chatReadMuteState: false,
  },
  getSessionListenerPreferences: mocks.getPreferences,
  setSessionListenerPreference: mocks.setPreference,
}));

import {
  SessionListenerPreferencesProvider,
  useSessionListenerPreferences,
} from "@/contexts/SessionListenerPreferencesContext";

function PreferenceHarness() {
  const { loaded, preferences, setPreference } =
    useSessionListenerPreferences();
  const enabled = preferences.pendingCompanyRequests;

  return (
    <div>
      <span>{loaded ? (enabled ? "enabled" : "disabled") : "loading"}</span>
      <button
        type="button"
        onClick={() => {
          void setPreference("pendingCompanyRequests", !enabled).catch(() => {});
        }}
      >
        toggle
      </button>
    </div>
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("SessionListenerPreferencesProvider", () => {
  beforeEach(() => {
    mocks.getPreferences.mockReset();
    mocks.setPreference.mockReset();
  });

  afterEach(() => cleanup());

  it("applies an enabled preference immediately, before IndexedDB finishes", async () => {
    const write = deferred();
    mocks.getPreferences.mockResolvedValue({
      pendingCompanyRequests: false,
      chatReadMuteState: false,
    });
    mocks.setPreference.mockReturnValue(write.promise);

    render(
      <SessionListenerPreferencesProvider>
        <PreferenceHarness />
      </SessionListenerPreferencesProvider>,
    );
    await screen.findByText("disabled");

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByText("enabled")).toBeTruthy();

    write.resolve();
    await waitFor(() => expect(mocks.setPreference).toHaveBeenCalledTimes(1));
  });

  it("fails closed if persisting an enabled preference fails", async () => {
    const write = deferred();
    mocks.getPreferences.mockResolvedValue({
      pendingCompanyRequests: false,
      chatReadMuteState: false,
    });
    mocks.setPreference.mockReturnValue(write.promise);

    render(
      <SessionListenerPreferencesProvider>
        <PreferenceHarness />
      </SessionListenerPreferencesProvider>,
    );
    await screen.findByText("disabled");
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByText("enabled")).toBeTruthy();

    write.reject(new Error("IndexedDB unavailable"));
    await screen.findByText("disabled");
  });

  it("keeps a disabled preference off if persisting it fails", async () => {
    const write = deferred();
    mocks.getPreferences.mockResolvedValue({
      pendingCompanyRequests: true,
      chatReadMuteState: false,
    });
    mocks.setPreference.mockReturnValue(write.promise);

    render(
      <SessionListenerPreferencesProvider>
        <PreferenceHarness />
      </SessionListenerPreferencesProvider>,
    );
    await screen.findByText("enabled");
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByText("disabled")).toBeTruthy();

    write.reject(new Error("IndexedDB unavailable"));
    await waitFor(() => expect(screen.getByText("disabled")).toBeTruthy());
  });
});
