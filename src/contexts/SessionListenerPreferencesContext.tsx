"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_SESSION_LISTENER_PREFERENCES,
  getSessionListenerPreferences,
  setSessionListenerPreference,
  type SessionListenerPreferenceKey,
  type SessionListenerPreferences,
} from "@/services/layoutPrefsDb";

type SessionListenerPreferencesContextValue = {
  preferences: SessionListenerPreferences;
  loaded: boolean;
  setPreference: (
    preference: SessionListenerPreferenceKey,
    enabled: boolean,
  ) => Promise<void>;
};

type StoredPreferenceState = {
  userId: string;
  preferences: SessionListenerPreferences;
  loaded: boolean;
};

const SessionListenerPreferencesContext = createContext<
  SessionListenerPreferencesContextValue | undefined
>(undefined);

export function SessionListenerPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const userId = String(user?.id || "").trim();
  const writeVersionsRef = useRef<Record<SessionListenerPreferenceKey, number>>({
    pendingCompanyRequests: 0,
    chatReadMuteState: 0,
  });
  const [storedState, setStoredState] = useState<StoredPreferenceState>(() => ({
    userId: "",
    preferences: { ...DEFAULT_SESSION_LISTENER_PREFERENCES },
    loaded: false,
  }));
  const currentState =
    storedState.userId === userId
      ? storedState
      : {
          userId,
          preferences: { ...DEFAULT_SESSION_LISTENER_PREFERENCES },
          loaded: false,
        };

  useEffect(() => {
    let cancelled = false;
    if (!userId) return () => void (cancelled = true);

    void getSessionListenerPreferences(userId)
      .then((storedPreferences) => {
        if (!cancelled) {
          setStoredState({
            userId,
            preferences: storedPreferences,
            loaded: true,
          });
        }
      })
      .catch((error) => {
        console.warn(
          "No se pudieron cargar los permisos de listeners de sesión",
          error,
        );
        if (!cancelled) {
          setStoredState({
            userId,
            preferences: { ...DEFAULT_SESSION_LISTENER_PREFERENCES },
            loaded: true,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setPreference = useCallback(
    async (
      preference: SessionListenerPreferenceKey,
      enabled: boolean,
    ): Promise<void> => {
      if (!userId) return;
      const writeVersion = ++writeVersionsRef.current[preference];
      setStoredState((current) => ({
        userId,
        loaded: true,
        preferences: {
          ...(current.userId === userId
            ? current.preferences
            : DEFAULT_SESSION_LISTENER_PREFERENCES),
          [preference]: enabled,
        },
      }));

      try {
        await setSessionListenerPreference(userId, preference, enabled);
      } catch (error) {
        if (
          enabled &&
          writeVersionsRef.current[preference] === writeVersion
        ) {
          setStoredState((current) => {
            if (current.userId !== userId) return current;
            return {
              ...current,
              preferences: {
                ...current.preferences,
                [preference]: false,
              },
            };
          });
        }
        throw error;
      }
    },
    [userId],
  );

  return (
    <SessionListenerPreferencesContext.Provider
      value={{
        preferences: currentState.preferences,
        loaded: currentState.loaded,
        setPreference,
      }}
    >
      {children}
    </SessionListenerPreferencesContext.Provider>
  );
}

export function useSessionListenerPreferences(): SessionListenerPreferencesContextValue {
  const context = useContext(SessionListenerPreferencesContext);
  if (!context) {
    throw new Error(
      "useSessionListenerPreferences debe usarse dentro de SessionListenerPreferencesProvider",
    );
  }
  return context;
}
