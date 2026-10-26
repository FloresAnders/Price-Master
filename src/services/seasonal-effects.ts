import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  DEFAULT_SEASONAL_EFFECTS_SETTINGS,
  normalizeSeasonalEffectsSettings,
  validateSeasonalEffectsSettings,
} from "@/components/celebraciones/config/festivities";
import type {
  FestivityConfig,
  FestivityId,
  SeasonalEffectsSettings,
} from "@/components/celebraciones/types";

export const SEASONAL_EFFECTS_COLLECTION = "system_config";
export const SEASONAL_EFFECTS_DOCUMENT = "seasonal_effects";

export interface PersistedSeasonalEffectsSettings {
  schemaVersion: 1;
  enabled: boolean;
  festivities: Record<FestivityId, Omit<FestivityConfig, "id">>;
}

let settingsCache: SeasonalEffectsSettings | null = null;
let settingsRequest: Promise<SeasonalEffectsSettings> | null = null;

const cloneSettings = (settings: SeasonalEffectsSettings): SeasonalEffectsSettings => ({
  ...settings,
  festivities: settings.festivities.map((item) => ({ ...item })),
});

export function serializeSeasonalEffectsSettings(
  settings: SeasonalEffectsSettings,
): PersistedSeasonalEffectsSettings {
  const errors = validateSeasonalEffectsSettings(settings);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return {
    schemaVersion: 1,
    enabled: settings.enabled,
    festivities: Object.fromEntries(
      settings.festivities.map(({ id, ...item }) => [id, item]),
    ) as Record<FestivityId, Omit<FestivityConfig, "id">>,
  };
}

export function deserializeSeasonalEffectsSettings(
  value: unknown,
): SeasonalEffectsSettings {
  if (!value || typeof value !== "object") {
    return cloneSettings(DEFAULT_SEASONAL_EFFECTS_SETTINGS);
  }
  const raw = value as Record<string, unknown>;
  const festivities = raw.festivities;
  return normalizeSeasonalEffectsSettings({
    schemaVersion: raw.schemaVersion,
    enabled: raw.enabled,
    festivities:
      festivities && typeof festivities === "object" && !Array.isArray(festivities)
        ? Object.entries(festivities as Record<string, unknown>).map(
            ([id, config]) => ({
              ...(config && typeof config === "object" ? config : {}),
              id,
            }),
          )
        : festivities,
  });
}

export async function readSeasonalEffectsSettings(): Promise<SeasonalEffectsSettings> {
  if (settingsCache) return cloneSettings(settingsCache);
  if (!settingsRequest) {
    settingsRequest = getDoc(
      doc(db, SEASONAL_EFFECTS_COLLECTION, SEASONAL_EFFECTS_DOCUMENT),
    )
      .then((snapshot) =>
        snapshot.exists()
          ? deserializeSeasonalEffectsSettings(snapshot.data())
          : cloneSettings(DEFAULT_SEASONAL_EFFECTS_SETTINGS),
      )
      .then((settings) => {
        settingsCache = settings;
        return cloneSettings(settings);
      })
      .finally(() => {
        settingsRequest = null;
      });
  }
  return settingsRequest;
}

export async function saveSeasonalEffectsSettings(
  settings: SeasonalEffectsSettings,
  actorUid: string,
): Promise<void> {
  const normalizedActor = actorUid.trim();
  if (!normalizedActor) throw new Error("No se pudo identificar al SuperAdmin.");
  const stored = serializeSeasonalEffectsSettings(settings);
  await setDoc(doc(db, SEASONAL_EFFECTS_COLLECTION, SEASONAL_EFFECTS_DOCUMENT), {
    ...stored,
    updatedAt: serverTimestamp(),
    updatedBy: normalizedActor,
  });
  settingsCache = cloneSettings(settings);
}

export function clearSeasonalEffectsCacheForTests(): void {
  settingsCache = null;
  settingsRequest = null;
}
