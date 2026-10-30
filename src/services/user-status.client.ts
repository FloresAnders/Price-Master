"use client";

import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/config/firebase";

export type UserStatusSnapshot = {
  exists: boolean;
  isActive: boolean;
  revision: number;
  sourceUpdateTime?: string | null;
};

const normalizeRevision = (value: unknown): number => {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.floor(revision) : 0;
};

export function subscribeToUserStatus(
  userId: string,
  onStatus: (status: UserStatusSnapshot) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const unsubscribe = onSnapshot(
    doc(db, "userStatus", userId),
    (snapshot) => {
      const exists = snapshot.exists();
      const data = exists ? snapshot.data() : undefined;
      onStatus({
        exists,
        isActive: exists ? data?.isActive !== false : true,
        revision: normalizeRevision(data?.revision),
        sourceUpdateTime:
          exists && typeof data?.sourceUpdateTime === "string"
            ? data.sourceUpdateTime
            : null,
      });
    },
    (error) => onError?.(error),
  );
  let active = true;

  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
  };
}
