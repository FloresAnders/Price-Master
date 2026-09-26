import { simpleParser, type ParsedMail } from "mailparser";

export const BCR_SINPE_FROM = "mensajero@bancobcr.com";
export const BCR_SINPE_SUBJECT =
  "SINPEMOVIL - Notificación de transacción realizada";

export type ParsedSinpeEmail = {
  reference: string | null;
  amount: number;
  customerName: string;
  phone: string;
  bank: string;
  reason: string;
  date: string;
  time: string;
  receivedAt: Date;
  from: string;
  subject: string;
  rawMessageId: string;
};

export type ParseSinpeEmailInput = {
  raw: Buffer | string;
  rawMessageId: string;
  fallbackDate?: Date;
  fallbackFrom?: string;
  fallbackSubject?: string;
};

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const decodeKnownEntities = (value: string) =>
  value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;|&#225;/gi, "á")
    .replace(/&eacute;|&#233;/gi, "é")
    .replace(/&iacute;|&#237;/gi, "í")
    .replace(/&oacute;|&#243;/gi, "ó")
    .replace(/&uacute;|&#250;|&#x0*fa;/gi, "ú")
    .replace(/&ntilde;|&#241;/gi, "ñ")
    .replace(/&#58;/g, ":");

const htmlToText = (value: string) =>
  decodeKnownEntities(value)
    .replace(/<(?:br\b[^>]*|\/(?:p|div|tr|li|td|th))>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "");

const toMessageText = (parsed: ParsedMail) =>
  [typeof parsed.html === "string" ? htmlToText(parsed.html) : "", parsed.text || ""]
    .filter(Boolean)
    .join("\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeSubject = (value: string) =>
  stripAccents(value).replace(/\s+/g, " ").trim().toLowerCase();

export const isBcrSinpeMessage = (from: string, subject: string) => {
  const normalizedFrom = from.trim().toLowerCase();
  const senderAddresses =
    normalizedFrom.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/g) || [];
  return (
    senderAddresses.length === 1 &&
    senderAddresses[0] === BCR_SINPE_FROM &&
    normalizeSubject(subject) === normalizeSubject(BCR_SINPE_SUBJECT)
  );
};

const normalizeAmount = (raw: string): number | null => {
  const compact = raw.replace(/[^0-9.,]/g, "");
  if (!compact) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const decimalSeparator =
    decimalIndex >= 0 && compact.length - decimalIndex - 1 === 2
      ? compact[decimalIndex]
      : "";
  const normalized = decimalSeparator
    ? compact
        .slice(0, decimalIndex)
        .replace(/[.,]/g, "")
        .concat(".", compact.slice(decimalIndex + 1).replace(/[.,]/g, ""))
    : compact.replace(/[.,]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const normalizedLines = (body: string) =>
  body
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((original) => ({
      original,
      normalized: stripAccents(original).toLowerCase(),
    }));

const readLabeledValue = (body: string, labels: string[]) => {
  const labelSet = labels.map((label) => stripAccents(label).toLowerCase());
  const lines = normalizedLines(body);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const label of labelSet) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`(?:^|\\s)${escapedLabel}\\s*:`, "i").test(line.normalized)) {
        continue;
      }
      const separator = line.original.indexOf(":");
      const value = separator >= 0 ? line.original.slice(separator + 1).trim() : "";
      if (value) return value;
      const nextLine = lines[index + 1]?.original || "";
      if (nextLine && !nextLine.endsWith(":")) return nextLine;
    }
  }
  return "";
};

const readReference = (body: string) => {
  const normalized = stripAccents(body).replace(/\s+/g, " ");
  return normalized.match(/referencia\s*:\s*([0-9]+)/i)?.[1] || null;
};

const readAmount = (body: string) => {
  const match = stripAccents(body).match(
    /monto\s*:\s*(?:CRC|¢|₡)?\s*([0-9][0-9., \t]*)/i,
  );
  return match ? normalizeAmount(match[1]) : null;
};

const formatDateParts = (receivedAt: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(receivedAt);
  const value = (type: "year" | "month" | "day" | "hour" | "minute") =>
    parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
};

export async function parseSinpeEmail(
  input: ParseSinpeEmailInput,
): Promise<ParsedSinpeEmail | null> {
  const parsed = await simpleParser(input.raw);
  const body = toMessageText(parsed);
  const amount = readAmount(body);
  if (amount === null) return null;

  const receivedAt =
    parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime())
      ? parsed.date
      : input.fallbackDate && !Number.isNaN(input.fallbackDate.getTime())
        ? input.fallbackDate
        : new Date();
  const fallbackParts = formatDateParts(receivedAt);
  const from = parsed.from?.text || input.fallbackFrom || "";
  const subject = parsed.subject || input.fallbackSubject || "";

  return {
    reference: readReference(body),
    amount,
    customerName: readLabeledValue(body, [
      "nombre del cliente",
      "nombre del remitente",
      "nombre",
      "cliente",
    ]),
    phone: readLabeledValue(body, [
      "numero de telefono",
      "numero celular",
      "telefono",
      "celular",
    ]),
    bank: readLabeledValue(body, [
      "entidad de origen",
      "entidad origen",
      "entidad",
      "banco",
    ]),
    reason: readLabeledValue(body, ["motivo", "descripcion", "detalle"]),
    date: readLabeledValue(body, ["fecha"]) || fallbackParts.date,
    time: readLabeledValue(body, ["hora"]) || fallbackParts.time,
    receivedAt,
    from,
    subject,
    rawMessageId: input.rawMessageId,
  };
}
