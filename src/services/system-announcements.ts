import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  PUBLISHED_SYSTEM_ANNOUNCEMENTS_COLLECTION,
  SYSTEM_ANNOUNCEMENTS_COLLECTION,
  draftToTimestamps,
  validateAnnouncementDraft,
  type AnnouncementDraft,
  type PublishedSystemAnnouncement,
  type SystemAnnouncement,
} from "@/lib/system-announcements";

type SnapshotErrorHandler = (error: FirestoreError) => void;

const privateCollection = () => collection(db, SYSTEM_ANNOUNCEMENTS_COLLECTION);
const publishedCollection = () =>
  collection(db, PUBLISHED_SYSTEM_ANNOUNCEMENTS_COLLECTION);

export function subscribeToSystemAnnouncements(
  onNext: (announcements: SystemAnnouncement[]) => void,
  onError?: SnapshotErrorHandler,
): Unsubscribe {
  return onSnapshot(
    privateCollection(),
    (snapshot) =>
      onNext(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data({ serverTimestamps: "estimate" }) as Omit<SystemAnnouncement, "id">),
        })),
      ),
    onError,
  );
}

export function subscribeToPublishedSystemAnnouncements(
  onNext: (announcements: PublishedSystemAnnouncement[]) => void,
  onError?: SnapshotErrorHandler,
): Unsubscribe {
  return onSnapshot(
    query(publishedCollection(), orderBy("priority", "desc"), limit(50)),
    (snapshot) =>
      onNext(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data({ serverTimestamps: "estimate" }) as Omit<PublishedSystemAnnouncement, "id">),
        })),
      ),
    onError,
  );
}

export async function saveSystemAnnouncement(input: {
  draft: AnnouncementDraft;
  actorUid: string;
  existing?: SystemAnnouncement | null;
}): Promise<string> {
  const actorUid = input.actorUid.trim();
  if (!actorUid) throw new Error("No se pudo identificar al Superadmin.");
  const errors = validateAnnouncementDraft(input.draft);
  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors)[0] || "El anuncio no es válido.");
  }

  const timestamps = draftToTimestamps(input.draft);
  const privateRef = input.existing
    ? doc(db, SYSTEM_ANNOUNCEMENTS_COLLECTION, input.existing.id)
    : doc(privateCollection());
  const publicRef = doc(
    db,
    PUBLISHED_SYSTEM_ANNOUNCEMENTS_COLLECTION,
    privateRef.id,
  );
  const writeTime = serverTimestamp();
  const version = input.existing ? input.existing.version + 1 : 1;
  const privateData = {
    title: input.draft.title.trim(),
    detail: input.draft.detail.trim(),
    type: input.draft.type,
    active: input.draft.active,
    startsAt: timestamps.startsAt,
    endsAt: timestamps.endsAt,
    allowDismiss: input.draft.allowDismiss,
    priority: input.draft.priority,
    scope: "global" as const,
    archived: input.draft.archived,
    version,
    createdAt: input.existing?.createdAt || writeTime,
    updatedAt: writeTime,
    createdBy: input.existing?.createdBy || actorUid,
    updatedBy: actorUid,
  };

  const batch = writeBatch(db);
  batch.set(privateRef, privateData);
  if (privateData.active && !privateData.archived) {
    batch.set(publicRef, {
      title: privateData.title,
      detail: privateData.detail,
      type: privateData.type,
      startsAt: privateData.startsAt,
      endsAt: privateData.endsAt,
      allowDismiss: privateData.allowDismiss,
      priority: privateData.priority,
      scope: privateData.scope,
      version: privateData.version,
      publishedAt: writeTime,
    });
  } else {
    batch.delete(publicRef);
  }
  await batch.commit();
  return privateRef.id;
}

export async function deleteSystemAnnouncement(id: string): Promise<void> {
  const safeId = id.trim();
  if (!safeId) throw new Error("El anuncio no tiene un identificador válido.");
  const batch = writeBatch(db);
  batch.delete(doc(db, PUBLISHED_SYSTEM_ANNOUNCEMENTS_COLLECTION, safeId));
  batch.delete(doc(db, SYSTEM_ANNOUNCEMENTS_COLLECTION, safeId));
  await batch.commit();
}

