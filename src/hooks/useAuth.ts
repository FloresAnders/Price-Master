"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/types/firestore";
import { SESSION_DURATION_HOURS } from "@/lib/auth/session-policy";
import {
  claimSessionHeartbeatLease,
  releaseSessionHeartbeatLease,
} from "@/lib/auth/session-heartbeat";
import { normalizeUserPermissions } from "@/utils/permissions";
import { UsersService } from "@/services/users";
import { subscribeToVersionDoc } from "@/services/version-doc";

const AUTH_STATE_EVENT = "timemaster-auth-state";
const AUTH_SYNC_STORAGE_KEY = "pricemaster_auth_sync";
const STORAGE_VERSION_KEY = "pricemaster_storage_version";

interface ServerSessionPayload {
  ok: boolean;
  user?: User;
  session?: {
    authMethod?: "password" | "passkey";
    expiresAt?: number;
  };
}

interface AuthStateDetail {
  user: User | null;
  expiresAt: number | null;
}

interface ServerSessionResult {
  ok: boolean;
  payload: ServerSessionPayload | null;
}

function normalizedUser(user: User): User {
  return {
    ...user,
    ownerId: user.ownerId || "",
    eliminate: user.eliminate ?? false,
    permissions: normalizeUserPermissions(
      user.permissions,
      user.role || "user",
    ),
  };
}

function clearLegacyAuthState(): void {
  localStorage.removeItem("pricemaster_session");
  localStorage.removeItem("pricemaster_session_id");
  localStorage.removeItem("pricemaster_token_session");
}

function publishAuthState(detail: AuthStateDetail): void {
  window.dispatchEvent(
    new CustomEvent<AuthStateDetail>(AUTH_STATE_EVENT, { detail }),
  );
}

function publishAuthSync(
  message:
    | { type: "logout" }
    | { type: "heartbeat"; expiresAt: number | null },
): void {
  try {
    localStorage.setItem(
      AUTH_SYNC_STORAGE_KEY,
      JSON.stringify({
        ...message,
        nonce:
          globalThis.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }),
    );
  } catch {
    // La sincronización local es auxiliar; la cookie sigue siendo la autoridad.
  }
}

function useAuthState() {
  const sessionCheckGeneration = useRef(0);
  const sessionRequestInFlight = useRef<Promise<ServerSessionResult> | null>(
    null,
  );
  const heartbeatOwnerId = useRef(
    globalThis.crypto?.randomUUID?.() ||
      `heartbeat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionWarning, setSessionWarning] = useState(false);

  const applyAuthState = useCallback((detail: AuthStateDetail) => {
    setUser(detail.user);
    setIsAuthenticated(Boolean(detail.user));
    setSessionExpiresAt(detail.expiresAt);
    if (!detail.user) setSessionWarning(false);
  }, []);

  const invalidateSessionChecks = useCallback(() => {
    sessionCheckGeneration.current += 1;
    sessionRequestInFlight.current = null;
  }, []);

  const clearClientSession = useCallback((broadcast = true) => {
    invalidateSessionChecks();
    releaseSessionHeartbeatLease(localStorage, heartbeatOwnerId.current);
    clearLegacyAuthState();
    localStorage.removeItem("pricemaster_user_phash");
    const next = { user: null, expiresAt: null };
    applyAuthState(next);
    publishAuthState(next);
    if (broadcast) publishAuthSync({ type: "logout" });
    setLoading(false);
  }, [applyAuthState, invalidateSessionChecks]);

  const requestServerSession = useCallback((): Promise<ServerSessionResult> => {
    if (!sessionRequestInFlight.current) {
      const request = fetch("/api/auth/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }).then(async (response) => ({
        ok: response.ok,
        payload: (await response.json().catch(() => null)) as
          | ServerSessionPayload
          | null,
      }));

      sessionRequestInFlight.current = request;
      void request.then(
        () => {
          if (sessionRequestInFlight.current === request) {
            sessionRequestInFlight.current = null;
          }
        },
        () => {
          if (sessionRequestInFlight.current === request) {
            sessionRequestInFlight.current = null;
          }
        },
      );
    }

    return sessionRequestInFlight.current;
  }, []);

  const checkExistingSession = useCallback(async () => {
    const requestGeneration = ++sessionCheckGeneration.current;
    try {
      const { ok, payload } = await requestServerSession();
      if (requestGeneration !== sessionCheckGeneration.current) return;
      clearLegacyAuthState();

      if (!ok || !payload?.ok || !payload.user) {
        applyAuthState({ user: null, expiresAt: null });
        return;
      }

      applyAuthState({
        user: normalizedUser(payload.user),
        expiresAt: Number(payload.session?.expiresAt || 0) || null,
      });
    } catch (error) {
      if (requestGeneration !== sessionCheckGeneration.current) return;
      console.warn("No se pudo verificar la sesión del servidor", error);
      applyAuthState({ user: null, expiresAt: null });
    } finally {
      if (requestGeneration === sessionCheckGeneration.current) {
        setLoading(false);
      }
    }
  }, [applyAuthState, requestServerSession]);

  const checkSessionHeartbeat = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session/heartbeat", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | ServerSessionPayload
        | null;
      if (response.status === 401) {
        clearClientSession();
        return;
      }
      if (!response.ok || !payload?.ok) {
        releaseSessionHeartbeatLease(localStorage, heartbeatOwnerId.current);
        console.warn("El servidor no pudo renovar la sesión temporalmente");
        return;
      }
      const expiresAt = Number(payload.session?.expiresAt || 0) || null;
      setSessionExpiresAt(expiresAt);
      publishAuthSync({ type: "heartbeat", expiresAt });
    } catch (error) {
      releaseSessionHeartbeatLease(localStorage, heartbeatOwnerId.current);
      console.warn("No se pudo renovar la sesión del servidor", error);
    }
  }, [clearClientSession]);

  useEffect(() => {
    const heartbeatOwner = heartbeatOwnerId.current;
    void checkExistingSession();
    claimSessionHeartbeatLease(
      localStorage,
      heartbeatOwner,
      Date.now(),
    );
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      if (
        !claimSessionHeartbeatLease(
          localStorage,
          heartbeatOwner,
          Date.now(),
        )
      ) {
        return;
      }
      void checkSessionHeartbeat();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      sessionCheckGeneration.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      releaseSessionHeartbeatLease(localStorage, heartbeatOwner);
    };
  }, [checkExistingSession, checkSessionHeartbeat]);

  useEffect(() => {
    const handleAuthState = (event: Event) => {
      invalidateSessionChecks();
      applyAuthState((event as CustomEvent<AuthStateDetail>).detail);
      setLoading(false);
    };
    window.addEventListener(AUTH_STATE_EVENT, handleAuthState);
    return () => window.removeEventListener(AUTH_STATE_EVENT, handleAuthState);
  }, [applyAuthState, invalidateSessionChecks]);

  useEffect(() => {
    const handleAuthSync = (event: StorageEvent) => {
      if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
      try {
        const message = JSON.parse(event.newValue) as {
          type?: string;
          expiresAt?: unknown;
        };
        if (message.type === "logout") {
          clearClientSession(false);
          return;
        }
        if (message.type === "heartbeat") {
          const expiresAt = Number(message.expiresAt || 0) || null;
          setSessionExpiresAt(expiresAt);
        }
      } catch {
        // Ignorar mensajes corruptos o escritos por versiones antiguas.
      }
    };
    window.addEventListener("storage", handleAuthSync);
    return () => window.removeEventListener("storage", handleAuthSync);
  }, [clearClientSession]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    return UsersService.subscribeToUser(
      user.id,
      (updatedUser) => {
        if (!updatedUser || updatedUser.isActive === false) {
          clearClientSession();
          void fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
            keepalive: true,
          }).catch(() => undefined);
          return;
        }
        setUser(normalizedUser(updatedUser));
      },
      (error) => console.warn("No se pudo actualizar el usuario autenticado", error),
    );
  }, [clearClientSession, isAuthenticated, user?.id]);

  const logout = useCallback(async (_reason?: string) => {
    void _reason;
    clearClientSession();
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      });
    } catch {
      // El estado local se limpia aunque la red falle; la cookie sigue siendo
      // la autoridad y se volverá a comprobar en la siguiente carga.
    }
  }, [clearClientSession]);

  useEffect(() => {
    return subscribeToVersionDoc((snapshot) => {
      const nextVersion = snapshot?.versionstorage?.trim();
      if (!nextVersion) return;
      const previousVersion = localStorage.getItem(STORAGE_VERSION_KEY);
      if (!previousVersion) {
        localStorage.setItem(STORAGE_VERSION_KEY, nextVersion);
        return;
      }
      if (previousVersion !== nextVersion) {
        localStorage.setItem(STORAGE_VERSION_KEY, nextVersion);
        void logout("storage_version_changed").finally(() => {
          window.location.reload();
        });
      }
    });
  }, [logout]);

  useEffect(() => {
    const updateWarning = () => {
      const timeLeft = sessionExpiresAt ? sessionExpiresAt - Date.now() : 0;
      setSessionWarning(
        user?.role === "superadmin" &&
          timeLeft > 0 &&
          timeLeft <= 30 * 60 * 1000,
      );
    };
    updateWarning();
    const interval = window.setInterval(updateWarning, 60_000);
    return () => window.clearInterval(interval);
  }, [sessionExpiresAt, user?.role]);

  const login = useCallback(
    (userData: User, _keepActive = false, _useTokens = false) => {
      void _keepActive;
      void _useTokens;
      invalidateSessionChecks();
      clearLegacyAuthState();
      const safeUser = normalizedUser(userData);
      const role = safeUser.role || "user";
      const expiresAt =
        Date.now() + SESSION_DURATION_HOURS[role] * 60 * 60 * 1000;
      const next = { user: safeUser, expiresAt };
      applyAuthState(next);
      publishAuthState(next);
      setLoading(false);
    },
    [applyAuthState, invalidateSessionChecks],
  );

  const getSessionTimeLeft = useCallback(() => {
    if (!user || !isAuthenticated || !sessionExpiresAt) return 0;
    return Math.max(0, (sessionExpiresAt - Date.now()) / (1000 * 60 * 60));
  }, [isAuthenticated, sessionExpiresAt, user]);

  const getFormattedTimeLeft = useCallback(() => {
    const totalMinutes = Math.floor(getSessionTimeLeft() * 60);
    if (totalMinutes <= 0) return "Sesión expirada";
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [getSessionTimeLeft]);

  const isAdmin = useCallback(
    () => user?.role === "admin" || user?.role === "superadmin",
    [user?.role],
  );
  const isSuperAdmin = useCallback(
    () => user?.role === "superadmin",
    [user?.role],
  );
  const canChangeOwnercompanie = isAdmin;
  const requiresTwoFactor = isAdmin;
  const updateActivity = useCallback(() => undefined, []);
  const getSessionType = useCallback(() => "server", []);

  return {
    user,
    isAuthenticated,
    loading,
    sessionWarning,
    useTokenAuth: false,
    login,
    logout,
    isAdmin,
    isSuperAdmin,
    canChangeOwnercompanie,
    requiresTwoFactor,
    getSessionTimeLeft,
    updateActivity,
    getSessionType,
    getFormattedTimeLeft,
  };
}

type AuthContextValue = ReturnType<typeof useAuthState>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  return createElement(AuthContext.Provider, { value: auth }, children);
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return auth;
}
