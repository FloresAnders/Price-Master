"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@/types/firestore";
import { normalizeUserPermissions } from "@/utils/permissions";
import { UsersService } from "@/services/users";
import { subscribeToVersionDoc } from "@/services/version-doc";

const AUTH_STATE_EVENT = "timemaster-auth-state";
const STORAGE_VERSION_KEY = "pricemaster_storage_version";

const SESSION_DURATION_HOURS = {
  superadmin: 4,
  admin: 4,
  user: 720,
} as const;

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

export function useAuth() {
  const sessionCheckGeneration = useRef(0);
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

  const checkExistingSession = useCallback(async () => {
    const requestGeneration = ++sessionCheckGeneration.current;
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | ServerSessionPayload
        | null;
      if (requestGeneration !== sessionCheckGeneration.current) return;
      clearLegacyAuthState();

      if (!response.ok || !payload?.ok || !payload.user) {
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
  }, [applyAuthState]);

  useEffect(() => {
    void checkExistingSession();
    const refresh = () => void checkExistingSession();
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [checkExistingSession]);

  useEffect(() => {
    const handleAuthState = (event: Event) => {
      sessionCheckGeneration.current += 1;
      applyAuthState((event as CustomEvent<AuthStateDetail>).detail);
      setLoading(false);
    };
    window.addEventListener(AUTH_STATE_EVENT, handleAuthState);
    return () => window.removeEventListener(AUTH_STATE_EVENT, handleAuthState);
  }, [applyAuthState]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    return UsersService.subscribeToUser(
      user.id,
      (updatedUser) => {
        if (!updatedUser) return;
        setUser(normalizedUser(updatedUser));
      },
      (error) => console.warn("No se pudo actualizar el usuario autenticado", error),
    );
  }, [isAuthenticated, user?.id]);

  const logout = useCallback(async (_reason?: string) => {
    void _reason;
    sessionCheckGeneration.current += 1;
    clearLegacyAuthState();
    localStorage.removeItem("pricemaster_user_phash");
    const next = { user: null, expiresAt: null };
    applyAuthState(next);
    publishAuthState(next);
    setLoading(false);
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
  }, [applyAuthState]);

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
    [applyAuthState],
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
