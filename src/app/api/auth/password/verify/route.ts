import { NextResponse } from "next/server";
// Force Node runtime for this route to avoid running on Edge; reduces 'edge' requests metrics
export const runtime = "nodejs";
import { verifyPasswordServer } from "@/lib/auth/password.server";
import {
  consumeRateLimit,
  requestClientKey,
} from "@/lib/security/rate-limit.server";

// Must stay callable without a session: the `/pruebas` unlock and the
// "unlock past days" / profile flows verify against a client-supplied hash.
// Protection is a burst rate limit (Argon2 is CPU-expensive) plus input caps.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const MAX_PASSWORD_LENGTH = 1024;
const MAX_HASH_LENGTH = 1024;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const limited = consumeRateLimit(
      `password-verify:${requestClientKey(request)}`,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!limited.allowed) {
      return NextResponse.json(
        { ok: false },
        {
          status: 429,
          headers: {
            ...noStore,
            "Retry-After": String(limited.retryAfterSeconds),
          },
        },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      password?: unknown;
      hash?: unknown;
      purpose?: unknown;
    } | null;
    const password = body?.password;
    const hash = body?.hash;
    const purpose = body?.purpose;

    const tryDecodeBase64 = (value: unknown): string => {
      if (typeof value !== "string" || value.trim().length === 0) return "";
      try {
        return Buffer.from(value.trim(), "base64").toString("utf8").trim();
      } catch {
        return "";
      }
    };

    // Special purpose: unlock /pruebas access when not authenticated.
    // Client sends only the plain password; we compare against a server-side hash.
    if (purpose === "pruebas") {
      const rawHash = process.env.PRUEBAS_PASSWORD_HASH;
      const pruebasHash = String(rawHash ?? "")
        .trim()
        // Strip surrounding single/double quotes if dotenv kept them
        .replace(/^['"]|['"]$/g, "");

      const pruebasHashB64 = tryDecodeBase64(
        process.env.PRUEBAS_PASSWORD_HASH_B64,
      );

      const effectiveHash = pruebasHash.startsWith("$argon2")
        ? pruebasHash
        : pruebasHashB64.startsWith("$argon2")
          ? pruebasHashB64
          : "";

      if (
        typeof password !== "string" ||
        password.length === 0 ||
        password.length > MAX_PASSWORD_LENGTH
      ) {
        return NextResponse.json(
          { ok: false },
          { status: 400, headers: noStore },
        );
      }

      if (pruebasHash.length === 0 && pruebasHashB64.length === 0) {
        return NextResponse.json(
          { ok: false },
          { status: 401, headers: noStore },
        );
      }

      if (effectiveHash.length === 0) {
        // Misconfigured server-side hash: do not reveal configuration details.
        console.error(
          "PRUEBAS_PASSWORD_HASH inválido: se esperaba un hash Argon2.",
        );
        return NextResponse.json(
          { ok: false },
          { status: 401, headers: noStore },
        );
      }

      const ok = await verifyPasswordServer(password, effectiveHash);
      return NextResponse.json({ ok }, { headers: noStore });
    }

    // Default behavior: verify plain password against provided hash
    if (
      typeof password !== "string" ||
      typeof hash !== "string" ||
      hash.length === 0 ||
      hash.length > MAX_HASH_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return NextResponse.json(
        { ok: false },
        { status: 400, headers: noStore },
      );
    }

    const ok = await verifyPasswordServer(password, hash);
    return NextResponse.json({ ok }, { headers: noStore });
  } catch (error) {
    console.error("Error verifying password:", error);
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: noStore },
    );
  }
}
