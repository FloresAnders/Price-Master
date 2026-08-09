"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Info, Save, X } from "lucide-react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatHHMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function parseHHMMSS(raw: string): {
  ok: boolean;
  seconds: number;
  normalized: string;
  error?: string;
} {
  const value = (raw || "").trim();
  if (!value) {
    return { ok: true, seconds: 0, normalized: "00:00:00" };
  }

  // Accept hh:mm:ss or h:mm:ss
  const m = /^\s*(\d{1,3}):(\d{1,2}):(\d{1,2})\s*$/.exec(value);
  if (!m) {
    return {
      ok: false,
      seconds: 0,
      normalized: "00:00:00",
      error: "Formato inválido. Usa hh:mm:ss (ej: 08:30:00)",
    };
  }

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if ([hh, mm, ss].some((n) => Number.isNaN(n))) {
    return {
      ok: false,
      seconds: 0,
      normalized: "00:00:00",
      error: "Formato inválido. Usa hh:mm:ss",
    };
  }
  if (mm < 0 || mm > 59 || ss < 0 || ss > 59 || hh < 0) {
    return {
      ok: false,
      seconds: 0,
      normalized: "00:00:00",
      error: "Minutos/segundos deben estar entre 0 y 59",
    };
  }

  const total = hh * 3600 + mm * 60 + ss;
  return { ok: true, seconds: total, normalized: formatHHMMSS(total) };
}

interface CalculoHorasModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  day: number;
  month: number;
  year: number;
  empresaValue: string;
  currentTimeHHMMSS?: string;
  onSave: (payload: {
    timeHHMMSS: string;
    totalSeconds: number;
  }) => Promise<void> | void;
}

export default function CalculoHorasModal({
  isOpen,
  onClose,
  employeeName,
  day,
  month,
  year,
  empresaValue,
  currentTimeHHMMSS,
  onSave,
}: CalculoHorasModalProps) {
  const [timeText, setTimeText] = useState<string>(
    currentTimeHHMMSS || "00:00:00",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerText, setTimerText] = useState<string>("00:00:00");
  const [showTimerInfo, setShowTimerInfo] = useState(false);
  const startAtRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const monthName = useMemo(
    () =>
      new Date(year, month, 1).toLocaleDateString("es-CR", { month: "long" }),
    [year, month],
  );
  const timerDisplay = useMemo(
    () => formatHHMMSS(elapsedSeconds),
    [elapsedSeconds],
  );

  useEffect(() => {
    if (!isOpen) return;

    setTimeText(currentTimeHHMMSS || "00:00:00");
    setError("");

    // Reset timer when opening
    setTimerRunning(false);
    setElapsedSeconds(0);
    setTimerText("00:00:00");
    startAtRef.current = null;
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isOpen, currentTimeHHMMSS]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const startTimer = () => {
    if (timerRunning) return;
    setError("");
    setShowTimerInfo(false);
    setTimerRunning(true);
    startAtRef.current = Date.now();
    setElapsedSeconds(0);
    setTimerText("00:00:00");

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = window.setInterval(() => {
      const startAt = startAtRef.current;
      if (!startAt) return;
      const now = Date.now();
      const secs = Math.floor((now - startAt) / 1000);
      setElapsedSeconds(secs);
    }, 250);
  };

  const stopTimer = () => {
    // Can be used in 2 modes:
    // 1) If running: stop and apply elapsedSeconds.
    // 2) If not running: apply editable timerText (if > 0).
    if (timerRunning) {
      setTimerRunning(false);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    const parsedStopped = parseHHMMSS(timerRunning ? timerDisplay : timerText);
    if (!parsedStopped.ok) {
      setError(parsedStopped.error || "Tiempo inválido");
      return;
    }
    if (parsedStopped.seconds <= 0) {
      // Nothing to apply
      return;
    }

    // Freeze & add to manual input
    const parsedBase = parseHHMMSS(timeText);
    if (!parsedBase.ok) {
      setError(parsedBase.error || "Tiempo inválido");
      return;
    }

    const combinedSeconds = parsedBase.seconds + parsedStopped.seconds;
    const hhmmss = formatHHMMSS(combinedSeconds);
    setTimeText(hhmmss);

    // Reset editable timer display after applying
    setElapsedSeconds(0);
    setTimerText("00:00:00");
    setShowTimerInfo(false);
  };

  const handleSave = async () => {
    const parsed = parseHHMMSS(timeText);
    if (!parsed.ok) {
      setError(parsed.error || "Tiempo inválido");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await onSave({
        timeHHMMSS: parsed.normalized,
        totalSeconds: parsed.seconds,
      });
      onClose();
    } catch (e) {
      console.error("Error saving calculohoras:", e);
      setError("Error al guardar el registro");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const parsedNow = parseHHMMSS(timeText);
  const isDelete = parsedNow.ok && parsedNow.seconds <= 0;
  const parsedTimer = parseHHMMSS(timerRunning ? timerDisplay : timerText);
  const canFinishTimer =
    !saving && (timerRunning || (parsedTimer.ok && parsedTimer.seconds > 0));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] rounded-xl shadow-xl max-w-md w-full border-2 border-[var(--input-border)]">
        <div className="flex items-center justify-between p-6 border-b border-[var(--input-border)]">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-cyan-500" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Cálculo horas
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                {employeeName} - {day} de {monthName} {year}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Empresa: {empresaValue}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--muted)] transition-all"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Tiempo (hh:mm:ss)
            </label>
            <input
              type="text"
              value={timeText}
              onChange={(e) => setTimeText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-[var(--input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[var(--card-bg)] text-[var(--foreground)] text-lg font-semibold text-center transition-all"
              placeholder="00:00:00"
              autoFocus
            />
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Ejemplo: 08:30:00
            </p>
            <p className="text-xs text-cyan-500 mt-1 font-semibold">
              00:00:00 eliminará este registro
            </p>
          </div>

          <div className="mb-4 p-4 rounded-lg border-2 border-[var(--input-border)] bg-[var(--muted)]">
            <div className="flex items-center justify-between mb-2">
              <div className="relative flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  Cronómetro
                </span>
                <button
                  type="button"
                  className="p-1.5 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--muted)] transition-all"
                  title="Info: cronómetro editable"
                  aria-label="Info del cronómetro"
                  onClick={() => setShowTimerInfo((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowTimerInfo(false);
                  }}
                  disabled={saving}
                >
                  <Info className="w-4 h-4" />
                </button>

                {showTimerInfo && (
                  <div className="absolute left-0 top-8 z-20 w-72 max-w-[80vw] p-3 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-lg">
                    <p className="text-xs text-[var(--foreground)]">
                      Ahora puedes escribir un tiempo (hh:mm:ss) en el
                      cronómetro. Si el valor es distinto de 00:00:00, se
                      habilita el botón Fin para sumar ese tiempo al campo
                      manual.
                    </p>
                  </div>
                )}
              </div>
              <input
                type="text"
                className="text-sm font-semibold text-[var(--foreground)] tabular-nums px-3 py-1.5 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-right w-28 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                value={timerRunning ? timerDisplay : timerText}
                readOnly={timerRunning}
                disabled={saving}
                onChange={(e) => {
                  setError("");
                  setShowTimerInfo(false);
                  setTimerText(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    stopTimer();
                  } else if (e.key === "Escape") {
                    onClose();
                  }
                }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={startTimer}
                disabled={saving || timerRunning}
                className="flex-1 px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--card-bg)] text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
              >
                Inicio
              </button>
              <button
                onClick={stopTimer}
                disabled={!canFinishTimer}
                className="flex-1 px-4 py-2 text-white rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-lg transition-all border border-cyan-600 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Fin
              </button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              Al dar &apos;Fin&apos;, el tiempo se suma al campo manual.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border-2 border-red-500/40 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-[var(--input-border)]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--card-bg)] text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--muted)] transition-all font-semibold"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={
              "flex-1 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-semibold " +
              (isDelete
                ? "border-2 border-red-500/40 text-white bg-red-600 hover:bg-red-700"
                : "text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-lg border border-cyan-600 hover:border-cyan-400")
            }
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isDelete ? "Eliminar" : "Guardar"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
