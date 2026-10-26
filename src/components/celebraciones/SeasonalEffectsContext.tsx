"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_SEASONAL_EFFECTS_SETTINGS,
  validateSeasonalEffectsSettings,
} from "./config/festivities";
import {
  readSeasonalEffectsSettings,
  saveSeasonalEffectsSettings,
} from "@/services/seasonal-effects";
import type {
  FestivityId,
  SeasonalEffectsSettings,
} from "./types";

interface SeasonalEffectsAuth {
  authenticated: boolean;
  ready: boolean;
  uid: string;
  role: string;
}

interface SeasonalEffectsContextValue {
  settings: SeasonalEffectsSettings;
  loading: boolean;
  error: string | null;
  previewId: FestivityId | null;
  setPreviewId: (id: FestivityId | null) => void;
  saveSettings: (settings: SeasonalEffectsSettings) => Promise<void>;
}

interface StateProviderProps {
  auth: SeasonalEffectsAuth;
  children: ReactNode;
  loadSettings?: () => Promise<SeasonalEffectsSettings>;
  persistSettings?: (
    settings: SeasonalEffectsSettings,
    actorUid: string,
  ) => Promise<void>;
}

const SeasonalEffectsContext = createContext<SeasonalEffectsContextValue | null>(null);

const cloneDefaults = (): SeasonalEffectsSettings => ({
  ...DEFAULT_SEASONAL_EFFECTS_SETTINGS,
  festivities: DEFAULT_SEASONAL_EFFECTS_SETTINGS.festivities.map((item) => ({
    ...item,
  })),
});

export function SeasonalEffectsStateProvider({
  auth,
  children,
  loadSettings = readSeasonalEffectsSettings,
  persistSettings = saveSeasonalEffectsSettings,
}: StateProviderProps) {
  const [settings, setSettings] = useState<SeasonalEffectsSettings>(cloneDefaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<FestivityId | null>(null);

  useEffect(() => {
    let active = true;
    if (!auth.authenticated || !auth.ready || !auth.uid) {
      const timer = window.setTimeout(() => {
        if (!active) return;
        setSettings(cloneDefaults());
        setLoading(!auth.ready);
        setError(null);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }
    void Promise.resolve()
      .then(() => {
        if (active) setLoading(true);
        return loadSettings();
      })
      .then((loaded) => {
        if (!active) return;
        setSettings(loaded);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        console.warn("No se pudo cargar la configuración de celebraciones", loadError);
        setSettings(cloneDefaults());
        setError("No se pudo cargar la configuración de celebraciones. Se usan valores seguros.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth.authenticated, auth.ready, auth.uid, loadSettings]);

  const saveSettings = useCallback(
    async (nextSettings: SeasonalEffectsSettings) => {
      if (
        auth.role !== "superadmin" ||
        !auth.authenticated ||
        !auth.ready ||
        !auth.uid
      ) {
        throw new Error("Solo SuperAdmin puede guardar celebraciones.");
      }
      const validationErrors = validateSeasonalEffectsSettings(nextSettings);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(" "));
      }
      await persistSettings(nextSettings, auth.uid);
      setSettings({
        ...nextSettings,
        festivities: nextSettings.festivities.map((item) => ({ ...item })),
      });
      setError(null);
    },
    [auth.authenticated, auth.ready, auth.role, auth.uid, persistSettings],
  );

  const value = useMemo<SeasonalEffectsContextValue>(
    () => ({
      settings,
      loading,
      error,
      previewId,
      setPreviewId,
      saveSettings,
    }),
    [error, loading, previewId, saveSettings, settings],
  );

  return (
    <SeasonalEffectsContext.Provider value={value}>
      {children}
    </SeasonalEffectsContext.Provider>
  );
}

export function SeasonalEffectsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, firebaseAuthReady } = useAuth();
  return (
    <SeasonalEffectsStateProvider
      auth={{
        authenticated: isAuthenticated,
        ready: firebaseAuthReady,
        uid: String(user?.id || ""),
        role: String(user?.role || "user"),
      }}
    >
      {children}
    </SeasonalEffectsStateProvider>
  );
}

export function useSeasonalEffects(): SeasonalEffectsContextValue {
  const context = useContext(SeasonalEffectsContext);
  if (!context) {
    throw new Error("useSeasonalEffects debe utilizarse dentro de SeasonalEffectsProvider.");
  }
  return context;
}
