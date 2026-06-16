"use client";

import React from "react";
import { Maximize2, X } from "lucide-react";
import { db } from "@/config/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import versionData from "@/data/version.json";

type SystemNote = {
  date: string;
  title: string;
  description: string;
  url?: string;
};

const STORAGE_KEY = "system_notes_version";

const getValidVideoUrl = (value: unknown) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
};

const buildSystemNotesSeenKey = (version: string, videoUrl: string) =>
  videoUrl ? `${version}|${videoUrl}` : version;

const buildMissingNote = (version: string): SystemNote => ({
  date: new Date().toISOString().slice(0, 10),
  title: "Actualización de Notas del Sistema",
  description: `Se detectó una actualización de notas (v${version}). No se encontró detalle para esta versión en systemNotes.`,
});

const initialSystemNotesVersion = String(versionData.notasDeSistemas || "").trim();
const initialSystemNote =
  (versionData.systemNotes as SystemNote[] | undefined)?.[0] ??
  buildMissingNote(initialSystemNotesVersion);
const initialSystemNotesVideoUrl = getValidVideoUrl(initialSystemNote.url);

export default function SystemNotesInitializer() {
  const [note, setNote] = React.useState<SystemNote | null>(null);
  const [activeVersion, setActiveVersion] = React.useState<string>("");
  const [videoUrl, setVideoUrl] = React.useState<string>("");
  const [isOpen, setIsOpen] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const unsubscribeRef = React.useRef<(() => void) | null>(null);
  const lastNotifiedVersionRef = React.useRef<string | null>(null);
  const latestNoteRef = React.useRef<SystemNote | null>(initialSystemNote);
  const latestVersionRef = React.useRef<string>(initialSystemNotesVersion);
  const latestVideoUrlRef = React.useRef<string>(initialSystemNotesVideoUrl);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if (!audioRef.current) {
      const audio = new Audio("/arrival-sound.mp3");
      audio.preload = "auto";
      audioRef.current = audio;
    }
  }, []);

  const playArrivalSound = React.useCallback(() => {
    const basePlayer =
      audioRef.current ??
      (typeof Audio !== "undefined" ? new Audio("/arrival-sound.mp3") : null);

    if (!basePlayer) return;

    audioRef.current = basePlayer;
    const player = basePlayer.cloneNode(true) as HTMLAudioElement;

    try {
      player.currentTime = 0;
      const playPromise = player.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => {
          console.warn("Unable to play system notes sound:", error);
        });
      }
    } catch (error) {
      console.warn("Unable to play system notes sound:", error);
    }
  }, []);

  const persistSeenVersion = React.useCallback((version: string) => {
    if (!version) return;
    lastNotifiedVersionRef.current = version;
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch (error) {
      console.warn("Error guardando versión en localStorage:", error);
    }
  }, []);

  const showSystemNote = React.useCallback(
    (
      nextNote: SystemNote,
      nextVersion: string,
      nextVideoUrl: string,
      shouldPlaySound = true,
    ) => {
      setNote(nextNote);
      setActiveVersion(nextVersion);
      setVideoUrl(nextVideoUrl);
      setIsOpen(true);
      if (shouldPlaySound) {
        playArrivalSound();
      }
    },
    [playArrivalSound],
  );

  const setLatestNote = React.useCallback(
    (nextNote: SystemNote, nextVersion: string, nextVideoUrl: string) => {
      latestNoteRef.current = nextNote;
      latestVersionRef.current = nextVersion;
      latestVideoUrlRef.current = nextVideoUrl;
    },
    [],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedVersion = localStorage.getItem(STORAGE_KEY);
      if (storedVersion) {
        lastNotifiedVersionRef.current = storedVersion;
      }
    } catch (error) {
      console.warn("Error cargando versión almacenada:", error);
    }
  }, []);

  React.useEffect(() => {
    const versionRef = doc(db, "version", "current");

    unsubscribeRef.current = onSnapshot(
      versionRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          console.warn("No se encontró el documento de versión en Firestore");
          return;
        }

        const firestoreData = docSnap.data();
        const notasDeSistemasDb = String(
          firestoreData?.notasDeSistemas || "",
        ).trim();
        const systemNotesDb = Array.isArray(firestoreData?.systemNotes)
          ? firestoreData.systemNotes
          : [];
        const currentNote =
          (systemNotesDb as SystemNote[])[0] ?? buildMissingNote(notasDeSistemasDb);
        const systemNotesVideoUrl = getValidVideoUrl(currentNote.url);

        setLatestNote(currentNote, notasDeSistemasDb, systemNotesVideoUrl);

        console.log(
          "Sistema de Notas - Versión en Firestore:",
          notasDeSistemasDb,
        );
        console.log(
          "Sistema de Notas - Última versión notificada:",
          lastNotifiedVersionRef.current,
        );

        const previousVersion = lastNotifiedVersionRef.current;
        const seenKey = buildSystemNotesSeenKey(
          notasDeSistemasDb,
          systemNotesVideoUrl,
        );

        if (notasDeSistemasDb && seenKey !== previousVersion) {
          console.log(
            "Mostrando nota del sistema para versión:",
            notasDeSistemasDb,
          );
          showSystemNote(currentNote, notasDeSistemasDb, systemNotesVideoUrl);
          persistSeenVersion(seenKey);
        } else if (notasDeSistemasDb) {
          const persistedVersion = localStorage.getItem(STORAGE_KEY);
          if (persistedVersion !== seenKey) {
            persistSeenVersion(seenKey);
          }
        }
      },
      (error) => {
        console.warn("Error escuchando cambios de notas del sistema:", error);
      },
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [persistSeenVersion, setLatestNote, showSystemNote]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedVersion = localStorage.getItem(STORAGE_KEY);
      const currentVersion = versionData.notasDeSistemas;
      const systemNotes = versionData.systemNotes as SystemNote[];
      const currentNote = systemNotes[0] ?? buildMissingNote(currentVersion);
      const systemNotesVideoUrl = getValidVideoUrl(currentNote.url);
      const seenKey = buildSystemNotesSeenKey(
        currentVersion,
        systemNotesVideoUrl,
      );

      console.log("Sistema de Notas - Versión local:", currentVersion);
      console.log("Sistema de Notas - Versión almacenada:", storedVersion);

      if (!latestNoteRef.current) {
        setLatestNote(currentNote, currentVersion, systemNotesVideoUrl);
      }

      if (storedVersion !== seenKey && !isOpen && !lastNotifiedVersionRef.current) {
        showSystemNote(currentNote, currentVersion, systemNotesVideoUrl);
        persistSeenVersion(seenKey);
      }
    } catch (error) {
      console.warn("Error cargando notas del sistema:", error);
    }
  }, [isOpen, persistSeenVersion, setLatestNote, showSystemNote]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOpenSystemNotes = () => {
      const nextNote = initialSystemNote;
      const nextVersion = initialSystemNotesVersion;
      if (!nextNote || !nextVersion) return;
      showSystemNote(nextNote, nextVersion, initialSystemNotesVideoUrl, false);
    };

    window.addEventListener("open-system-notes-modal", handleOpenSystemNotes);

    return () => {
      window.removeEventListener("open-system-notes-modal", handleOpenSystemNotes);
    };
  }, [showSystemNote]);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setNote(null);
    setActiveVersion("");
    setVideoUrl("");
  }, []);

  const handleFullscreen = React.useCallback(() => {
    videoRef.current?.requestFullscreen?.().catch((error) => {
      console.warn("Unable to open system notes video fullscreen:", error);
    });
  }, []);

  if (!isOpen || !note) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60">
      <div className="relative w-full h-full max-w-2xl max-h-[90vh] bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-2xl p-6 md:p-10 overflow-auto">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 inline-flex items-center justify-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)] w-10 h-10 text-[var(--foreground)] hover:opacity-90 transition-opacity"
          aria-label="Cerrar"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-4">
          <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
            Notas del Sistema — v{activeVersion}
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] leading-tight">
            {note.title}
          </h2>

          <div className="text-sm text-[var(--muted-foreground)]">
            {new Date(note.date).toLocaleDateString("es-CR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>

          <div className="pt-6 text-base md:text-lg text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
            {note.description}
          </div>

          {videoUrl ? (
            <div className="pt-4 space-y-3">
              <video
                ref={videoRef}
                className="w-full rounded-xl border border-[var(--input-border)] bg-black"
                src={videoUrl}
                controls
                autoPlay
                loop
                playsInline
                preload="metadata"
              >
                Tu navegador no soporta video HTML5.
              </video>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:opacity-90 transition-opacity"
                >
                  <Maximize2 className="w-4 h-4" />
                  Pantalla completa
                </button>
              </div>
            </div>
          ) : null}

          <div className="pt-8 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
