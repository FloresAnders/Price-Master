export const FESTIVITY_IDS = [
  "new-year",
  "holy-thursday",
  "good-friday",
  "juan-santamaria",
  "workers-day",
  "nicoya",
  "virgen-angeles",
  "mothers-day",
  "afro-culture",
  "army-abolition",
  "christmas",
  "year-end",
] as const;

export type FestivityId = (typeof FESTIVITY_IDS)[number];
export type FestivityIntensity = "off" | "subtle" | "normal";

export interface FestivityConfig {
  id: FestivityId;
  enabled: boolean;
  title: string;
  message: string;
  intensity: FestivityIntensity;
  showBanner: boolean;
  priority: number;
  startOffsetDays: number;
  endOffsetDays: number;
}

export interface SeasonalEffectsSettings {
  schemaVersion: 1;
  enabled: boolean;
  festivities: FestivityConfig[];
}

export interface CostaRicaDateParts {
  year: number;
  month: number;
  day: number;
}

export interface ResolvedFestivity {
  config: FestivityConfig;
  dateKey: string;
  baseDate: CostaRicaDateParts;
}
