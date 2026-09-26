import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { RecoveryToken } from "../types/recovery";

/**
 * Server-only recovery-token service. Runs through Firebase Admin so it does
 * not depend on Firestore security rules.
 */
export class RecoveryTokenService {
  private static readonly COLLECTION = "recovery_tokens";
  private static readonly TOKEN_EXPIRY = 1800000; // 30 minutos en ms

  /**
   * Genera un token criptográficamente seguro
   */
  private static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Hash del token para almacenamiento seguro en BD
   */
  private static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Crea un nuevo token de recuperación
   */
  static async createRecoveryToken(
    email: string,
    userId: string,
  ): Promise<{ token: string; expiresAt: number }> {
    const plainToken = this.generateSecureToken();
    const hashedToken = this.hashToken(plainToken);

    const now = Date.now();
    const expiresAt = now + this.TOKEN_EXPIRY;

    // Invalida tokens anteriores del mismo usuario
    await this.invalidatePreviousTokens(email);

    const recoveryToken: RecoveryToken = {
      token: hashedToken,
      email,
      userId,
      createdAt: now,
      expiresAt,
      used: false,
    };

    await getAdminDb().collection(this.COLLECTION).add(recoveryToken);

    await this.logRecoveryRequest(email, userId);

    // Retorna el token SIN hashear para enviarlo por email
    return {
      token: plainToken,
      expiresAt,
    };
  }

  /**
   * Valida un token de recuperación
   */
  static async validateToken(token: string): Promise<{
    valid: boolean;
    email?: string;
    userId?: string;
    error?: string;
  }> {
    const hashedToken = this.hashToken(token);

    const snapshot = await getAdminDb()
      .collection(this.COLLECTION)
      .where("token", "==", hashedToken)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { valid: false, error: "Token inválido" };
    }

    const tokenDoc = snapshot.docs[0];
    const recoveryToken = tokenDoc.data() as RecoveryToken;

    // Verifica si ya fue usado
    if (recoveryToken.used) {
      return { valid: false, error: "Token ya utilizado" };
    }

    // Verifica expiración
    if (Date.now() > recoveryToken.expiresAt) {
      await tokenDoc.ref.delete();
      return { valid: false, error: "Token expirado" };
    }

    return {
      valid: true,
      email: recoveryToken.email,
      userId: recoveryToken.userId,
    };
  }

  /**
   * Marca un token como usado y lo elimina
   */
  static async markTokenAsUsed(token: string): Promise<void> {
    const hashedToken = this.hashToken(token);

    const snapshot = await getAdminDb()
      .collection(this.COLLECTION)
      .where("token", "==", hashedToken)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }
  }

  /**
   * Invalida y elimina todos los tokens anteriores de un usuario
   */
  private static async invalidatePreviousTokens(email: string): Promise<void> {
    const snapshot = await getAdminDb()
      .collection(this.COLLECTION)
      .where("email", "==", email)
      .where("used", "==", false)
      .get();

    await Promise.all(snapshot.docs.map((docSnapshot) => docSnapshot.ref.delete()));
  }

  /**
   * Registra solicitud de recuperación en logs
   */
  private static async logRecoveryRequest(
    email: string,
    userId: string,
  ): Promise<void> {
    await getAdminDb().collection("security_logs").add({
      type: "password_recovery_request",
      email,
      userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Limpia tokens expirados (ejecutar periódicamente)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const snapshot = await getAdminDb()
      .collection(this.COLLECTION)
      .where("expiresAt", "<", Date.now())
      .get();

    await Promise.all(snapshot.docs.map((docSnapshot) => docSnapshot.ref.delete()));

    return snapshot.size;
  }
}
