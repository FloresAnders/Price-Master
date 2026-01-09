'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Save, X } from 'lucide-react';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatHHMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function parseHHMMSS(raw: string): { ok: boolean; seconds: number; normalized: string; error?: string } {
  const value = (raw || '').trim();
  if (!value) {
    return { ok: true, seconds: 0, normalized: '00:00:00' };
  }

  // Accept hh:mm:ss or h:mm:ss
  const m = /^\s*(\d{1,3}):(\d{1,2}):(\d{1,2})\s*$/.exec(value);
  if (!m) {
    return { ok: false, seconds: 0, normalized: '00:00:00', error: 'Formato inválido. Usa hh:mm:ss (ej: 08:30:00)' };
  }

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if ([hh, mm, ss].some((n) => Number.isNaN(n))) {
    return { ok: false, seconds: 0, normalized: '00:00:00', error: 'Formato inválido. Usa hh:mm:ss' };
  }
  if (mm < 0 || mm > 59 || ss < 0 || ss > 59 || hh < 0) {
    return { ok: false, seconds: 0, normalized: '00:00:00', error: 'Minutos/segundos deben estar entre 0 y 59' };
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
  onSave: (payload: { timeHHMMSS: string; totalSeconds: number }) => Promise<void> | void;
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
  onSave
}: CalculoHorasModalProps) {
  const [timeText, setTimeText] = useState<string>(currentTimeHHMMSS || '00:00:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startAtRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const monthName = useMemo(() => new Date(year, month, 1).toLocaleDateString('es-CR', { month: 'long' }), [year, month]);
  const timerDisplay = useMemo(() => formatHHMMSS(elapsedSeconds), [elapsedSeconds]);

  useEffect(() => {
    if (!isOpen) return;

    setTimeText(currentTimeHHMMSS || '00:00:00');
    setError('');

    // Reset timer when opening
    setTimerRunning(false);
    setElapsedSeconds(0);
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
    setError('');
    setTimerRunning(true);
    startAtRef.current = Date.now();
    setElapsedSeconds(0);

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
    if (!timerRunning) return;
    setTimerRunning(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Freeze & add to manual input
    const stopped = elapsedSeconds;
    const parsedBase = parseHHMMSS(timeText);
    if (!parsedBase.ok) {
      setError(parsedBase.error || 'Tiempo inválido');
      return;
    }

    const combinedSeconds = parsedBase.seconds + stopped;
    const hhmmss = formatHHMMSS(combinedSeconds);
    setTimeText(hhmmss);
  };

  const handleSave = async () => {
    const parsed = parseHHMMSS(timeText);
    if (!parsed.ok) {
      setError(parsed.error || 'Tiempo inválido');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSave({ timeHHMMSS: parsed.normalized, totalSeconds: parsed.seconds });
      onClose();
    } catch (e) {
      console.error('Error saving calculohoras:', e);
      setError('Error al guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const parsedNow = parseHHMMSS(timeText);
  const isDelete = parsedNow.ok && parsedNow.seconds <= 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cálculo horas</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {employeeName} - {day} de {monthName} {year}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Empresa: {empresaValue}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tiempo (hh:mm:ss)</label>
            <input
              type="text"
              value={timeText}
              onChange={(e) => setTimeText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg font-semibold text-center"
              placeholder="00:00:00"
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ejemplo: 08:30:00</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">💡 00:00:00 eliminará este registro</p>
          </div>

          <div className="mb-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Cronómetro</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{timerDisplay}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={startTimer}
                disabled={saving || timerRunning}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Inicio
              </button>
              <button
                onClick={stopTimer}
                disabled={saving || !timerRunning}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Fin
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Al dar 'Fin', el tiempo se copia al campo manual.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-600 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
              isDelete ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isDelete ? 'Eliminar' : 'Guardar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
