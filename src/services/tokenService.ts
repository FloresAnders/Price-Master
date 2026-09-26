// src/services/tokenService.ts
import type { User } from "../types/firestore";

/**
 * Client-side session bookkeeping used by the UI (session timers, device-link
 * bootstrap). It stores an opaque random token plus expiry in localStorage.
 *
 * IMPORTANT: this is NOT an authentication boundary. It never protected the
 * server — the server trusts only the HMAC-hashed `timemaster_auth` cookie
 * session (`src/lib/auth/session-store.server.ts`). The previous implementation
 * "signed" tokens with a hardcoded secret and a non-cryptographic hash, which
 * gave a false sense of integrity; that is intentionally gone.
 */

// Interfaz para datos de sesión con token
interface TokenSessionData {
  token: string;
  refreshToken: string;
  user: Omit<User, "password">;
  sessionId: string;
  loginTime: string;
  lastActivity: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

const TOKEN_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos
const REFRESH_TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 días
const STORAGE_KEY = "timemaster_token_session";

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export class TokenService {
  /**
   * Genera un identificador opaco (no es un JWT firmado).
   */
  private static generateOpaqueToken(): string {
    return randomHex(32);
  }

  private static generateJwtId(): string {
    return `${Date.now().toString(36)}-${randomHex(8)}`;
  }

  private static generateSessionId(): string {
    return `${Date.now().toString(36)}${randomHex(4)}`;
  }

  /**
   * Crea una nueva sesión basada en tokens (estado local de UI).
   */
  static createTokenSession(userData: User): TokenSessionData {
    const now = Date.now();
    const sessionId = this.generateSessionId();

    // Copia segura del usuario sin contraseña (tipada, sin usar `any`)
    const safeUser: Omit<User, "password"> = {
      id: userData.id,
      name: userData.name,
      ownercompanie: userData.ownercompanie,
      ownerId: userData.ownerId,
      role: userData.role,
      permissions: userData.permissions,
      eliminate: userData.eliminate,
      photoUrl: userData.photoUrl,
      fullName: userData.fullName,
    };

    const sessionData: TokenSessionData = {
      token: this.generateOpaqueToken(),
      refreshToken: randomHex(32),
      user: safeUser,
      sessionId,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: now + TOKEN_DURATION,
      refreshExpiresAt: now + REFRESH_TOKEN_DURATION,
    };

    this.saveTokenSession(sessionData);

    return sessionData;
  }

  /**
   * Valida una sesión de token existente (solo expiración local).
   */
  static validateTokenSession(): TokenSessionData | null {
    try {
      const sessionData = this.getTokenSession();
      if (!sessionData) return null;

      if (Date.now() > sessionData.expiresAt) {
        return this.refreshTokenIfPossible(sessionData);
      }

      sessionData.lastActivity = new Date().toISOString();
      this.saveTokenSession(sessionData);

      return sessionData;
    } catch (error) {
      console.error("Error validating token session:", error);
      return null;
    }
  }

  /**
   * Intenta renovar el token usando el refresh token
   */
  private static refreshTokenIfPossible(
    sessionData: TokenSessionData,
  ): TokenSessionData | null {
    const now = Date.now();

    if (now > sessionData.refreshExpiresAt) {
      return null;
    }

    try {
      const newTokenSession = this.createTokenSession(sessionData.user);

      if (now < sessionData.refreshExpiresAt) {
        newTokenSession.refreshToken = sessionData.refreshToken;
        newTokenSession.refreshExpiresAt = sessionData.refreshExpiresAt;
        this.saveTokenSession(newTokenSession);
      }

      return newTokenSession;
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  }

  /**
   * Obtiene el tiempo restante del token en milisegundos
   */
  static getTokenTimeLeft(): number {
    const sessionData = this.getTokenSession();
    if (!sessionData) return 0;

    const timeLeft = sessionData.expiresAt - Date.now();
    return Math.max(0, timeLeft);
  }

  /**
   * Formatea el tiempo restante del token
   */
  static formatTokenTimeLeft(): string {
    const timeLeft = this.getTokenTimeLeft();

    if (timeLeft <= 0) return "Token expirado";

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Extiende el token por una semana más
   */
  static extendToken(): boolean {
    try {
      const sessionData = this.getTokenSession();
      if (!sessionData) return false;

      this.createTokenSession(sessionData.user);

      return true;
    } catch (error) {
      console.error("Error extending token:", error);
      return false;
    }
  }

  /**
   * Extiende el token por un tiempo personalizado
   */
  static extendTokenCustom(extensionMs: number): boolean {
    try {
      const sessionData = this.getTokenSession();
      if (!sessionData) return false;

      const now = Date.now();
      const currentExp = sessionData.expiresAt;
      const newExp = Math.max(currentExp, now) + extensionMs;

      const updatedSession: TokenSessionData = {
        ...sessionData,
        token: this.generateOpaqueToken(),
        refreshToken: randomHex(32),
        expiresAt: newExp,
        refreshExpiresAt: now + REFRESH_TOKEN_DURATION,
        lastActivity: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));

      return true;
    } catch (error) {
      console.error("Error extending token with custom duration:", error);
      return false;
    }
  }

  /**
   * Revoca el token actual (logout)
   */
  static revokeToken(): void {
    try {
      this.clearTokenSession();
    } catch (error) {
      console.error("Error revoking token:", error);
      this.clearTokenSession();
    }
  }

  /**
   * Guarda la sesión de token en localStorage
   */
  private static saveTokenSession(sessionData: TokenSessionData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error("Error saving token session:", error);
    }
  }

  /**
   * Obtiene la sesión de token desde localStorage
   */
  private static getTokenSession(): TokenSessionData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * Limpia la sesión de token
   */
  private static clearTokenSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing token session:", error);
    }
  }

  /**
   * Obtiene información del token actual
   */
  static getTokenInfo(): {
    isValid: boolean;
    timeLeft: number;
    user: User | null;
    sessionId: string | null;
    expiresAt: Date | null;
    token?: string | null;
  } {
    const sessionData = this.validateTokenSession();

    if (!sessionData) {
      return {
        isValid: false,
        timeLeft: 0,
        user: null,
        sessionId: null,
        expiresAt: null,
      };
    }

    return {
      isValid: true,
      timeLeft: this.getTokenTimeLeft(),
      user: sessionData.user as User,
      sessionId: sessionData.sessionId,
      expiresAt: new Date(sessionData.expiresAt),
      token: sessionData.token,
    };
  }

  /** Returns raw stored token string if available */
  static getRawToken(): string | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      return parsed?.token ?? null;
    } catch {
      return null;
    }
  }
}
