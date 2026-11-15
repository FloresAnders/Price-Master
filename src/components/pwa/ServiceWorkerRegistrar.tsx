"use client";

import { useEffect } from "react";

export async function registerServiceWorker(
  container: ServiceWorkerContainer,
): Promise<ServiceWorkerRegistration | null> {
  try {
    return await container.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    void registerServiceWorker(navigator.serviceWorker);
  }, []);

  return null;
}
