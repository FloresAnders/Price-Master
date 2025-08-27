// src/services/tokenService.ts
import type { User, UserPermissions } from '../types/firestore';

// Interfaz para el payload del token
interface TokenPayload {
  userId: string;
  name: string;
  location?: string;
  role: 'admin' | 'user' | 'superadmin';
  permissions?: UserPermissions;
  sessionId: string;
  iat: number; // issued at
  exp: number; // expires at
  jti: string; // JWT ID (identificador único del token)
}

// Interfaz para datos de sesión con token
interface TokenSessionData {
  token: string;
  refreshToken: string;
  user: User;
  sessionId: string;
  loginTime: string;
  lastActivity: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

export class TokenService {
  private static readonly SECRET_KEY = 'pricemaster_secret_2024'; // En producción usar variable de entorno
  private static readonly TOKEN_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos
  private static readonly REFRESH_TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 días en milisegundos
  private static readonly STORAGE_KEY = 'pricemaster_token_session';

  /**
   * Genera un token simple (sin librería JWT para simplicidad)
   */
  private static generateSimpleToken(payload: TokenPayload): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    
    // Generar una "firma" simple basada en hash
    const signature = btoa(
      this.generateHash(`${encodedHeader}.${encodedPayload}.${this.SECRET_KEY}`)
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Valida un token simple
   */
  private static validateSimpleToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, signature] = parts;
      
      // Verificar firma
      const expectedSignature = btoa(
        this.generateHash(`${encodedHeader}.${encodedPayload}.${this.SECRET_KEY}`)
      );
      
      if (signature !== expectedSignature) {
        console.error('Token signature invalid');
        return null;
      }

      const payload: TokenPayload = JSON.parse(atob(encodedPayload));
      
      // Verificar expiración
      if (Date.now() > payload.exp) {
        console.error('Token expired');
        return null;
      }

      return payload;
    } catch (error) {
      console.error('Error validating token:', error);
      return null;
    }
  }

  /**
   * Genera un hash simple para la firma
   */
  private static generateHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Genera un ID único para el token
   */
  private static generateJwtId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Genera un refresh token
   */
  private static generateRefreshToken(): string {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Crea una nueva sesión basada en tokens
   */
  static createTokenSession(userData: User): TokenSessionData {
    const now = Date.now();
    const sessionId = this.generateSessionId();
    const jwtId = this.generateJwtId();

    // Copia segura del usuario sin contraseña
    const { password, ...safeUser } = userData as any;

    const tokenPayload: TokenPayload = {
      userId: userData.id!,
      name: userData.name,
      location: userData.location,
      role: userData.role!,
      permissions: userData.permissions,
      sessionId,
      iat: now,
      exp: now + this.TOKEN_DURATION,
      jti: jwtId
    };

    const token = this.generateSimpleToken(tokenPayload);
    const refreshToken = this.generateRefreshToken();

    const sessionData: TokenSessionData = {
      token,
      refreshToken,
      user: safeUser,
      sessionId,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: now + this.TOKEN_DURATION,
      refreshExpiresAt: now + this.REFRESH_TOKEN_DURATION
    };

    // Guardar en localStorage
    this.saveTokenSession(sessionData);

    return sessionData;
  }

  /**
   * Valida una sesión de token existente
   */
  static validateTokenSession(): TokenSessionData | null {
    try {
      const sessionData = this.getTokenSession();
      if (!sessionData) return null;

      // Validar token
      const payload = this.validateSimpleToken(sessionData.token);
      if (!payload) {
        // Token inválido, intentar renovar con refresh token
        return this.refreshTokenIfPossible(sessionData);
      }

      // Actualizar última actividad
      sessionData.lastActivity = new Date().toISOString();
      this.saveTokenSession(sessionData);

      return sessionData;
    } catch (error) {
      console.error('Error validating token session:', error);
      return null;
    }
  }

  /**
   * Intenta renovar el token usando el refresh token
   */
  private static refreshTokenIfPossible(sessionData: TokenSessionData): TokenSessionData | null {
    const now = Date.now();
    
    // Verificar si el refresh token aún es válido
    if (now > sessionData.refreshExpiresAt) {
      console.log('Refresh token expired');
      return null;
    }

    try {
      // Crear nuevo token con la misma información del usuario
      const newTokenSession = this.createTokenSession(sessionData.user);
      
      // Mantener el refresh token original si aún es válido
      if (now < sessionData.refreshExpiresAt) {
        newTokenSession.refreshToken = sessionData.refreshToken;
        newTokenSession.refreshExpiresAt = sessionData.refreshExpiresAt;
      }

      console.log('Token refreshed successfully');
      return newTokenSession;
    } catch (error) {
      console.error('Error refreshing token:', error);
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
    
    if (timeLeft <= 0) return 'Token expirado';
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
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

      // Crear nuevo token con tiempo extendido
      this.createTokenSession(sessionData.user);
      
      console.log('Token extended for one more week');
      return true;
    } catch (error) {
      console.error('Error extending token:', error);
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

      // Crear payload actualizado
      const newPayload: TokenPayload = {
        userId: sessionData.user.id || '',
        name: sessionData.user.name,
        location: sessionData.user.location,
        role: sessionData.user.role as 'admin' | 'user' | 'superadmin',
        permissions: sessionData.user.permissions,
        sessionId: sessionData.sessionId,
        iat: now,
        exp: newExp,
        jti: this.generateSessionId()
      };

      // Generar nuevo token
      const newToken = this.generateSimpleToken(newPayload);
      const newRefreshToken = this.generateRefreshToken();

      // Actualizar sesión almacenada
      const updatedSession: TokenSessionData = {
        ...sessionData,
        token: newToken,
        refreshToken: newRefreshToken,
        expiresAt: newExp,
        refreshExpiresAt: now + this.REFRESH_TOKEN_DURATION,
        lastActivity: new Date().toISOString()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSession));
      
      console.log(`Token extended by ${extensionMs / (1000 * 60 * 60)} hours`);
      return true;
    } catch (error) {
      console.error('Error extending token with custom duration:', error);
      return false;
    }
  }

  /**
   * Revoca el token actual (logout)
   */
  static revokeToken(): void {
    try {
      // Agregar token a lista de tokens revocados (para mayor seguridad)
      const sessionData = this.getTokenSession();
      if (sessionData) {
        const revokedTokens = this.getRevokedTokens();
        const payload = this.validateSimpleToken(sessionData.token);
        if (payload) {
          revokedTokens.push({
            jti: payload.jti,
            revokedAt: Date.now(),
            userId: payload.userId
          });
          localStorage.setItem('pricemaster_revoked_tokens', JSON.stringify(revokedTokens));
        }
      }

      // Limpiar sesión
      this.clearTokenSession();
    } catch (error) {
      console.error('Error revoking token:', error);
      this.clearTokenSession(); // Limpiar de todas formas
    }
  }

  /**
   * Verifica si un token está revocado
   */
  private static isTokenRevoked(jti: string): boolean {
    try {
      const revokedTokens = this.getRevokedTokens();
      return revokedTokens.some(token => token.jti === jti);
    } catch {
      return false;
    }
  }

  /**
   * Obtiene la lista de tokens revocados
   */
  private static getRevokedTokens(): Array<{jti: string, revokedAt: number, userId: string}> {
    try {
      const stored = localStorage.getItem('pricemaster_revoked_tokens');
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  /**
   * Guarda la sesión de token en localStorage
   */
  private static saveTokenSession(sessionData: TokenSessionData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error saving token session:', error);
    }
  }

  /**
   * Obtiene la sesión de token desde localStorage
   */
  private static getTokenSession(): TokenSessionData | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
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
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing token session:', error);
    }
  }

  /**
   * Genera un ID de sesión único
   */
  private static generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `${timestamp}${random}`;
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
  } {
    const sessionData = this.validateTokenSession();
    
    if (!sessionData) {
      return {
        isValid: false,
        timeLeft: 0,
        user: null,
        sessionId: null,
        expiresAt: null
      };
    }

    return {
      isValid: true,
      timeLeft: this.getTokenTimeLeft(),
      user: sessionData.user,
      sessionId: sessionData.sessionId,
      expiresAt: new Date(sessionData.expiresAt)
    };
  }

  /**
   * Limpia tokens expirados y revocados antiguos (maintenance)
   */
  static cleanupExpiredTokens(): void {
    try {
      const revokedTokens = this.getRevokedTokens();
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      // Mantener solo tokens revocados de la última semana
      const cleanedTokens = revokedTokens.filter(token => token.revokedAt > oneWeekAgo);
      
      localStorage.setItem('pricemaster_revoked_tokens', JSON.stringify(cleanedTokens));
    } catch (error) {
      console.error('Error cleaning up tokens:', error);
    }
  }
}
