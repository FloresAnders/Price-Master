// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SeasonalEffectsView } from "@/components/celebraciones/components/SeasonalEffectsHost";
import {
  DEFAULT_SEASONAL_EFFECTS_SETTINGS,
} from "@/components/celebraciones/config/festivities";
import { FESTIVITY_IDS } from "@/components/celebraciones/types";

const enabledSettings = {
  ...DEFAULT_SEASONAL_EFFECTS_SETTINGS,
  enabled: true,
};

const visualProfiles = {
  "new-year": ["firework-burst", 12],
  "holy-thursday": ["palm-sway", 6],
  "good-friday": ["horizon-glow", 0],
  "juan-santamaria": ["ribbon-reveal", 8],
  "workers-day": ["gear-turn", 5],
  nicoya: ["canopy-drift", 8],
  "virgen-angeles": ["pilgrimage-lights", 6],
  "mothers-day": ["petal-float", 10],
  "afro-culture": ["pattern-rhythm", 7],
  "army-abolition": ["dove-glide", 4],
  christmas: ["snow-twinkle", 12],
  "year-end": ["clock-sweep", 10],
} as const;

afterEach(cleanup);

describe("SeasonalEffectsView", () => {
  it("muestra tema activo sin capturar interacción y permite ocultarlo", async () => {
    const onHide = vi.fn();
    const { container } = render(
      <SeasonalEffectsView
        settings={enabledSettings}
        now={new Date("2026-01-01T18:00:00.000Z")}
        onHide={onHide}
        animationEnabled={false}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("¡Feliz Año Nuevo!");
    await screen.findAllByTestId("festivity-artwork-new-year");
    const layer = container.querySelector('[data-festivity-id="new-year"]');
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("decorativeLayer");

    fireEvent.click(screen.getByRole("button", { name: "Ocultar efectos por hoy" }));
    expect(onHide).toHaveBeenCalledWith("new-year", "2026-01-01");
  });

  it("no renderiza fuera de fecha ni durante septiembre patrio", () => {
    const { container, rerender } = render(
      <SeasonalEffectsView
        settings={enabledSettings}
        now={new Date("2026-02-10T18:00:00.000Z")}
        animationEnabled={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <SeasonalEffectsView
        settings={enabledSettings}
        now={new Date("2026-09-15T18:00:00.000Z")}
        animationEnabled={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("permite preview local aun con feature flag apagado", async () => {
    render(
      <SeasonalEffectsView
        settings={DEFAULT_SEASONAL_EFFECTS_SETTINGS}
        now={new Date("2026-02-10T18:00:00.000Z")}
        previewId="christmas"
        animationEnabled={false}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("Feliz Navidad");
    expect((await screen.findAllByTestId("festivity-artwork-christmas")).length).toBe(2);
  });

  it("mantiene el banner cuando la intensidad está apagada", async () => {
    const settings = {
      ...enabledSettings,
      festivities: enabledSettings.festivities.map((item) =>
        item.id === "new-year" ? { ...item, intensity: "off" as const } : item,
      ),
    };
    const { container } = render(
      <SeasonalEffectsView
        settings={settings}
        now={new Date("2026-01-01T18:00:00.000Z")}
        animationEnabled
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("¡Feliz Año Nuevo!");
    expect(container.querySelector('[data-festivity-id="new-year"]')).toBeNull();
  });

  it.each(FESTIVITY_IDS)("tiene kit visual para %s", async (id) => {
    const { container } = render(
      <SeasonalEffectsView
        settings={DEFAULT_SEASONAL_EFFECTS_SETTINGS}
        now={new Date("2026-02-10T18:00:00.000Z")}
        previewId={id}
        animationEnabled={false}
      />,
    );

    expect((await screen.findAllByTestId(`festivity-artwork-${id}`)).length).toBe(2);
    const layer = container.querySelector(`[data-festivity-id="${id}"]`);
    const [motionProfile, particleCount] = visualProfiles[id];
    expect(layer).toHaveAttribute("data-motion-profile", motionProfile);
    expect(layer?.querySelectorAll("[data-festivity-particle]")).toHaveLength(particleCount);
  });
});
