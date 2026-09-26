import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Empresas } from "@/types/firestore";
import {
  createGmailWatch,
  getGmailHeader,
  getGmailMessageMetadata,
  getGmailRawMessage,
  GmailApiError,
  listGmailHistory,
  listRecentGmailMessageIds,
} from "@/services/gmail-api.server";
import {
  BCR_SINPE_FROM,
  BCR_SINPE_SUBJECT,
  isBcrSinpeMessage,
  parseSinpeEmail,
} from "@/services/sinpe-email.server";

const INTEGRATIONS_COLLECTION = "gmailIntegrations";
const ACCOUNT_MAPPINGS_COLLECTION = "gmailAccountMappings";
const WATCHES_COLLECTION = "gmailWatches";
const JOBS_COLLECTION = "gmailWebhookJobs";
const EVENTS_COLLECTION = "sinpeEvents";
const RENEW_BEFORE_MS = 48 * 60 * 60 * 1000;

type GmailIntegration = {
  empresaId: string;
  email: string;
  normalizedEmail: string;
  refreshTokenCipher: string;
  enabled: boolean;
};

type GmailWatchState = {
  empresaId: string;
  email: string;
  historyId: string;
  expiration: number;
};

type GmailWebhookJob = {
  email: string;
  historyId: string;
  status: "pending" | "processing" | "retry" | "done";
  attempts?: number;
  processingStartedAt?: Timestamp;
};

export type GmailNotificationPayload = {
  emailAddress: string;
  historyId: string;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Gmail push integration.`);
  return value;
};

const tokenEncryptionKey = () => {
  const raw = requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY");
  const key = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
};

const encryptRefreshToken = (value: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
};

const decryptRefreshToken = (value: string) => {
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Stored Gmail refresh token has an unsupported format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    tokenEncryptionKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

const stableId = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const historyGreaterThan = (candidate: string, current: string) => {
  try {
    return BigInt(candidate) > BigInt(current);
  } catch {
    return candidate !== current;
  }
};

const safeErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return "unknown_error";
  return `${error.name}: ${error.message}`.slice(0, 300);
};

const readIntegration = async (empresaId: string) => {
  const snapshot = await getAdminDb()
    .collection(INTEGRATIONS_COLLECTION)
    .doc(empresaId)
    .get();
  return snapshot.exists ? (snapshot.data() as GmailIntegration) : null;
};

const readIntegrationByEmail = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const mapping = await getAdminDb()
    .collection(ACCOUNT_MAPPINGS_COLLECTION)
    .doc(stableId(normalizedEmail))
    .get();
  const empresaId = String(mapping.data()?.empresaId || "").trim();
  if (!empresaId) return null;
  const integration = await readIntegration(empresaId);
  return integration?.enabled === true &&
    integration.normalizedEmail === normalizedEmail
    ? integration
    : null;
};

const readWatch = async (empresaId: string) => {
  const snapshot = await getAdminDb()
    .collection(WATCHES_COLLECTION)
    .doc(empresaId)
    .get();
  return snapshot.exists ? (snapshot.data() as GmailWatchState) : null;
};

const readEmpresa = async (empresaId: string) => {
  const snapshot = await getAdminDb().collection("empresas").doc(empresaId).get();
  return snapshot.exists
    ? ({ id: snapshot.id, ...snapshot.data() } as Empresas)
    : null;
};

export async function configureGmailWatch(input: {
  empresa: Empresas;
  email: string;
  refreshToken?: string;
}) {
  const empresaId = String(input.empresa.id || "").trim();
  const email = normalizeEmail(input.email);
  if (!empresaId || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("A valid company and Gmail address are required.");
  }
  const configuredEmail = normalizeEmail(input.empresa.correoConfigEmail || "");
  if (!configuredEmail || configuredEmail !== email) {
    throw new Error("The Gmail address must match the company's configured email.");
  }

  const mappedIntegration = await readIntegrationByEmail(email);
  if (mappedIntegration && mappedIntegration.empresaId !== empresaId) {
    throw new Error("That Gmail account is already assigned to another company.");
  }

  const existingIntegration = await readIntegration(empresaId);
  const refreshToken = input.refreshToken?.trim()
    ? input.refreshToken.trim()
    : existingIntegration
      ? decryptRefreshToken(existingIntegration.refreshTokenCipher)
      : "";
  if (!refreshToken) throw new Error("A Gmail OAuth refresh token is required.");

  const topicName = requiredEnv("GMAIL_PUBSUB_TOPIC");
  if (!/^projects\/[^/]+\/topics\/[^/]+$/.test(topicName)) {
    throw new Error("GMAIL_PUBSUB_TOPIC must be a full Pub/Sub topic name.");
  }
  const db = getAdminDb();
  const mappingRef = db
    .collection(ACCOUNT_MAPPINGS_COLLECTION)
    .doc(stableId(email));
  const integrationRef = db.collection(INTEGRATIONS_COLLECTION).doc(empresaId);
  const watchRef = db.collection(WATCHES_COLLECTION).doc(empresaId);
  const refreshTokenCipher = encryptRefreshToken(refreshToken);
  await db.runTransaction(async (transaction) => {
    const [mappingSnapshot, integrationSnapshot, watchSnapshot] = await Promise.all([
      transaction.get(mappingRef),
      transaction.get(integrationRef),
      transaction.get(watchRef),
    ]);
    const mappedEmpresaId = String(mappingSnapshot.data()?.empresaId || "");
    if (mappedEmpresaId && mappedEmpresaId !== empresaId) {
      throw new Error("That Gmail account is already assigned to another company.");
    }

    const currentIntegration = integrationSnapshot.exists
      ? (integrationSnapshot.data() as GmailIntegration)
      : null;
    const previousEmail = normalizeEmail(
      currentIntegration?.normalizedEmail || "",
    );
    const previousMappingRef =
      previousEmail && previousEmail !== email
        ? db.collection(ACCOUNT_MAPPINGS_COLLECTION).doc(stableId(previousEmail))
        : null;
    const previousMappingSnapshot = previousMappingRef
      ? await transaction.get(previousMappingRef)
      : null;
    if (
      previousMappingRef &&
      previousMappingSnapshot &&
      String(previousMappingSnapshot.data()?.empresaId || "") === empresaId
    ) {
      transaction.delete(previousMappingRef);
    }
    transaction.set(mappingRef, {
      empresaId,
      normalizedEmail: email,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      integrationRef,
      {
        empresaId,
        email,
        normalizedEmail: email,
        refreshTokenCipher,
        enabled: true,
        topicName,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const watchEmail = normalizeEmail(watchSnapshot.data()?.email || "");
    if (!watchSnapshot.exists || watchEmail !== email) {
      transaction.set(watchRef, {
        empresaId,
        email,
        historyId: "",
        expiration: 0,
        setupPending: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.set(
        watchRef,
        {
          setupPending: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  });

  let response: Awaited<ReturnType<typeof createGmailWatch>>;
  try {
    response = await createGmailWatch(refreshToken, topicName);
  } catch (error) {
    await watchRef.set(
      {
        setupPending: false,
        lastWatchError: safeErrorMessage(error),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }

  const historyId = await db.runTransaction(async (transaction) => {
    const watchSnapshot = await transaction.get(watchRef);
    const currentHistoryId = String(watchSnapshot.data()?.historyId || "");
    const nextHistoryId = currentHistoryId || response.historyId;
    transaction.set(
      watchRef,
      {
        empresaId,
        email,
        historyId: nextHistoryId,
        expiration: response.expiration,
        lastWatchHistoryId: response.historyId,
        setupPending: false,
        lastWatchError: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return nextHistoryId;
  });
  console.info(`[gmail-watch] registered for company ${empresaId}`);
  return { empresaId, email, historyId, expiration: response.expiration };
}

export async function renewGmailWatch(empresaId: string) {
  const integration = await readIntegration(empresaId);
  if (!integration?.enabled) throw new Error("Gmail integration is disabled.");
  const refreshToken = decryptRefreshToken(integration.refreshTokenCipher);
  const response = await createGmailWatch(
    refreshToken,
    requiredEnv("GMAIL_PUBSUB_TOPIC"),
  );
  const existingWatch = await readWatch(empresaId);
  await getAdminDb()
    .collection(WATCHES_COLLECTION)
    .doc(empresaId)
    .set(
      {
        empresaId,
        email: integration.email,
        historyId: existingWatch?.historyId || response.historyId,
        expiration: response.expiration,
        lastWatchHistoryId: response.historyId,
        setupPending: false,
        lastWatchError: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  console.info(`[gmail-watch] renewed for company ${empresaId}`);
  return response;
}

export async function renewExpiringGmailWatches() {
  const snapshot = await getAdminDb()
    .collection(INTEGRATIONS_COLLECTION)
    .where("enabled", "==", true)
    .get();
  const results: Array<{ empresaId: string; renewed: boolean; error?: string }> = [];
  for (const doc of snapshot.docs) {
    const integration = doc.data() as GmailIntegration;
    const state = await readWatch(integration.empresaId);
    if (state && state.expiration > Date.now() + RENEW_BEFORE_MS) {
      results.push({ empresaId: integration.empresaId, renewed: false });
      continue;
    }
    try {
      await renewGmailWatch(integration.empresaId);
      results.push({ empresaId: integration.empresaId, renewed: true });
    } catch (error) {
      console.error(
        `[gmail-watch] renewal failed for company ${integration.empresaId}:`,
        safeErrorMessage(error),
      );
      results.push({
        empresaId: integration.empresaId,
        renewed: false,
        error: safeErrorMessage(error),
      });
    }
  }
  return results;
}

const eventDocumentId = (reference: string | null, gmailMessageId: string) =>
  stableId(reference ? `reference:${reference}` : `gmail:${gmailMessageId}`);

const saveSinpeEvent = async (input: {
  empresa: Empresas;
  gmailMessageId: string;
  parsed: NonNullable<Awaited<ReturnType<typeof parseSinpeEmail>>>;
}) => {
  const empresaId = String(input.empresa.id || "");
  const eventId = eventDocumentId(input.parsed.reference, input.gmailMessageId);
  const eventRef = getAdminDb()
    .collection(EVENTS_COLLECTION)
    .doc(empresaId)
    .collection("events")
    .doc(eventId);
  return getAdminDb().runTransaction(async (transaction) => {
    if ((await transaction.get(eventRef)).exists) return false;
    transaction.create(eventRef, {
      id: eventId,
      empresaId,
      empresaName: input.empresa.name || input.empresa.ubicacion || empresaId,
      ownerId: input.empresa.ownerId || "",
      reference: input.parsed.reference || "",
      amount: input.parsed.amount,
      customerName: input.parsed.customerName,
      phone: input.parsed.phone,
      bank: input.parsed.bank,
      reason: input.parsed.reason,
      date: input.parsed.date,
      time: input.parsed.time,
      receivedAt: Timestamp.fromDate(input.parsed.receivedAt),
      gmailMessageId: input.gmailMessageId,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
};

const processMessageIds = async (input: {
  integration: GmailIntegration;
  refreshToken: string;
  empresa: Empresas;
  messageIds: string[];
}) => {
  let created = 0;
  for (const messageId of input.messageIds) {
    const metadata = await getGmailMessageMetadata(input.refreshToken, messageId);
    const from = getGmailHeader(metadata, "From");
    const subject = getGmailHeader(metadata, "Subject");
    if (!isBcrSinpeMessage(from, subject)) continue;

    const internalDate = Number(metadata.internalDate);
    const fallbackDate = Number.isFinite(internalDate)
      ? new Date(internalDate)
      : undefined;
    const raw = await getGmailRawMessage(input.refreshToken, messageId);
    const parsed = await parseSinpeEmail({
      raw,
      rawMessageId: messageId,
      fallbackDate,
      fallbackFrom: from,
      fallbackSubject: subject,
    });
    if (!parsed) {
      throw new Error(`SINPE parser failed for Gmail message ${messageId}.`);
    }
    if (await saveSinpeEvent({ empresa: input.empresa, gmailMessageId: messageId, parsed })) {
      created += 1;
      console.info(`[sinpe] valid event stored for company ${input.integration.empresaId}`);
    } else {
      console.info(`[sinpe] duplicate ignored for company ${input.integration.empresaId}`);
    }
  }
  return created;
};

const advanceHistoryId = async (empresaId: string, historyId: string) => {
  const ref = getAdminDb().collection(WATCHES_COLLECTION).doc(empresaId);
  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = String(snapshot.data()?.historyId || "");
    transaction.set(
      ref,
      {
        ...(current && !historyGreaterThan(historyId, current)
          ? {}
          : { historyId }),
        lastProcessedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
};

export async function processGmailNotification(
  payload: GmailNotificationPayload,
) {
  const integration = await readIntegrationByEmail(payload.emailAddress);
  if (!integration) {
    console.warn("[gmail-webhook] notification ignored for unknown or disabled account");
    return { status: "ignored" as const, created: 0 };
  }
  const state = await readWatch(integration.empresaId);
  if (!state?.historyId) {
    await advanceHistoryId(integration.empresaId, payload.historyId);
    console.warn(`[gmail-history] initialized missing state for company ${integration.empresaId}`);
    return { status: "initialized" as const, created: 0 };
  }
  if (!historyGreaterThan(payload.historyId, state.historyId)) {
    return { status: "duplicate" as const, created: 0 };
  }

  const empresa = await readEmpresa(integration.empresaId);
  if (!empresa) throw new Error("Configured Gmail company no longer exists.");
  if (empresa.isActive === false) {
    console.warn(`[sinpe] disabled company ignored: ${integration.empresaId}`);
    await advanceHistoryId(integration.empresaId, payload.historyId);
    return { status: "ignored" as const, created: 0 };
  }
  const refreshToken = decryptRefreshToken(integration.refreshTokenCipher);
  let messageIds: string[];
  let targetHistoryId = payload.historyId;
  try {
    const history = await listGmailHistory(refreshToken, state.historyId);
    messageIds = history.messageIds;
    if (historyGreaterThan(history.historyId, targetHistoryId)) {
      targetHistoryId = history.historyId;
    }
  } catch (error) {
    if (!(error instanceof GmailApiError) || error.status !== 404) throw error;
    console.warn(`[gmail-history] stale historyId; controlled resync for company ${integration.empresaId}`);
    messageIds = await listRecentGmailMessageIds(
      refreshToken,
      `from:${BCR_SINPE_FROM} subject:"${BCR_SINPE_SUBJECT}" newer_than:2d`,
    );
  }

  console.info(
    `[gmail-history] ${messageIds.length} new message candidates for company ${integration.empresaId}`,
  );
  const created = await processMessageIds({
    integration,
    refreshToken,
    empresa,
    messageIds,
  });
  await advanceHistoryId(integration.empresaId, targetHistoryId);
  return { status: "processed" as const, created };
}

export async function enqueueGmailNotification(
  payload: GmailNotificationPayload,
) {
  const email = normalizeEmail(payload.emailAddress);
  const historyId = String(payload.historyId || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d+$/.test(historyId)) {
    throw new Error("Pub/Sub Gmail payload is invalid.");
  }
  const jobId = stableId(`${email}:${historyId}`);
  const ref = getAdminDb().collection(JOBS_COLLECTION).doc(jobId);
  try {
    await ref.create({
      email,
      historyId,
      status: "pending",
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    const code = (error as { code?: string | number }).code;
    if (code !== 6 && code !== "already-exists") throw error;
  }
  return jobId;
}

export async function processGmailWebhookJob(jobId: string) {
  const ref = getAdminDb().collection(JOBS_COLLECTION).doc(jobId);
  const claimed = await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const job = snapshot.data() as GmailWebhookJob;
    if (job.status === "done" || job.status === "processing") return null;
    transaction.update(ref, {
      status: "processing",
      attempts: FieldValue.increment(1),
      processingStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return job;
  });
  if (!claimed) return;

  try {
    const result = await processGmailNotification({
      emailAddress: claimed.email,
      historyId: claimed.historyId,
    });
    await ref.update({
      status: "done",
      result: result.status,
      createdEvents: result.created,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastError: FieldValue.delete(),
      processingStartedAt: FieldValue.delete(),
    });
  } catch (error) {
    await ref.update({
      status: "retry",
      lastError: safeErrorMessage(error),
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete(),
    });
    console.error("[gmail-webhook] processing failed:", safeErrorMessage(error));
    throw error;
  }
}

export async function processPendingGmailWebhookJobs(limit = 10) {
  const staleBefore = Date.now() - 15 * 60 * 1000;
  const processing = await getAdminDb()
    .collection(JOBS_COLLECTION)
    .where("status", "==", "processing")
    .limit(25)
    .get();
  for (const job of processing.docs) {
    const startedAt = (job.data() as GmailWebhookJob).processingStartedAt;
    if (startedAt instanceof Timestamp && startedAt.toMillis() > staleBefore) continue;
    await job.ref.update({
      status: "retry",
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete(),
    });
  }

  const snapshot = await getAdminDb()
    .collection(JOBS_COLLECTION)
    .where("status", "in", ["pending", "retry"])
    .limit(limit)
    .get();
  let processed = 0;
  for (const job of snapshot.docs) {
    try {
      await processGmailWebhookJob(job.id);
      processed += 1;
    } catch {
      // The job remains retryable; continue with other companies/accounts.
    }
  }
  return processed;
}
