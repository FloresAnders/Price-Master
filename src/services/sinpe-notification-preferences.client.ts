"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";

const COLLECTION_NAME = "sinpeNotificationPreferences";

export function subscribeToSinpeNotificationPreference(
  userId: string,
  onPreference: (enabled: boolean) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, COLLECTION_NAME, userId),
    (snapshot) => onPreference(snapshot.data()?.enabled !== false),
    (error) => onError?.(error),
  );
}
