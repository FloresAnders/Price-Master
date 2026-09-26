/**
 * Small in-process, scope-keyed rate limiter for sensitive API routes.
 *
 * NOTE: counters live in a module-level Map, so on serverless they reset on
 * every cold start and are not shared across concurrent instances. That is
 * acceptable as a burst/DoS guard, but it is NOT a security boundary. A
 * durable limiter (Firestore/Redis) is the follow-up for Fase C.
 */

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type AttemptWindow = {
  count: number;
  resetAt: number;
};

const attemptsByScope = new Map<string, AttemptWindow>();
const MAX_TRACKED_SCOPES = 10_000;

/**
 * Best-effort client identifier. When proxy headers are not explicitly
 * trusted, every caller shares the "unknown-client" bucket so an attacker
 * cannot bypass limits by spoofing `x-forwarded-for`.
 */
export function requestClientKey(request: Request): string {
  const trustsProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true";
  if (!trustsProxyHeaders) return "unknown-client";

  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return (
    forwarded ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function discardExpiredScopes(now: number) {
  if (attemptsByScope.size < MAX_TRACKED_SCOPES) return;
  for (const [key, attempt] of attemptsByScope) {
    if (attempt.resetAt <= now) attemptsByScope.delete(key);
  }
  while (attemptsByScope.size >= MAX_TRACKED_SCOPES) {
    const oldest = attemptsByScope.keys().next().value;
    if (typeof oldest !== "string") break;
    attemptsByScope.delete(oldest);
  }
}

export function consumeRateLimit(
  scope: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const current = attemptsByScope.get(scope);

  if (!current || current.resetAt <= now) {
    discardExpiredScopes(now);
    attemptsByScope.set(scope, { count: 1, resetAt: now + windowMs });
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

export function resetRateLimit(scope: string) {
  attemptsByScope.delete(scope);
}
