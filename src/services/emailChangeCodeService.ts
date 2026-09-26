import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

type EmailChangeCodeRecord = {
  codeHash: string;
  userId: string;
  createdAt: number;
  expiresAt: Timestamp;
  attempts: number;
};

export type VerifyEmailChangeCodeResult = {
  valid: boolean;
  error?: string;
};

/**
 * Server-only service that issues and consumes email-change verification codes.
 *
 * Runs exclusively through Firebase Admin (never the browser SDK), so it does
 * not depend on Firestore security rules. One active code per user, stored in a
 * deterministic document (`email_change_codes/{userId}`) which makes the
 * validate-and-consume step atomic in a single transaction.
 */
export class EmailChangeCodeService {
  private static readonly COLLECTION = "email_change_codes";
  private static readonly CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutos
  // 32 símbolos sin caracteres ambiguos (sin 0/O/1/I) -> 8 caracteres = 40 bits.
  private static readonly CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  private static readonly CODE_LENGTH = 8;
  private static readonly MAX_ATTEMPTS = 5;

  private static generateCode(): string {
    let code = "";
    for (let i = 0; i < this.CODE_LENGTH; i += 1) {
      code += this.CODE_ALPHABET[crypto.randomInt(0, this.CODE_ALPHABET.length)];
    }
    return code;
  }

  private static normalizeCode(code: unknown): string {
    return String(code ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  private static hashCode(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  private static codeMatches(storedHash: string, providedHash: string): boolean {
    if (
      storedHash.length !== providedHash.length ||
      storedHash.length === 0
    ) {
      return false;
    }
    try {
      return crypto.timingSafeEqual(
        Buffer.from(storedHash),
        Buffer.from(providedHash),
      );
    } catch {
      return false;
    }
  }

  static async createCode(
    userId: string,
  ): Promise<{ code: string; expiresAt: number }> {
    const code = this.generateCode();
    const now = Date.now();
    const expiresAt = now + this.CODE_EXPIRY_MS;

    const record: EmailChangeCodeRecord = {
      codeHash: this.hashCode(code),
      userId,
      createdAt: now,
      expiresAt: Timestamp.fromMillis(expiresAt),
      attempts: 0,
    };

    // Overwriting the per-user document invalidates any previous code.
    await getAdminDb()
      .collection(this.COLLECTION)
      .doc(userId)
      .set(record);

    await this.logSecurityEvent("email_change_code_requested", {
      userId,
      timestamp: now,
    });

    return { code, expiresAt };
  }

  /**
   * Validates the code and consumes it atomically. A wrong code increments an
   * attempt counter; after {@link MAX_ATTEMPTS} failures the code is discarded
   * so the caller must request a new one.
   */
  static async verifyAndConsume(params: {
    userId: string;
    code: unknown;
  }): Promise<VerifyEmailChangeCodeResult> {
    const normalized = this.normalizeCode(params.code);
    if (!normalized) {
      return { valid: false, error: "Código inválido" };
    }

    const providedHash = this.hashCode(normalized);
    const db = getAdminDb();
    const ref = db.collection(this.COLLECTION).doc(params.userId);

    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return { valid: false, error: "Código inválido" };
      }

      const data = snapshot.data() as Partial<EmailChangeCodeRecord>;
      const expiresAt =
        typeof (data.expiresAt as Timestamp | undefined)?.toMillis ===
        "function"
          ? (data.expiresAt as Timestamp).toMillis()
          : Number(data.expiresAt) || 0;
      const attempts = Number(data.attempts) || 0;

      if (Date.now() > expiresAt) {
        transaction.delete(ref);
        return { valid: false, error: "Código expirado" };
      }

      if (attempts >= this.MAX_ATTEMPTS) {
        transaction.delete(ref);
        return {
          valid: false,
          error: "Demasiados intentos. Solicita un nuevo código.",
        };
      }

      if (!this.codeMatches(String(data.codeHash || ""), providedHash)) {
        if (attempts + 1 >= this.MAX_ATTEMPTS) {
          transaction.delete(ref);
          return {
            valid: false,
            error: "Demasiados intentos. Solicita un nuevo código.",
          };
        }
        transaction.update(ref, { attempts: attempts + 1 });
        return { valid: false, error: "Código inválido" };
      }

      transaction.delete(ref);
      return { valid: true };
    });

    if (result.valid) {
      await this.logSecurityEvent("email_change_code_consumed", {
        userId: params.userId,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  private static async logSecurityEvent(
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await getAdminDb().collection("security_logs").add({
        type,
        ...payload,
      });
    } catch {
      // Best-effort; do not block the flow.
    }
  }
}
