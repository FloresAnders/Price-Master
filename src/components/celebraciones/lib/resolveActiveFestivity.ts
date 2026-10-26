import { FESTIVITY_DEFINITIONS } from "../config/festivities";
import type {
  CostaRicaDateParts,
  ResolvedFestivity,
  SeasonalEffectsSettings,
} from "../types";
import {
  addCalendarDays,
  formatDateKey,
  getCostaRicaDateParts,
  toEpochDay,
} from "./costaRicaDate";
import { getGregorianEasterSunday } from "./easter";

function resolveBaseDate(
  definition: (typeof FESTIVITY_DEFINITIONS)[number],
  year: number,
): CostaRicaDateParts {
  return definition.dateRule.kind === "fixed"
    ? { year, month: definition.dateRule.month, day: definition.dateRule.day }
    : addCalendarDays(
        getGregorianEasterSunday(year),
        definition.dateRule.offsetDays,
      );
}

export function resolveActiveFestivity(
  date: Date,
  settings: SeasonalEffectsSettings,
): ResolvedFestivity | null {
  if (!settings.enabled || !Number.isFinite(date.getTime())) return null;
  try {
    const today = getCostaRicaDateParts(date);
    // El tema patrio existente cubre septiembre completo. Ninguna decoración
    // nueva puede superponerse ni alterar ese comportamiento.
    if (today.month === 9) return null;
    const todayEpoch = toEpochDay(today);
    const candidates: ResolvedFestivity[] = [];

    for (const definition of FESTIVITY_DEFINITIONS) {
      const config = settings.festivities.find((item) => item.id === definition.id);
      if (!config?.enabled) continue;
      for (const candidateYear of [today.year - 1, today.year, today.year + 1]) {
        const baseDate = resolveBaseDate(definition, candidateYear);
        const baseEpoch = toEpochDay(baseDate);
        if (
          todayEpoch < baseEpoch + config.startOffsetDays ||
          todayEpoch > baseEpoch + config.endOffsetDays
        ) {
          continue;
        }
        candidates.push({ config, dateKey: formatDateKey(today), baseDate });
        break;
      }
    }

    candidates.sort((left, right) => right.config.priority - left.config.priority);
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}
