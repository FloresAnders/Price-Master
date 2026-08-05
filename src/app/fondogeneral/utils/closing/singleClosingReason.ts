import {
  SINGLE_CLOSING_REASON_MIN_LENGTH,
  SINGLE_CLOSING_REASON_PREFIX,
} from "../../constants";

export { SINGLE_CLOSING_REASON_MIN_LENGTH };

export const SINGLE_CLOSING_REASON_FORM_MIN_LENGTH_MESSAGE =
  `Debes indicar un motivo de al menos ${SINGLE_CLOSING_REASON_MIN_LENGTH} caracteres para el cierre unico del dia.`;

export const SINGLE_CLOSING_REASON_OBSERVATIONS_MIN_LENGTH_MESSAGE =
  `Debe indicar en observaciones un motivo para el cierre unico del dia.`;

export const normalizeSingleClosingReason = (value: unknown): string =>
  String(value ?? "").trim();

export const getSingleClosingReasonFromNotes = (notes: unknown): string => {
  const trimmedNotes = normalizeSingleClosingReason(notes);
  return trimmedNotes.startsWith(SINGLE_CLOSING_REASON_PREFIX)
    ? trimmedNotes.slice(SINGLE_CLOSING_REASON_PREFIX.length).trim()
    : trimmedNotes;
};

export const hasMinimumSingleClosingReasonLength = (value: unknown): boolean =>
  normalizeSingleClosingReason(value).length >= SINGLE_CLOSING_REASON_MIN_LENGTH;
