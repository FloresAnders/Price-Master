import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEASONAL_EFFECTS_SETTINGS,
  normalizeSeasonalEffectsSettings,
} from "@/components/celebraciones/config/festivities";
import {
  getCostaRicaDateParts,
  getNextCostaRicaMidnightTimestamp,
} from "@/components/celebraciones/lib/costaRicaDate";
import { getGregorianEasterSunday } from "@/components/celebraciones/lib/easter";
import { resolveActiveFestivity } from "@/components/celebraciones/lib/resolveActiveFestivity";

const enabledSettings = {
  ...DEFAULT_SEASONAL_EFFECTS_SETTINGS,
  enabled: true,
};

describe("motor de celebraciones", () => {
  it("usa el día civil de Costa Rica en ambos lados de medianoche", () => {
    expect(getCostaRicaDateParts(new Date("2027-01-01T05:59:59.000Z"))).toEqual({
      year: 2026,
      month: 12,
      day: 31,
    });
    expect(getCostaRicaDateParts(new Date("2027-01-01T06:00:00.000Z"))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(
      getNextCostaRicaMidnightTimestamp(new Date("2027-01-01T05:59:59.000Z")),
    ).toBe(Date.parse("2027-01-01T06:00:00.000Z"));
  });

  it.each([
    [2026, { year: 2026, month: 4, day: 5 }],
    [2027, { year: 2027, month: 3, day: 28 }],
    [2038, { year: 2038, month: 4, day: 25 }],
  ])("calcula Domingo de Pascua gregoriano para %i", (year, expected) => {
    expect(getGregorianEasterSunday(year)).toEqual(expected);
  });

  it.each([
    ["2026-01-01T18:00:00.000Z", "new-year"],
    ["2026-04-02T18:00:00.000Z", "holy-thursday"],
    ["2026-04-03T18:00:00.000Z", "good-friday"],
    ["2027-03-25T18:00:00.000Z", "holy-thursday"],
    ["2027-03-26T18:00:00.000Z", "good-friday"],
    ["2026-08-31T18:00:00.000Z", "afro-culture"],
    ["2026-12-25T18:00:00.000Z", "christmas"],
    ["2026-12-31T18:00:00.000Z", "year-end"],
  ])("resuelve %s como %s", (iso, expectedId) => {
    expect(resolveActiveFestivity(new Date(iso), enabledSettings)?.config.id).toBe(
      expectedId,
    );
  });

  it("aísla todo septiembre para conservar el tema patrio existente", () => {
    const extendedAfro = {
      ...enabledSettings,
      festivities: enabledSettings.festivities.map((item) =>
        item.id === "afro-culture" ? { ...item, endOffsetDays: 20 } : item,
      ),
    };

    expect(
      resolveActiveFestivity(new Date("2026-09-15T18:00:00.000Z"), extendedAfro),
    ).toBeNull();
  });

  it("elige mayor prioridad cuando ventanas configuradas coinciden", () => {
    const overlapping = {
      ...enabledSettings,
      festivities: enabledSettings.festivities.map((item) =>
        item.id === "christmas"
          ? { ...item, endOffsetDays: 6, priority: 10 }
          : item.id === "year-end"
            ? { ...item, priority: 20 }
            : item,
      ),
    };

    expect(
      resolveActiveFestivity(new Date("2026-12-31T18:00:00.000Z"), overlapping)
        ?.config.id,
    ).toBe("year-end");
  });

  it("resuelve ventanas configuradas que cruzan cambio de año", () => {
    const crossingYear = {
      ...enabledSettings,
      festivities: enabledSettings.festivities.map((item) => {
        if (item.id === "christmas") return { ...item, endOffsetDays: 7 };
        if (item.id === "new-year") return { ...item, enabled: false };
        return item;
      }),
    };

    expect(
      resolveActiveFestivity(new Date("2027-01-01T18:00:00.000Z"), crossingYear)
        ?.config.id,
    ).toBe("christmas");
  });

  it("normaliza configuración dañada hacia defaults seguros", () => {
    const normalized = normalizeSeasonalEffectsSettings({
      enabled: "yes",
      festivities: [
        {
          id: "christmas",
          enabled: true,
          title: "X".repeat(200),
          message: 7,
          intensity: "extreme",
          showBanner: false,
          priority: 9_999,
          startOffsetDays: -99,
          endOffsetDays: 99,
        },
        { id: "invented" },
      ],
    });

    expect(normalized.enabled).toBe(false);
    expect(normalized.festivities).toHaveLength(12);
    expect(normalized.festivities.find((item) => item.id === "christmas")).toEqual(
      DEFAULT_SEASONAL_EFFECTS_SETTINGS.festivities.find(
        (item) => item.id === "christmas",
      ),
    );
  });
});
