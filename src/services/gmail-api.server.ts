import { OAuth2Client } from "google-auth-library";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

export type GmailWatchResponse = {
  historyId: string;
  expiration: number;
};

export type GmailMessageMetadata = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
};

type GmailHistoryResponse = {
  historyId?: string;
  nextPageToken?: string;
  history?: Array<{
    messagesAdded?: Array<{ message?: { id?: string } }>;
  }>;
};

type GmailMessageListResponse = {
  nextPageToken?: string;
  messages?: Array<{ id?: string }>;
};

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Gmail push integration.`);
  return value;
};

const oauthClient = (refreshToken: string) => {
  const client = new OAuth2Client(
    requiredEnv("GMAIL_API_CLIENT_ID"),
    requiredEnv("GMAIL_API_CLIENT_SECRET"),
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
};

async function gmailFetch<T>(
  refreshToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { token } = await oauthClient(refreshToken).getAccessToken();
  if (!token) throw new Error("Gmail OAuth did not return an access token.");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new GmailApiError(
      `Gmail API request failed with status ${response.status}.`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function createGmailWatch(
  refreshToken: string,
  topicName: string,
): Promise<GmailWatchResponse> {
  const response = await gmailFetch<{ historyId?: string; expiration?: string }>(
    refreshToken,
    "/watch",
    {
      method: "POST",
      body: JSON.stringify({
        topicName,
        labelIds: ["INBOX"],
        labelFilterBehavior: "INCLUDE",
      }),
    },
  );
  const historyId = String(response.historyId || "").trim();
  const expiration = Number(response.expiration);
  if (!historyId || !Number.isFinite(expiration)) {
    throw new Error("Gmail watch returned an incomplete response.");
  }
  return { historyId, expiration };
}

export async function listGmailHistory(
  refreshToken: string,
  startHistoryId: string,
): Promise<{ messageIds: string[]; historyId: string }> {
  const messageIds = new Set<string>();
  let pageToken = "";
  let latestHistoryId = startHistoryId;

  do {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
      labelId: "INBOX",
      maxResults: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailFetch<GmailHistoryResponse>(
      refreshToken,
      `/history?${params.toString()}`,
    );
    for (const history of page.history || []) {
      for (const added of history.messagesAdded || []) {
        const id = String(added.message?.id || "").trim();
        if (id) messageIds.add(id);
      }
    }
    if (page.historyId) latestHistoryId = String(page.historyId);
    pageToken = String(page.nextPageToken || "");
  } while (pageToken);

  return { messageIds: [...messageIds], historyId: latestHistoryId };
}

export async function getGmailMessageMetadata(
  refreshToken: string,
  messageId: string,
): Promise<GmailMessageMetadata> {
  const params = new URLSearchParams({ format: "metadata" });
  for (const header of ["From", "Subject", "Date"]) {
    params.append("metadataHeaders", header);
  }
  return gmailFetch<GmailMessageMetadata>(
    refreshToken,
    `/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
  );
}

export async function getGmailRawMessage(
  refreshToken: string,
  messageId: string,
): Promise<Buffer> {
  const message = await gmailFetch<{ raw?: string }>(
    refreshToken,
    `/messages/${encodeURIComponent(messageId)}?format=raw`,
  );
  const raw = String(message.raw || "").trim();
  if (!raw) throw new Error("Gmail message did not include raw content.");
  return Buffer.from(raw, "base64url");
}

export async function listRecentGmailMessageIds(
  refreshToken: string,
  query: string,
): Promise<string[]> {
  const ids = new Set<string>();
  let pageToken = "";
  do {
    const params = new URLSearchParams({ q: query, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailFetch<GmailMessageListResponse>(
      refreshToken,
      `/messages?${params.toString()}`,
    );
    for (const message of page.messages || []) {
      const id = String(message.id || "").trim();
      if (id) ids.add(id);
    }
    pageToken = String(page.nextPageToken || "");
  } while (pageToken);
  return [...ids];
}

export const getGmailHeader = (
  metadata: GmailMessageMetadata,
  name: string,
) =>
  metadata.payload?.headers?.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase(),
  )?.value || "";
