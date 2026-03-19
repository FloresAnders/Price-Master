'use client';

import { useEffect, useRef, useState } from 'react';

type VerifyResponse = { ok?: boolean; error?: string };

type UsePruebasUnlockOptions = {
  storageKey?: string;
  ttlMs?: number;
};

const DEFAULT_STORAGE_KEY = 'pricemaster_pruebas_unlocked';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function parseUnlockedAt(raw: string | null): number {
  if (!raw) return 0;

  // Back-compat: previous versions stored '1'
  if (raw === '1') {
    return Date.now();
  }

  try {
    const parsed = JSON.parse(raw) as { unlockedAt?: number };
    return Number(parsed?.unlockedAt || 0);
  } catch {
    return 0;
  }
}

export function usePruebasUnlock(options: UsePruebasUnlockOptions = {}) {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
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
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    clearExpiryTimer();
  };

  const scheduleExpiry = (unlockedAt: number) => {
    clearExpiryTimer();
    const remaining = ttlMs - (Date.now() - unlockedAt);
    if (remaining <= 0) {
      lockNow();
      return;
    }

    expiryTimerRef.current = window.setTimeout(() => {
      lockNow();
    }, remaining);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = sessionStorage.getItem(storageKey);
      const unlockedAt = parseUnlockedAt(raw);

      const ok = unlockedAt > 0 && Date.now() - unlockedAt < ttlMs;

      if (ok) {
        // If back-compat '1', migrate to json
        if (raw === '1') {
          sessionStorage.setItem(storageKey, JSON.stringify({ unlockedAt }));
        }
        setUnlocked(true);
        scheduleExpiry(unlockedAt);
      } else {
        try {
          sessionStorage.removeItem(storageKey);
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
  }, [storageKey, ttlMs]);

  const unlock = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'pruebas', password })
      });

      const data = (await response.json()) as VerifyResponse;
      if (!response.ok || !data?.ok) {
        setError(data?.error || 'Contraseña incorrecta');
        return;
      }

      const unlockedAt = Date.now();
      setUnlocked(true);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ unlockedAt }));
      } catch {
        // ignore
      }

      scheduleExpiry(unlockedAt);
    } catch {
      setError('Error al validar la contraseña');
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
