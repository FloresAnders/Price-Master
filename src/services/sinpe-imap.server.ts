import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const BCR_FROM = "mensajero@bancobcr.com";
const BCR_SUBJECT = "SINPEMOVIL - Notificación de transacción realizada";

export type SinpeEmailTransaction = {
  uid: number;
  date: string;
  from: string;
  subject: string;
  reference: string | null;
  amount: number;
};

export type SinpeReportResult = {
  processedEmails: number;
  validTransactions: number;
  total: number;
  transactions: SinpeEmailTransaction[];
};

const getImapHost = (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return { host: "imap.gmail.com", port: 993, secure: true };
  }
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) {
    return { host: "outlook.office365.com", port: 993, secure: true };
  }
  return { host: `imap.${domain}`, port: 993, secure: true };
};

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeMessageText = (value: string) =>
  stripAccents(
    value
      .replace(/&uacute;|&#250;/gi, "u")
      .replace(/&#x0*fa;/gi, "u")
      .replace(/Ãº/g, "u")
      .replace(/&#58;/g, ":")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " "),
  );

const normalizeSubject = (value: string) =>
  stripAccents(value).replace(/\s+/g, " ").trim().toLowerCase();

const normalizeAmount = (raw: string): number | null => {
  const compact = raw.replace(/\s/g, "");
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
  return Number.isFinite(amount) ? amount : null;
};

const parseAmount = (body: string): number | null => {
  const match = body.match(/Monto:[^\S\r\n]*([0-9][0-9., \t]*)/i);
  if (!match) return null;
  return normalizeAmount(match[1]);
};

const parseReference = (body: string): string | null => {
  const normalized = normalizeMessageText(body);
  const match = normalized.match(/referencia\s*:\s*([0-9]+)/i);
  return match?.[1] || null;
};

const toCRDateMidnight = (d: Date) => {
  const crOffset = 6 * 60 * 60 * 1000;
  const crDateStr = new Date(d.getTime() - crOffset).toISOString().substring(0, 10);
  return new Date(`${crDateStr}T00:00:00-06:00`);
};

export async function readBcrSinpeReport(params: {
  email: string;
  password: string;
  start: Date;
  end: Date;
}): Promise<SinpeReportResult> {
  const { email, password, start, end } = params;
  const client = new ImapFlow({
    ...getImapHost(email),
    auth: { user: email, pass: password },
    logger: false,
  });

  const transactions: SinpeEmailTransaction[] = [];
  let processedEmails = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchResult = await client.search({
        from: BCR_FROM,
        since: toCRDateMidnight(start),
        before: new Date(toCRDateMidnight(end).getTime() + 24 * 60 * 60 * 1000),
      });
      const uids = Array.isArray(searchResult) ? searchResult : [];

      for await (const message of client.fetch(uids, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        const messageDate = message.envelope?.date;
        if (!messageDate || messageDate < start || messageDate > end) continue;

        const subject = message.envelope?.subject || "";
        if (normalizeSubject(subject) !== normalizeSubject(BCR_SUBJECT)) continue;

        processedEmails += 1;
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);
        const body = [parsed.text || "", parsed.html || ""].join("\n");
        const amount = parseAmount(body);
        if (amount === null) continue;

        transactions.push({
          uid: message.uid,
          date: messageDate.toISOString(),
          from: parsed.from?.text || BCR_FROM,
          subject,
          reference: parseReference(body),
          amount,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return {
    processedEmails,
    validTransactions: transactions.length,
    total: transactions.reduce((sum, tx) => sum + tx.amount, 0),
    transactions,
  };
}
