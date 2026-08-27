const LOGIN_ATTEMPT_LIMIT = 5;
const CLIENT_ATTEMPT_LIMIT = 30;
const LOGIN_ATTEMPT_WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 10_000;

type AttemptWindow = {
  count: number;
  resetAt: number;
};

const attemptsByScope = new Map<string, AttemptWindow>();

function clientKey(request: Request): string {
  const trustsProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true";
  if (!trustsProxyHeaders) return "unknown-client";

  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return (
    forwarded ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function discardExpiredWindows(now: number) {
  if (attemptsByScope.size < MAX_TRACKED_CLIENTS) return;
  for (const [key, attempt] of attemptsByScope) {
    if (attempt.resetAt <= now) attemptsByScope.delete(key);
  }
  while (attemptsByScope.size >= MAX_TRACKED_CLIENTS) {
    const oldest = attemptsByScope.keys().next().value;
    if (typeof oldest !== "string") break;
    attemptsByScope.delete(oldest);
  }
}

function consumeScope(
  key: string,
  limit: number,
  now: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const current = attemptsByScope.get(key);

  if (!current || current.resetAt <= now) {
    discardExpiredWindows(now);
    attemptsByScope.set(key, {
      count: 1,
      resetAt: now + LOGIN_ATTEMPT_WINDOW_MS,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function consumeLoginAttempt(
  request: Request,
  username: string,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const client = clientKey(request);
  const clientAttempt = consumeScope(
    `client:${client}`,
    CLIENT_ATTEMPT_LIMIT,
    now,
  );
  if (!clientAttempt.allowed) return clientAttempt;

  const normalizedUsername = username.trim().normalize("NFKC").toLocaleLowerCase();
  return consumeScope(
    `credential:${client}:${normalizedUsername}`,
    LOGIN_ATTEMPT_LIMIT,
    now,
  );
}

export function clearLoginAttempts(request: Request, username: string) {
  const normalizedUsername = username.trim().normalize("NFKC").toLocaleLowerCase();
  attemptsByScope.delete(
    `credential:${clientKey(request)}:${normalizedUsername}`,
  );
}
