"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Megaphone, Pause, Play, TriangleAlert, Wrench, X } from "lucide-react";
import type {
  AnnouncementType,
  PublishedSystemAnnouncement,
} from "@/lib/system-announcements";

interface AnnouncementBannerProps {
  announcement: PublishedSystemAnnouncement;
  onDismiss?: (announcement: PublishedSystemAnnouncement) => void;
  paused?: boolean;
  onTogglePause?: () => void;
  preview?: boolean;
}

const ICONS: Record<AnnouncementType, typeof Info> = {
  info: Info,
  maintenance: Wrench,
  warning: TriangleAlert,
  new_feature: Megaphone,
};

const STYLES: Record<AnnouncementType, string> = {
  info:
    "border-sky-400/60 border-l-4 bg-sky-500/15 text-sky-900 shadow-[0_0_18px_rgba(14,165,233,0.14)] dark:text-sky-50",
  maintenance:
    "border-amber-400/60 border-l-4 bg-amber-500/15 text-amber-950 shadow-[0_0_18px_rgba(245,158,11,0.14)] dark:text-amber-50",
  warning:
    "border-red-400/60 border-l-4 bg-red-500/15 text-red-950 shadow-[0_0_18px_rgba(239,68,68,0.14)] dark:text-red-50",
  new_feature:
    "border-emerald-400/60 border-l-4 bg-emerald-500/15 text-emerald-950 shadow-[0_0_18px_rgba(16,185,129,0.14)] dark:text-emerald-50",
};

const ICON_STYLES: Record<AnnouncementType, string> = {
  info: "bg-sky-400/25 ring-sky-400/50",
  maintenance: "bg-amber-400/25 ring-amber-400/50",
  warning: "bg-red-400/25 ring-red-400/50",
  new_feature: "bg-emerald-400/25 ring-emerald-400/50",
};

const DOT_STYLES: Record<AnnouncementType, string> = {
  info: "bg-sky-400",
  maintenance: "bg-amber-400",
  warning: "bg-red-400",
  new_feature: "bg-emerald-400",
};

export default function AnnouncementBanner({
  announcement,
  onDismiss,
  paused = false,
  onTogglePause,
  preview = false,
}: AnnouncementBannerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLParagraphElement | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsTitleId = useId();
  const Icon = ICONS[announcement.type];
  const message = `${announcement.title} · ${announcement.detail}`;
  const durationSeconds = Math.min(32, Math.max(18, Math.ceil(message.length / 7)));

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || typeof ResizeObserver === "undefined") return;
    const update = () => {
      track.style.setProperty("--announcement-start", `${viewport.clientWidth}px`);
      track.style.setProperty("--announcement-end", `${-track.scrollWidth}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, [message]);

  useEffect(() => {
    if (!detailsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [detailsOpen]);

  return (
    <section
      className={`announcement-banner flex min-w-0 items-center overflow-hidden rounded-xl border ring-1 ring-inset ring-white/10 ${STYLES[announcement.type]} ${preview ? "w-full" : "h-10 w-full"}`}
      role="status"
      aria-live="polite"
      aria-label={`Anuncio: ${message}`}
      title={message}
    >
      <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
        <div
          className={`${preview ? "flex" : "hidden sm:flex"} relative ml-2.5 h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${ICON_STYLES[announcement.type]}`}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
          <span
            className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--background)] motion-safe:animate-pulse ${DOT_STYLES[announcement.type]}`}
          />
        </div>
        <div ref={viewportRef} className={`announcement-ticker-viewport ml-2 min-w-0 flex-1 overflow-hidden whitespace-nowrap ${preview ? "" : "hidden sm:block"}`}>
          <p
            ref={trackRef}
            className="announcement-ticker-track inline-block max-w-none py-2 text-sm"
            style={{
              animationDuration: `${durationSeconds}s`,
              animationPlayState: paused ? "paused" : undefined,
            }}
          >
            <strong className="font-extrabold tracking-[0.015em]">
              {announcement.title}
            </strong>
            <span
              className={`mx-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${DOT_STYLES[announcement.type]}`}
              aria-hidden="true"
            />
            <span className="font-medium opacity-90">{announcement.detail}</span>
          </p>
        </div>
      </div>
      {!preview ? (
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="mr-1 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-black/5 px-2 py-1.5 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:bg-white/5 sm:hidden"
          aria-label="Ver detalle del anuncio"
          aria-expanded={detailsOpen}
        >
          <span className={`h-2 w-2 rounded-full motion-safe:animate-pulse ${DOT_STYLES[announcement.type]}`} />
          <Info className="h-4 w-4" />
        </button>
      ) : null}
      {onTogglePause ? (
        <button
          type="button"
          onClick={onTogglePause}
          className={`${preview ? "inline-flex" : "hidden sm:inline-flex"} shrink-0 rounded-md bg-black/5 p-2 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:bg-white/5`}
          aria-label={paused ? "Reanudar movimiento del anuncio" : "Pausar movimiento del anuncio"}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      ) : null}
      {announcement.allowDismiss && onDismiss ? (
        <button
          type="button"
          onClick={() => onDismiss(announcement)}
          className={`${preview ? "inline-flex" : "hidden sm:inline-flex"} mr-1 shrink-0 rounded-md bg-black/5 p-2 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:bg-white/5`}
          aria-label="Cerrar anuncio"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {detailsOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-end bg-black/45 p-3 sm:items-center sm:justify-center">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={detailsTitleId}
                className={`w-full rounded-xl border p-4 shadow-xl sm:max-w-md ${STYLES[announcement.type]}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h2 id={detailsTitleId} className="font-semibold">
                      {announcement.title}
                    </h2>
                    <p className="mt-2 whitespace-normal text-sm">{announcement.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    className="shrink-0 rounded-md p-2 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                    aria-label="Cerrar detalle"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  {onTogglePause ? (
                    <button
                      type="button"
                      onClick={onTogglePause}
                      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-black/10"
                    >
                      {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      {paused ? "Reanudar" : "Pausar"}
                    </button>
                  ) : null}
                  {announcement.allowDismiss && onDismiss ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDismiss(announcement);
                        setDetailsOpen(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-black/10"
                    >
                      <X className="h-4 w-4" /> Cerrar anuncio
                    </button>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
