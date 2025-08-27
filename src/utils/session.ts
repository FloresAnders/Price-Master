// src/utils/session.ts
import type { User as FirestoreUser } from '@/types/firestore';

export interface SessionData extends FirestoreUser {
  loginTimestamp: number;
  expiresAt: number;
}

export const SESSION_DURATION = 5 * 60 * 60 * 1000; // 5 horas en milisegundos
export const SESSION_STORAGE_KEY = 'simple_login_user';

/**
 * Crea una nueva sesión con timestamp de expiración
 */
export function createSession(user: FirestoreUser): SessionData {
  const now = Date.now();
  return {
    ...user,
    loginTimestamp: now,
    expiresAt: now + SESSION_DURATION
  };
}

/**
 * Guarda la sesión en localStorage
 */
export function saveSession(sessionData: SessionData): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  }
}

/**
 * Obtiene la sesión desde localStorage
 */
export function getSession(): SessionData | null {
  if (typeof window === 'undefined') return null;

  const storedData = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!storedData) return null;

  try {
    return JSON.parse(storedData) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Verifica si la sesión actual es válida (existe y no ha expirado)
 */
export function isSessionValid(): boolean {
  const session = getSession();
  if (!session) return false;

  // Verificar si tiene timestamp de expiración y si no ha expirado
  if (session.expiresAt && Date.now() > session.expiresAt) {
    return false;
  }

  return true;
}

/**
 * Calcula el tiempo restante de la sesión en milisegundos
 */
export function getSessionTimeLeft(): number {
  const session = getSession();
  if (!session || !session.expiresAt) return 0;

  const timeLeft = session.expiresAt - Date.now();
  return Math.max(0, timeLeft);
}

/**
 * Formatea el tiempo restante de sesión en un string legible
 */
export function formatSessionTimeLeft(): string {
  const timeLeft = getSessionTimeLeft();

  if (timeLeft <= 0) return 'Sesión expirada';

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
 * Limpia la sesión del localStorage
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

/**
 * Hook personalizado para manejar la verificación de sesión
 */
export function useSessionCheck(onExpired?: () => void): {
  isValid: boolean;
  timeLeft: string;
  session: SessionData | null;
} {
  const session = getSession();
  const isValid = isSessionValid();
  const timeLeft = formatSessionTimeLeft();

  // Si la sesión ha expirado y hay un callback, ejecutarlo
  if (!isValid && session && onExpired) {
    onExpired();
  }

  return {
    isValid,
    timeLeft,
    session
  };
}
