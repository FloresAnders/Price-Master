"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSeasonalEffects } from "../SeasonalEffectsContext";
import { DEFAULT_SEASONAL_EFFECTS_SETTINGS } from "../config/festivities";
import { getNextCostaRicaMidnightTimestamp } from "../lib/costaRicaDate";
import { resolveActiveFestivity } from "../lib/resolveActiveFestivity";
import type { FestivityId, SeasonalEffectsSettings } from "../types";
import FestivityBanner from "./FestivityBanner";
import styles from "../styles/seasonal-effects.module.css";

const FestivityEffect = lazy(() => import("./effects/FestivityEffect"));

interface SeasonalEffectsViewProps {
  settings: SeasonalEffectsSettings;
  now: Date;
  previewId?: FestivityId | null;
  onHide?: (id: FestivityId, dateKey: string) => void;
  animationEnabled?: boolean;
  previewMode?: boolean;
}

export function SeasonalEffectsView({
  settings,
  now,
  previewId = null,
  onHide,
  animationEnabled = true,
  previewMode = false,
}: SeasonalEffectsViewProps) {
  const resolved = useMemo(() => {
    if (previewId) {
      const config = settings.festivities.find((item) => item.id === previewId) ??
        DEFAULT_SEASONAL_EFFECTS_SETTINGS.festivities.find((item) => item.id === previewId);
      return config ? { config, dateKey: `preview-${previewId}` } : null;
    }
    return resolveActiveFestivity(now, settings);
  }, [now, previewId, settings]);

  if (!resolved) return null;
  const content = (
    <>
      <Suspense fallback={null}>
        <FestivityEffect config={resolved.config} animate={animationEnabled} />
      </Suspense>
      <FestivityBanner
        config={resolved.config}
        onHide={
          onHide ? () => onHide(resolved.config.id, resolved.dateKey) : undefined
        }
      />
    </>
  );
  return previewMode ? <div className={styles.previewCanvas}>{content}</div> : content;
}

const hiddenKey = (id: FestivityId, dateKey: string) =>
  `timemaster:seasonal-effects:hidden:${id}:${dateKey}`;
const animatedKey = (id: FestivityId, dateKey: string) =>
  `timemaster:seasonal-effects:animated:${id}:${dateKey}`;

export interface SeasonalEffectsHostProps {
  settings: SeasonalEffectsSettings;
  previewId?: FestivityId | null;
  onClearPreview?: () => void;
}

export function SeasonalEffectsRuntime({
  settings,
  previewId = null,
  onClearPreview,
}: SeasonalEffectsHostProps) {
  const [now, setNow] = useState(() => new Date());
  const [hidden, setHidden] = useState(true);
  const [animationEnabled, setAnimationEnabled] = useState(false);
  const resolved = previewId ? null : resolveActiveFestivity(now, settings);
  const storageId = previewId ?? resolved?.config.id;
  const storageDateKey = previewId ? `preview-${previewId}` : resolved?.dateKey;

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const delay = Math.max(1, getNextCostaRicaMidnightTimestamp(now) - Date.now() + 25);
    const timer = window.setTimeout(refresh, Math.min(2_147_000_000, delay));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [now]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!storageId || !storageDateKey) {
        setAnimationEnabled(false);
        return;
      }
      const key = animatedKey(storageId, storageDateKey);
      const alreadyAnimated = window.localStorage.getItem(key) === "1";
      setAnimationEnabled(!alreadyAnimated);
      if (!alreadyAnimated) window.localStorage.setItem(key, "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageDateKey, storageId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHidden(
        Boolean(
          storageId &&
            storageDateKey &&
            window.sessionStorage.getItem(hiddenKey(storageId, storageDateKey)) === "1",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageDateKey, storageId]);

  if (hidden) return null;

  return (
    <SeasonalEffectsView
      settings={settings}
      now={now}
      previewId={previewId}
      animationEnabled={animationEnabled}
      onHide={(id, dateKey) => {
        if (previewId) {
          onClearPreview?.();
          return;
        }
        window.sessionStorage.setItem(hiddenKey(id, dateKey), "1");
        setHidden(true);
      }}
    />
  );
}

export default function SeasonalEffectsHost() {
  const { settings, previewId, setPreviewId } = useSeasonalEffects();
  return (
    <SeasonalEffectsRuntime
      settings={settings}
      previewId={previewId}
      onClearPreview={() => setPreviewId(null)}
    />
  );
}
