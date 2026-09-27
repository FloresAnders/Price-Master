"use client";

import { useEffect, useState } from "react";

export type FondoGeneralTabLockStatus =
  | "idle"
  | "checking"
  | "owner"
  | "duplicate";

const LOCK_NAME = "timemaster:fondo-general-active-tab";
const FALLBACK_LEASE_KEY = `${LOCK_NAME}:lease`;
const FALLBACK_LEASE_TTL_MS = 8_000;
const FALLBACK_HEARTBEAT_MS = 2_000;

type FallbackLease = {
  ownerId: string;
  expiresAt: number;
};

export function useFondoGeneralTabLock(
  enabled: boolean,
): FondoGeneralTabLockStatus {
  const [status, setStatus] = useState<FondoGeneralTabLockStatus>("idle");

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    let disposed = false;
    let releaseHeldLock: (() => void) | null = null;
    let fallbackCleanup: (() => void) | null = null;

    const startFallbackLease = () => {
      if (disposed || fallbackCleanup) return;

      const ownerId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let ownsLease = false;

      const readLease = (): FallbackLease | null => {
        try {
          const raw = window.localStorage.getItem(FALLBACK_LEASE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw) as Partial<FallbackLease>;
          if (
            typeof parsed.ownerId !== "string" ||
            typeof parsed.expiresAt !== "number"
          ) {
            return null;
          }
          return parsed as FallbackLease;
        } catch {
          return null;
        }
      };

      const writeLease = (expiresAt: number) => {
        window.localStorage.setItem(
          FALLBACK_LEASE_KEY,
          JSON.stringify({ ownerId, expiresAt } satisfies FallbackLease),
        );
      };

      const evaluateLease = () => {
        if (disposed) return;

        try {
          const now = Date.now();
          const current = readLease();
          if (
            !current ||
            current.expiresAt <= now ||
            current.ownerId === ownerId
          ) {
            writeLease(now + FALLBACK_LEASE_TTL_MS);
            ownsLease = readLease()?.ownerId === ownerId;
          } else {
            ownsLease = false;
          }
          setStatus(ownsLease ? "owner" : "duplicate");
        } catch {
          // If storage is unavailable, do not leave the account unusable.
          ownsLease = false;
          setStatus("owner");
        }
      };

      const heartbeat = window.setInterval(() => {
        if (disposed) return;
        if (ownsLease) {
          try {
            writeLease(Date.now() + FALLBACK_LEASE_TTL_MS);
          } catch {
            setStatus("owner");
          }
          return;
        }
        evaluateLease();
      }, FALLBACK_HEARTBEAT_MS);

      const handleStorage = (event: StorageEvent) => {
        if (event.key === FALLBACK_LEASE_KEY) evaluateLease();
      };

      const releaseLease = () => {
        try {
          if (readLease()?.ownerId === ownerId) {
            window.localStorage.removeItem(FALLBACK_LEASE_KEY);
          }
        } catch {
          // Nothing to release when storage is unavailable.
        }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener("pagehide", releaseLease);
      const initialEvaluation = window.setTimeout(evaluateLease, 0);

      fallbackCleanup = () => {
        window.clearTimeout(initialEvaluation);
        window.clearInterval(heartbeat);
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("pagehide", releaseLease);
        releaseLease();
      };
    };

    const lockManager = window.navigator.locks;
    if (!lockManager?.request) {
      startFallbackLease();
      return () => {
        disposed = true;
        fallbackCleanup?.();
        setStatus("idle");
      };
    }

    const abortController = new AbortController();

    const holdLock = () =>
      new Promise<void>((resolve) => {
        releaseHeldLock = resolve;
        if (disposed) resolve();
      });

    void lockManager
      .request(
        LOCK_NAME,
        {
          mode: "exclusive",
          ifAvailable: true,
          signal: abortController.signal,
        },
        async (lock) => {
          if (!lock) return false;
          if (!disposed) setStatus("owner");
          await holdLock();
          return true;
        },
      )
      .then((acquired) => {
        if (acquired || disposed) return undefined;

        setStatus("duplicate");
        return lockManager.request(
          LOCK_NAME,
          { mode: "exclusive", signal: abortController.signal },
          async () => {
            if (!disposed) setStatus("owner");
            await holdLock();
          },
        );
      })
      .catch((error: unknown) => {
        if (disposed || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        startFallbackLease();
      });

    return () => {
      disposed = true;
      abortController.abort();
      releaseHeldLock?.();
      fallbackCleanup?.();
      setStatus("idle");
    };
  }, [enabled]);

  return enabled ? status : "idle";
}
