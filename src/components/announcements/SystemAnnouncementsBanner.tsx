"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getNextAnnouncementBoundary,
  sortVisibleAnnouncements,
  type PublishedSystemAnnouncement,
} from "@/lib/system-announcements";
import { subscribeToPublishedSystemAnnouncements } from "@/services/system-announcements";
import AnnouncementBanner from "./AnnouncementBanner";

const ROTATION_MS = 36_000;
const DISMISSAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_000_000;

const dismissalKey = (
  userId: string,
  announcement: PublishedSystemAnnouncement,
) => `timemaster:announcement-dismissal:${userId}:${announcement.id}:${announcement.version}`;

function getNextDismissalBoundary(
  announcements: PublishedSystemAnnouncement[],
  userId: string,
  now: number,
): number | null {
  if (!userId) return null;
  let next: number | null = null;
  for (const announcement of announcements) {
    if (!announcement.allowDismiss) continue;
    try {
      const expiresAt = Number(
        localStorage.getItem(dismissalKey(userId, announcement)) || 0,
      );
      if (expiresAt > now && (next === null || expiresAt < next)) next = expiresAt;
    } catch {
      return next;
    }
  }
  return next;
}

export default function SystemAnnouncementsBanner() {
  const { user, firebaseAuthReady } = useAuth();
  const userId = String(user?.id || "").trim();
  const [announcements, setAnnouncements] = useState<PublishedSystemAnnouncement[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [dismissalRevision, setDismissalRevision] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!userId || !firebaseAuthReady) return;
    return subscribeToPublishedSystemAnnouncements(
      (items) => setAnnouncements(items),
      (error) => {
        console.warn("No se pudieron cargar los anuncios del sistema", error);
        setAnnouncements([]);
      },
    );
  }, [firebaseAuthReady, userId]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const announcementBoundary = getNextAnnouncementBoundary(announcements, new Date(now));
    const dismissalBoundary = getNextDismissalBoundary(announcements, userId, now);
    const nextBoundary =
      announcementBoundary === null
        ? dismissalBoundary
        : dismissalBoundary === null
          ? announcementBoundary
          : Math.min(announcementBoundary, dismissalBoundary);
    const delay = nextBoundary === null
      ? null
      : Math.min(MAX_TIMEOUT_MS, Math.max(0, nextBoundary - Date.now() + 25));
    const timer = delay === null ? null : window.setTimeout(refresh, delay);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [announcements, dismissalRevision, now, userId]);

  const visible = useMemo(() => {
    void dismissalRevision;
    if (!userId) return [];
    return sortVisibleAnnouncements(announcements, new Date(now)).filter((item) => {
      if (!item.allowDismiss || !userId) return true;
      try {
        const expiresAt = Number(localStorage.getItem(dismissalKey(userId, item)) || 0);
        if (expiresAt > now) return false;
      } catch {
        // Storage is optional; a blocked browser still displays the announcement.
      }
      return true;
    });
  }, [announcements, dismissalRevision, now, userId]);

  const signature = visible.map((item) => `${item.id}:${item.version}`).join("|");

  useEffect(() => {
    if (visible.length < 2 || manualPaused || interactionPaused || reducedMotion) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % visible.length),
      ROTATION_MS,
    );
    return () => window.clearInterval(timer);
  }, [interactionPaused, manualPaused, reducedMotion, signature, visible.length]);

  const current = visible[index % Math.max(visible.length, 1)];
  if (!current) return null;

  const dismiss = (announcement: PublishedSystemAnnouncement) => {
    if (!announcement.allowDismiss || !userId) return;
    try {
      localStorage.setItem(
        dismissalKey(userId, announcement),
        String(Date.now() + DISMISSAL_MS),
      );
    } catch {
      return;
    }
    setDismissalRevision((revision) => revision + 1);
  };

  return (
    <div
      className="mx-0 min-w-0 flex-1 sm:mx-2"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={() => setInteractionPaused(false)}
    >
      <AnnouncementBanner
        announcement={current}
        onDismiss={dismiss}
        paused={manualPaused || reducedMotion}
        onTogglePause={
          reducedMotion ? undefined : () => setManualPaused((value) => !value)
        }
      />
    </div>
  );
}
