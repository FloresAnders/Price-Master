"use client";

import { useEffect } from "react";

type ShortcutMap = Record<string, () => void>;

export function useShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        shortcuts["/"]?.();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && key === "k") {
        e.preventDefault();
        shortcuts["cmd+k"]?.();
        return;
      }

      if (!e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        shortcuts[key]?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
