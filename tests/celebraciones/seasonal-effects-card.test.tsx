// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SeasonalEffectsCelebrationCard from "@/edit/components/SeasonalEffectsCelebrationCard";
import { DEFAULT_SEASONAL_EFFECTS_SETTINGS } from "@/components/celebraciones/config/festivities";

afterEach(cleanup);

const newYear = DEFAULT_SEASONAL_EFFECTS_SETTINGS.festivities[0];

describe("SeasonalEffectsCelebrationCard", () => {
  it("separa selección de activación y expone el estado seleccionado", () => {
    const onSelect = vi.fn();
    const onEnabledChange = vi.fn();
    render(
      <SeasonalEffectsCelebrationCard
        config={newYear}
        dateLabel="1 de enero"
        selected
        onSelect={onSelect}
        onEnabledChange={onEnabledChange}
      />,
    );

    const selectButton = screen.getByRole("button", {
      name: "Editar ¡Feliz Año Nuevo!",
    });
    expect(selectButton).toHaveAttribute("aria-pressed", "true");

    const activationSwitch = screen.getByRole("switch", {
      name: "Habilitar ¡Feliz Año Nuevo!",
    });
    expect(activationSwitch).toBeChecked();
    fireEvent.click(activationSwitch);

    expect(onEnabledChange).toHaveBeenCalledWith(false);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(selectButton);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
