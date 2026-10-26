// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SEASONAL_EFFECTS_SETTINGS } from "@/components/celebraciones/config/festivities";
import {
  SeasonalEffectsStateProvider,
  useSeasonalEffects,
} from "@/components/celebraciones/SeasonalEffectsContext";
import {
  deserializeSeasonalEffectsSettings,
  serializeSeasonalEffectsSettings,
} from "@/services/seasonal-effects";

function Harness() {
  const { settings, loading, error, previewId, saveSettings, setPreviewId } =
    useSeasonalEffects();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="enabled">{String(settings.enabled)}</span>
      <span data-testid="error">{error ?? ""}</span>
      <span data-testid="preview">{previewId ?? ""}</span>
      <button type="button" onClick={() => setPreviewId("christmas")}>preview</button>
      <button
        type="button"
        onClick={() => void saveSettings({ ...settings, enabled: true }).catch(() => undefined)}
      >
        save
      </button>
    </div>
  );
}

afterEach(cleanup);

describe("seasonal effects persistence", () => {
  it("serializes all festivities as a strict keyed map and restores the domain model", () => {
    const stored = serializeSeasonalEffectsSettings(DEFAULT_SEASONAL_EFFECTS_SETTINGS);
    expect(Object.keys(stored.festivities)).toHaveLength(12);
    expect(stored.festivities.christmas.title).toBe("Feliz Navidad");
    expect(stored.festivities.christmas).not.toHaveProperty("id");
    expect(deserializeSeasonalEffectsSettings(stored)).toEqual(
      DEFAULT_SEASONAL_EFFECTS_SETTINGS,
    );
  });

  it("loads once after Firebase auth is ready and keeps preview session-only", async () => {
    const loadSettings = vi.fn().mockResolvedValue({
      ...DEFAULT_SEASONAL_EFFECTS_SETTINGS,
      enabled: true,
    });
    const saveSettings = vi.fn().mockResolvedValue(undefined);

    render(
      <SeasonalEffectsStateProvider
        auth={{ authenticated: true, ready: true, uid: "super-1", role: "superadmin" }}
        loadSettings={loadSettings}
        persistSettings={saveSettings}
      >
        <Harness />
      </SeasonalEffectsStateProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("enabled").textContent).toBe("true");
    expect(loadSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "preview" }));
    expect(screen.getByTestId("preview").textContent).toBe("christmas");
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("falls back without blocking when Firestore cannot be read", async () => {
    const loadSettings = vi.fn().mockRejectedValue(new Error("offline"));
    render(
      <SeasonalEffectsStateProvider
        auth={{ authenticated: true, ready: true, uid: "user-1", role: "user" }}
        loadSettings={loadSettings}
        persistSettings={vi.fn()}
      >
        <Harness />
      </SeasonalEffectsStateProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("enabled").textContent).toBe("false");
    expect(screen.getByTestId("error").textContent).toContain("No se pudo cargar");
  });

  it("rejects writes from non-superadmins", async () => {
    const persistSettings = vi.fn();
    render(
      <SeasonalEffectsStateProvider
        auth={{ authenticated: true, ready: true, uid: "admin-1", role: "admin" }}
        loadSettings={vi.fn().mockResolvedValue(DEFAULT_SEASONAL_EFFECTS_SETTINGS)}
        persistSettings={persistSettings}
      >
        <Harness />
      </SeasonalEffectsStateProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(persistSettings).not.toHaveBeenCalled();
  });
});
