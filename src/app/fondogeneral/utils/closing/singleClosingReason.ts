import {
  SINGLE_CLOSING_REASON_MIN_LENGTH,
  SINGLE_CLOSING_REASON_PREFIX,
} from "../../constants";

export { SINGLE_CLOSING_REASON_MIN_LENGTH };

export const SINGLE_CLOSING_REASON_INVALID_MESSAGE =
  "Debe indicar un motivo de cierre válido.";

const MIN_VOWEL_RATIO = 0.25;
const MAX_VOWEL_RATIO = 0.65;
const MIN_RECOGNIZED_WORDS = 2;
const UNKNOWN_LONG_WORD_MIN_LENGTH = 15;

const RECOGNIZED_SPANISH_WORDS = new Set([
  "a",
  "abrir",
  "abrio",
  "agente",
  "agentes",
  "al",
  "algo",
  "antes",
  "apertura",
  "atender",
  "atraso",
  "ausencia",
  "banco",
  "bancos",
  "caja",
  "cajas",
  "cerramos",
  "cerrar",
  "cerraron",
  "cerro",
  "cierre",
  "cliente",
  "clientes",
  "con",
  "contar",
  "de",
  "del",
  "deposito",
  "depositos",
  "dinero",
  "diurno",
  "durante",
  "efectivo",
  "el",
  "emergencia",
  "en",
  "enfermedad",
  "entre",
  "era",
  "es",
  "esta",
  "estaba",
  "este",
  "eso",
  "esto",
  "falla",
  "falta",
  "faltaba",
  "feriado",
  "fondo",
  "fondos",
  "fue",
  "habia",
  "hasta",
  "horario",
  "hubo",
  "incapacidad",
  "la",
  "las",
  "local",
  "lo",
  "los",
  "mantenimiento",
  "mas",
  "mucho",
  "muy",
  "nacional",
  "necesito",
  "necesitamos",
  "negativo",
  "ni",
  "no",
  "nocturno",
  "nos",
  "operacion",
  "pagar",
  "pago",
  "pagos",
  "para",
  "pero",
  "personal",
  "por",
  "porque",
  "problema",
  "proveedor",
  "proveedores",
  "pudo",
  "pudimos",
  "que",
  "quedo",
  "realizo",
  "realizamos",
  "retiro",
  "retiros",
  "saldo",
  "se",
  "sin",
  "sistema",
  "solo",
  "su",
  "suficiente",
  "sus",
  "temprano",
  "trabajo",
  "turno",
  "un",
  "una",
  "usar",
  "uso",
  "ventas",
  "y",
  "ya",
]);

export const normalizeSingleClosingReason = (value: unknown): string =>
  String(value ?? "").trim();

const normalizeForAnalysis = (value: unknown): string =>
  normalizeSingleClosingReason(value)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getWords = (value: unknown): string[] =>
  normalizeForAnalysis(value).match(/[a-zñ]+/g) ?? [];

const hasAbsurdRepetition = (words: string[]): boolean => {
  if (words.some((word) => /([a-zñ])\1{2,}/.test(word))) return true;
  if (words.some((word) => /(.{1,3})\1{2,}/.test(word))) return true;

  return words.some(
    (word, index) => word === words[index + 1] && word === words[index + 2],
  );
};

export interface SingleClosingReasonValidationResult {
  valid: boolean;
}

export const validateSingleClosingReason = (
  value: unknown,
): SingleClosingReasonValidationResult => {
  const normalizedReason = normalizeSingleClosingReason(value);
  const words = getWords(normalizedReason);

  if (
    normalizedReason.length < SINGLE_CLOSING_REASON_MIN_LENGTH ||
    words.length < 3 ||
    hasAbsurdRepetition(words)
  ) {
    return { valid: false };
  }

  const letters = words.join("");
  const vowelCount = (letters.match(/[aeiou]/g) ?? []).length;
  const vowelRatio = vowelCount / letters.length;
  if (vowelRatio < MIN_VOWEL_RATIO || vowelRatio > MAX_VOWEL_RATIO) {
    return { valid: false };
  }

  const recognizedWordCount = words.filter((word) =>
    RECOGNIZED_SPANISH_WORDS.has(word),
  ).length;
  const minimumRecognizedForReason = Math.max(
    MIN_RECOGNIZED_WORDS,
    Math.ceil(words.length / 2),
  );
  if (recognizedWordCount < minimumRecognizedForReason) {
    return { valid: false };
  }

  const hasUnknownLongWord = words.some(
    (word) =>
      word.length >= UNKNOWN_LONG_WORD_MIN_LENGTH &&
      !RECOGNIZED_SPANISH_WORDS.has(word),
  );
  if (hasUnknownLongWord) return { valid: false };

  return { valid: true };
};

export const getSingleClosingReasonFromNotes = (notes: unknown): string => {
  const trimmedNotes = normalizeSingleClosingReason(notes);
  return trimmedNotes.startsWith(SINGLE_CLOSING_REASON_PREFIX)
    ? trimmedNotes.slice(SINGLE_CLOSING_REASON_PREFIX.length).trim()
    : trimmedNotes;
};
