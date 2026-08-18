"use client";

import { useState, useEffect } from "react";
import versionData from "../data/version.json";
import { subscribeToVersionDoc } from "@/services/version-doc";

export type ReleaseNote = {
  date: string;
  title: string;
  description: string;
};

// Función para comparar versiones semánticas
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

export function useVersion() {
  const [version, setVersion] = useState<string>(versionData.version);
  const [loading, setLoading] = useState(true);
  const [isLocalNewer, setIsLocalNewer] = useState(false);
  const [dbVersion, setDbVersion] = useState<string | null>(null);

  const releaseNotes =
    (versionData as unknown as { releaseNotes?: ReleaseNote[] }).releaseNotes ??
    [];

  useEffect(() => {
    const unsubscribe = subscribeToVersionDoc((snapshot) => {
      if (!snapshot?.exists) {
        setVersion(versionData.version);
        setDbVersion(null);
        setIsLocalNewer(false);
        setLoading(false);
        return;
      }

      const serverVersion = snapshot.version || versionData.version;
      setDbVersion(serverVersion);

      const comparison = compareVersions(versionData.version, serverVersion);

      if (comparison > 0) {
        setVersion(versionData.version);
        setIsLocalNewer(true);
      } else {
        setVersion(serverVersion || versionData.version);
        setIsLocalNewer(false);
      }

      setLoading(false);
    }, (error) => {
      console.error("Error obteniendo versión:", error);
      setVersion(versionData.version);
      setDbVersion(null);
      setIsLocalNewer(false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { version, loading, isLocalNewer, dbVersion, releaseNotes };
}
