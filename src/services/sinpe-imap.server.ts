import { ImapFlow } from "imapflow";
import {
  BCR_SINPE_FROM,
  BCR_SINPE_SUBJECT,
  isBcrSinpeMessage,
  parseSinpeEmail,
} from "@/services/sinpe-email.server";

const IMAP_CONNECTION_TIMEOUT_MS = 15_000;
const IMAP_GREETING_TIMEOUT_MS = 10_000;
const IMAP_SOCKET_TIMEOUT_MS = 30_000;
const SINPE_SOURCE_MAX_BYTES = 64 * 1024;

export type SinpeEmailTransaction = {
  uid: number;
  date: string;
  from: string;
  subject: string;
  reference: string | null;
  amount: number;
  customerName?: string;
  phone?: string;
  bank?: string;
  reason?: string;
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

const toCRDateMidnight = (d: Date) => {
  const crOffset = 6 * 60 * 60 * 1000;
  const crDateStr = new Date(d.getTime() - crOffset).toISOString().substring(0, 10);
  return new Date(`${crDateStr}T00:00:00-06:00`);
};

const normalizeFetchDate = (value: Date | string | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    connectionTimeout: IMAP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: IMAP_GREETING_TIMEOUT_MS,
    socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
    logger: false,
  });

  const transactions: SinpeEmailTransaction[] = [];
  let processedEmails = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchResult = await client.search(
        {
          from: BCR_SINPE_FROM,
          subject: "SINPEMOVIL",
          since: toCRDateMidnight(start),
          before: new Date(toCRDateMidnight(end).getTime() + 24 * 60 * 60 * 1000),
        },
        { uid: true },
      );
      const uids = Array.isArray(searchResult) ? searchResult : [];
      const candidates: Array<{ uid: number; date: Date; subject: string }> = [];

      for await (const message of client.fetch(uids, {
        uid: true,
        envelope: true,
        internalDate: true,
      }, { uid: true })) {
        const messageDate =
          normalizeFetchDate(message.internalDate) ||
          normalizeFetchDate(message.envelope?.date);
        if (!messageDate || messageDate < start || messageDate > end) continue;

        const subject = message.envelope?.subject || "";
        const from = message.envelope?.from?.map((address) => address.address || "").join(", ") || "";
        if (!isBcrSinpeMessage(from, subject)) continue;
        candidates.push({ uid: message.uid, date: messageDate, subject });
      }

      if (candidates.length) {
        const candidateByUid = new Map(candidates.map((item) => [item.uid, item]));

        for await (const message of client.fetch(candidates.map((item) => item.uid), {
          uid: true,
          envelope: true,
          source: { maxLength: SINPE_SOURCE_MAX_BYTES },
        }, { uid: true })) {
          const candidate = candidateByUid.get(message.uid);
          if (!candidate) continue;
          processedEmails += 1;
          if (!message.source) continue;
          const parsed = await parseSinpeEmail({
            raw: message.source,
            rawMessageId: `imap:${email}:${message.uid}`,
            fallbackDate: candidate.date,
            fallbackFrom: BCR_SINPE_FROM,
            fallbackSubject: candidate.subject,
          });
          if (!parsed) continue;

          transactions.push({
            uid: message.uid,
            date: candidate.date.toISOString(),
            from: parsed.from || BCR_SINPE_FROM,
            subject: message.envelope?.subject || candidate.subject,
            reference: parsed.reference,
            amount: parsed.amount,
            customerName: parsed.customerName || undefined,
            phone: parsed.phone || undefined,
            bank: parsed.bank || undefined,
            reason: parsed.reason || undefined,
          });
        }
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
