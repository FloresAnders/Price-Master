"use client";

import { useEffect } from "react";
import { initializeNativeNotifications } from "@/lib/nativeNotifications";

export default function NativeNotificationsInitializer() {
  useEffect(() => {
    void initializeNativeNotifications().catch((error) => {
      console.error("Native notification setup failed:", error);
    });
  }, []);

  return null;
}
