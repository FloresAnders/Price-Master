import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

export type VersionDocSnapshot = {
  id: string;
  exists: boolean;
  data: Record<string, unknown>;
  version: string;
  versionstorage: string;
  notasDeSistemas: string;
  systemNotes: unknown[];
};

type VersionListener = (snapshot: VersionDocSnapshot | null) => void;
type VersionErrorListener = (error: unknown) => void;

let activeUnsubscribe: Unsubscribe | null = null;
const listeners = new Set<VersionListener>();
const errorListeners = new Set<VersionErrorListener>();
let latestSnapshot: VersionDocSnapshot | null = null;

const notifyListeners = (snapshot: VersionDocSnapshot | null) => {
  latestSnapshot = snapshot;
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("Error in version listener:", error);
    }
  });
};

const notifyErrors = (error: unknown) => {
  errorListeners.forEach((listener) => {
    try {
      listener(error);
    } catch (notifyError) {
      console.warn("Error forwarding version listener error:", notifyError);
    }
  });
};

export function subscribeToVersionDoc(
  listener: VersionListener,
  onError?: VersionErrorListener,
): Unsubscribe {
  listeners.add(listener);
  if (onError) {
    errorListeners.add(onError);
  }

  if (!activeUnsubscribe) {
    const versionRef = doc(db, "version", "current");
    activeUnsubscribe = onSnapshot(
      versionRef,
      (docSnap) => {
        const data = (docSnap.exists() ? docSnap.data() : {}) as Record<string, unknown>;
        const nextSnapshot: VersionDocSnapshot = {
          id: docSnap.id,
          exists: docSnap.exists(),
          data,
          version: String((data.version as string | undefined) || "").trim(),
          versionstorage: String(
            (data.versionstorage as string | undefined) || "",
          ).trim(),
          notasDeSistemas: String(
            (data.notasDeSistemas as string | undefined) || "",
          ).trim(),
          systemNotes: Array.isArray(data.systemNotes) ? data.systemNotes : [],
        };
        notifyListeners(nextSnapshot);
      },
      (error) => {
        notifyErrors(error);
      },
    );
  }

  if (latestSnapshot) {
    listener(latestSnapshot);
  }

  return () => {
    listeners.delete(listener);
    if (onError) {
      errorListeners.delete(onError);
    }

    if (listeners.size === 0 && errorListeners.size === 0) {
      activeUnsubscribe?.();
      activeUnsubscribe = null;
      latestSnapshot = null;
    }
  };
}

export function getLatestVersionSnapshot(): VersionDocSnapshot | null {
  return latestSnapshot;
}
