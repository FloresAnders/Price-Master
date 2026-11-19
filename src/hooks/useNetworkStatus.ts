"use client";

import { useEffect, useState } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    let removeCapacitorListener: (() => void) | undefined;

    const handleBrowserOnline = () => setIsOnline(true);
    const handleBrowserOffline = () => setIsOnline(false);

    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("offline", handleBrowserOffline);
    setIsOnline(navigator.onLine);

    void import("@capacitor/network")
      .then(async ({ Network }) => {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        const listener = await Network.addListener("networkStatusChange", (next) => {
          setIsOnline(next.connected);
        });
        removeCapacitorListener = () => {
          void listener.remove();
        };
      })
      .catch(() => {
        // Browser events remain the fallback.
      });

    return () => {
      window.removeEventListener("online", handleBrowserOnline);
      window.removeEventListener("offline", handleBrowserOffline);
      removeCapacitorListener?.();
    };
  }, []);

  return { isOnline };
}
