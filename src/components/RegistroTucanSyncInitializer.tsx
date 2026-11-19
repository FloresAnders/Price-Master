"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { RegistroTucanService } from "@/services/registro-tucan";

export const REGISTRO_TUCAN_PENDING_EVENT =
  "price-master:registro-tucan-pending";

export default function RegistroTucanSyncInitializer() {
  const { firebaseAuthReady, loading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refreshCount = async () => {
      const count = await RegistroTucanService.getPendingCount();
      if (!cancelled) setPendingCount(count);
    };

    void refreshCount();

    const handlePending = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        setPendingCount(detail.count);
      }
    };

    window.addEventListener(REGISTRO_TUCAN_PENDING_EVENT, handlePending);
    return () => {
      cancelled = true;
      window.removeEventListener(REGISTRO_TUCAN_PENDING_EVENT, handlePending);
    };
  }, []);

  useEffect(() => {
    if (loading || !firebaseAuthReady || !isOnline) return;

    let cancelled = false;
    const sync = async () => {
      await RegistroTucanService.syncPending();
      if (cancelled) return;
      const count = await RegistroTucanService.getPendingCount();
      setPendingCount(count);
    };

    void sync();

    const handleOnline = () => void sync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [firebaseAuthReady, isOnline, loading]);

  if (pendingCount <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-3 left-1/2 z-[80] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-950/95 px-4 py-2 text-sm font-medium text-amber-100 shadow-lg"
    >
      {isOnline
        ? `Sincronizando ${pendingCount} registro${pendingCount === 1 ? "" : "s"} Tucán pendiente${pendingCount === 1 ? "" : "s"}...`
        : `${pendingCount} registro${pendingCount === 1 ? "" : "s"} Tucán pendiente${pendingCount === 1 ? "" : "s"} de sincronización.`}
    </div>
  );
}
