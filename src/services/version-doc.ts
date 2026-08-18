import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/config/firebase";

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
let initPromise: Promise<VersionDocSnapshot | null> | null = null;

const buildSnapshot = (docSnap: { id: string; exists: () => boolean; data: () => Record<string, unknown> }): VersionDocSnapshot => {
  const data = (docSnap.exists() ? docSnap.data() : {}) as Record<string, unknown>;
  return {
    id: docSnap.id,
    exists: docSnap.exists(),
    data,
    version: String((data.version as string | undefined) || "").trim(),
    versionstorage: String((data.versionstorage as string | undefined) || "").trim(),
    notasDeSistemas: String((data.notasDeSistemas as string | undefined) || "").trim(),
    systemNotes: Array.isArray(data.systemNotes) ? data.systemNotes : [],
  };
};

export async function readVersionSnapshotOnce(): Promise<VersionDocSnapshot | null> {
  if (latestSnapshot) return latestSnapshot;
  if (initPromise) return initPromise.then(() => latestSnapshot);

  const versionRef = doc(db, "version", "current");
  initPromise = getDoc(versionRef)
    .then((docSnap) => {
      latestSnapshot = buildSnapshot(docSnap as any);
      return latestSnapshot;
    })
    .catch((error) => {
      console.warn("Error reading version snapshot once:", error);
      latestSnapshot = null;
      return null;
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise.then(() => latestSnapshot);
}

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
        const nextSnapshot = buildSnapshot(docSnap as any);
        notifyListeners(nextSnapshot);
      },
      (error) => {
        notifyErrors(error);
      },
    );
  }

  void readVersionSnapshotOnce().then((snapshot) => {
    if (snapshot) {
      listener(snapshot);
    }
  });

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
