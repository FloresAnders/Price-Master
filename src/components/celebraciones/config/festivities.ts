import {
  FESTIVITY_IDS,
  type FestivityConfig,
  type FestivityId,
  type FestivityIntensity,
  type SeasonalEffectsSettings,
} from "../types";

export const MAX_FESTIVITY_TITLE_LENGTH = 80;
export const MAX_FESTIVITY_MESSAGE_LENGTH = 200;
export const MIN_FESTIVITY_PRIORITY = -1000;
export const MAX_FESTIVITY_PRIORITY = 1000;
export const MIN_FESTIVITY_OFFSET_DAYS = -7;
export const MAX_FESTIVITY_OFFSET_DAYS = 7;

export type FestivityDateRule =
  | { kind: "fixed"; month: number; day: number }
  | { kind: "easter"; offsetDays: number };

export interface FestivityDefinition {
  id: FestivityId;
  dateLabel: string;
  dateRule: FestivityDateRule;
  palette: string;
}

export const FESTIVITY_DEFINITIONS: readonly FestivityDefinition[] = [
  { id: "new-year", dateLabel: "1 de enero", dateRule: { kind: "fixed", month: 1, day: 1 }, palette: "Dorado y azul noche" },
  { id: "holy-thursday", dateLabel: "Jueves Santo", dateRule: { kind: "easter", offsetDays: -3 }, palette: "Oliva y beige" },
  { id: "good-friday", dateLabel: "Viernes Santo", dateRule: { kind: "easter", offsetDays: -2 }, palette: "Morado y crema" },
  { id: "juan-santamaria", dateLabel: "11 de abril", dateRule: { kind: "fixed", month: 4, day: 11 }, palette: "Azul, blanco y rojo" },
  { id: "workers-day", dateLabel: "1 de mayo", dateRule: { kind: "fixed", month: 5, day: 1 }, palette: "Azul y naranja" },
  { id: "nicoya", dateLabel: "25 de julio", dateRule: { kind: "fixed", month: 7, day: 25 }, palette: "Tierra y verde" },
  { id: "virgen-angeles", dateLabel: "2 de agosto", dateRule: { kind: "fixed", month: 8, day: 2 }, palette: "Azul mariano y blanco" },
  { id: "mothers-day", dateLabel: "15 de agosto", dateRule: { kind: "fixed", month: 8, day: 15 }, palette: "Lavanda y rosa" },
  { id: "afro-culture", dateLabel: "31 de agosto", dateRule: { kind: "fixed", month: 8, day: 31 }, palette: "Caribe multicolor" },
  { id: "army-abolition", dateLabel: "1 de diciembre", dateRule: { kind: "fixed", month: 12, day: 1 }, palette: "Blanco y azul" },
  { id: "christmas", dateLabel: "25 de diciembre", dateRule: { kind: "fixed", month: 12, day: 25 }, palette: "Verde, rojo y dorado" },
  { id: "year-end", dateLabel: "31 de diciembre", dateRule: { kind: "fixed", month: 12, day: 31 }, palette: "Dorado y azul oscuro" },
] as const;

const defaults: Record<FestivityId, Omit<FestivityConfig, "id">> = {
  "new-year": { enabled: true, title: "¡Feliz Año Nuevo!", message: "Un nuevo año para compartir, crecer y avanzar juntos.", intensity: "normal", showBanner: true, priority: 100, startOffsetDays: 0, endOffsetDays: 0 },
  "holy-thursday": { enabled: true, title: "Jueves Santo", message: "Una jornada de reflexión, encuentro y serenidad.", intensity: "subtle", showBanner: true, priority: 70, startOffsetDays: 0, endOffsetDays: 0 },
  "good-friday": { enabled: true, title: "Viernes Santo", message: "Un día de recogimiento, respeto y esperanza.", intensity: "subtle", showBanner: true, priority: 75, startOffsetDays: 0, endOffsetDays: 0 },
  "juan-santamaria": { enabled: true, title: "Día de Juan Santamaría", message: "Recordamos su valor y el legado de quienes defendieron Costa Rica.", intensity: "subtle", showBanner: true, priority: 60, startOffsetDays: 0, endOffsetDays: 0 },
  "workers-day": { enabled: true, title: "Día del Trabajador", message: "Reconocemos el esfuerzo que mueve cada día a nuestras comunidades.", intensity: "subtle", showBanner: true, priority: 50, startOffsetDays: 0, endOffsetDays: 0 },
  nicoya: { enabled: true, title: "Anexión del Partido de Nicoya", message: "¡De la Patria por nuestra voluntad! Celebramos identidad y tradición.", intensity: "normal", showBanner: true, priority: 60, startOffsetDays: 0, endOffsetDays: 0 },
  "virgen-angeles": { enabled: true, title: "Día de la Virgen de los Ángeles", message: "Acompañamos con respeto esta tradición costarricense.", intensity: "subtle", showBanner: true, priority: 55, startOffsetDays: 0, endOffsetDays: 0 },
  "mothers-day": { enabled: true, title: "Día de la Madre", message: "Celebramos con cariño a quienes cuidan, acompañan e inspiran.", intensity: "normal", showBanner: true, priority: 65, startOffsetDays: 0, endOffsetDays: 0 },
  "afro-culture": { enabled: true, title: "Persona Negra y Cultura Afrocostarricense", message: "Celebramos aportes, historia y diversidad de la cultura afrocostarricense.", intensity: "normal", showBanner: true, priority: 65, startOffsetDays: 0, endOffsetDays: 0 },
  "army-abolition": { enabled: true, title: "Abolición del Ejército", message: "Celebramos la paz, la educación y la vocación civil de Costa Rica.", intensity: "subtle", showBanner: true, priority: 60, startOffsetDays: 0, endOffsetDays: 0 },
  christmas: { enabled: true, title: "Feliz Navidad", message: "Que esta fecha traiga unión, gratitud y buenos momentos.", intensity: "normal", showBanner: true, priority: 80, startOffsetDays: 0, endOffsetDays: 0 },
  "year-end": { enabled: true, title: "Fin de Año", message: "Gracias por lo compartido. Cerramos el año mirando hacia adelante.", intensity: "normal", showBanner: true, priority: 90, startOffsetDays: 0, endOffsetDays: 0 },
};

export const DEFAULT_FESTIVITY_CONFIGS: readonly FestivityConfig[] =
  FESTIVITY_IDS.map((id) => ({ id, ...defaults[id] }));

export const DEFAULT_SEASONAL_EFFECTS_SETTINGS: SeasonalEffectsSettings = {
  schemaVersion: 1,
  enabled: false,
  festivities: DEFAULT_FESTIVITY_CONFIGS.map((item) => ({ ...item })),
};

export function isFestivityId(value: unknown): value is FestivityId {
  return typeof value === "string" && FESTIVITY_IDS.includes(value as FestivityId);
}

function isIntensity(value: unknown): value is FestivityIntensity {
  return value === "off" || value === "subtle" || value === "normal";
}

function isValidConfig(value: unknown, expectedId: FestivityId): value is FestivityConfig {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.id === expectedId &&
    typeof item.enabled === "boolean" &&
    typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= MAX_FESTIVITY_TITLE_LENGTH &&
    typeof item.message === "string" && item.message.length <= MAX_FESTIVITY_MESSAGE_LENGTH &&
    isIntensity(item.intensity) &&
    typeof item.showBanner === "boolean" &&
    Number.isInteger(item.priority) && Number(item.priority) >= MIN_FESTIVITY_PRIORITY && Number(item.priority) <= MAX_FESTIVITY_PRIORITY &&
    Number.isInteger(item.startOffsetDays) && Number(item.startOffsetDays) >= MIN_FESTIVITY_OFFSET_DAYS && Number(item.startOffsetDays) <= MAX_FESTIVITY_OFFSET_DAYS &&
    Number.isInteger(item.endOffsetDays) && Number(item.endOffsetDays) >= MIN_FESTIVITY_OFFSET_DAYS && Number(item.endOffsetDays) <= MAX_FESTIVITY_OFFSET_DAYS &&
    Number(item.startOffsetDays) <= Number(item.endOffsetDays);
}

export function validateSeasonalEffectsSettings(settings: SeasonalEffectsSettings): string[] {
  const errors: string[] = [];
  if (settings.schemaVersion !== 1) errors.push("Versión de configuración inválida.");
  if (typeof settings.enabled !== "boolean") errors.push("Estado global inválido.");
  if (!Array.isArray(settings.festivities) || settings.festivities.length !== FESTIVITY_IDS.length) {
    errors.push("El catálogo debe contener las 12 celebraciones.");
    return errors;
  }
  for (const id of FESTIVITY_IDS) {
    const item = settings.festivities.find((candidate) => candidate.id === id);
    if (!isValidConfig(item, id)) errors.push(`Configuración inválida para ${id}.`);
  }
  return errors;
}

export function normalizeSeasonalEffectsSettings(value: unknown): SeasonalEffectsSettings {
  if (!value || typeof value !== "object") {
    return structuredClone(DEFAULT_SEASONAL_EFFECTS_SETTINGS);
  }
  const raw = value as Record<string, unknown>;
  const items = Array.isArray(raw.festivities) ? raw.festivities : [];
  const festivities = DEFAULT_FESTIVITY_CONFIGS.map((fallback) => {
    const candidate = items.find(
      (item) => item && typeof item === "object" && (item as Record<string, unknown>).id === fallback.id,
    );
    return isValidConfig(candidate, fallback.id) ? { ...candidate } : { ...fallback };
  });
  return {
    schemaVersion: 1,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : false,
    festivities,
  };
}
