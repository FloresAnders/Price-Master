"use client";

import { useEffect, useRef, useState } from "react";
import { verifyPassword } from "@/lib/auth/password";

const STORAGE_KEY = "pricemaster_schedule_past_days_unlocked";
export const PHASH_KEY = "pricemaster_user_phash";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function parseUnlockedAt(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { unlockedAt?: number };
    return Number(parsed?.unlockedAt || 0);
  } catch {
    return 0;
  }
}

export function useUnlockPastDays() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expiryTimerRef = useRef<number | null>(null);

  const clearExpiryTimer = () => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  };

  const lockNow = () => {
    setUnlocked(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    clearExpiryTimer();
  };

  const scheduleExpiry = (unlockedAt: number) => {
    clearExpiryTimer();
    const remaining = TTL_MS - (Date.now() - unlockedAt);
    if (remaining <= 0) {
      lockNow();
      return;
    }
    expiryTimerRef.current = window.setTimeout(() => {
      lockNow();
    }, remaining);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const unlockedAt = parseUnlockedAt(raw);
      const ok = unlockedAt > 0 && Date.now() - unlockedAt < TTL_MS;

      if (ok) {
        setUnlocked(true);
        scheduleExpiry(unlockedAt);
      } else {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        setUnlocked(false);
      }
    } catch {
      setUnlocked(false);
    }

    return () => {
      clearExpiryTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      let storedHash: string | null = null;
      try {
        storedHash = localStorage.getItem(PHASH_KEY);
      } catch {
        // ignore
      }

      if (!storedHash) {
        setError(
          "No se encontró contraseña almacenada. Esta función requiere que haya iniciado sesión recientemente con su contraseña. Cierre sesión e inicie nuevamente.",
        );
        return;
      }

      const ok = await verifyPassword(password, storedHash);

      if (!ok) {
        setError("Contraseña incorrecta");
        return;
      }

      const unlockedAt = Date.now();
      setUnlocked(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ unlockedAt }));
      } catch {
        // ignore
      }
      scheduleExpiry(unlockedAt);
    } catch {
      setError("Error al validar la contraseña");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    unlocked,
    password,
    setPassword,
    submitting,
    error,
    unlock,
    lockNow,
  };
}
