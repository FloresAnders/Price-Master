const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type CaptchaBody = {
  captchaToken?: unknown;
  turnstileToken?: unknown;
};

export type CaptchaVerificationResult =
  | {
      ok: true;
      skipped: boolean;
      reason?: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      details?: string[];
    };

type TurnstileSiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

function getClientIp(request: Request): string | undefined {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp) return cloudflareIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || undefined;
}

function asCaptchaBody(body: unknown): CaptchaBody {
  if (!body || typeof body !== "object") return {};
  return body as CaptchaBody;
}

export function getCaptchaToken(body: unknown): string | null {
  const safeBody = asCaptchaBody(body);
  const token = safeBody.captchaToken ?? safeBody.turnstileToken;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export async function verifyTurnstileToken(
  token: string | null,
  remoteip?: string,
): Promise<CaptchaVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return {
        ok: true,
        skipped: true,
        reason: "TURNSTILE_SECRET_KEY is unset outside production",
      };
    }

    return {
      ok: false,
      status: 500,
      error: "Captcha verification is not configured",
    };
  }

  if (!token) {
    return {
      ok: false,
      status: 400,
      error: "Captcha token is required",
    };
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteip) form.set("remoteip", remoteip);

    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        error: "Captcha verification service failed",
      };
    }

    const result = (await response.json()) as TurnstileSiteverifyResponse;
    if (result.success) {
      return { ok: true, skipped: false };
    }

    return {
      ok: false,
      status: 400,
      error: "Captcha verification failed",
      details: result["error-codes"],
    };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return {
      ok: false,
      status: 502,
      error: "Captcha verification service failed",
    };
  }
}

export async function verifyCaptchaFromBody(
  body: unknown,
  request: Request,
): Promise<CaptchaVerificationResult> {
  return verifyTurnstileToken(getCaptchaToken(body), getClientIp(request));
}
