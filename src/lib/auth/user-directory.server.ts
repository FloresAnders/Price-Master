import "server-only";

import { getAdminDb } from "@/lib/firebase-admin";
import {
  selectVisibleDirectoryUsers,
  type DirectoryActor,
} from "@/lib/auth/user-directory-policy";
import type { User } from "@/types/firestore";

type DirectoryQuery = { id?: string };

const mapUserDocument = (document: {
  id: string;
  data: () => FirebaseFirestore.DocumentData | undefined;
}): User => ({ id: document.id, ...(document.data() ?? {}) }) as User;

const actorOwnerId = (actor: DirectoryActor): string =>
  String(
    actor.role === "admin" && actor.eliminate === false
      ? actor.id || actor.ownerId || ""
      : actor.ownerId || actor.id || "",
  ).trim();

export async function listDirectoryUsersForActor(
  actor: DirectoryActor,
  query: DirectoryQuery = {},
): Promise<Array<Omit<User, "password">>> {
  const usersCollection = getAdminDb().collection("users");

  if (query.id) {
    const snapshot = await usersCollection.doc(query.id).get();
    if (!snapshot.exists) return [];
    return selectVisibleDirectoryUsers(actor, [mapUserDocument(snapshot)]);
  }

  if (actor.role === "superadmin") {
    const snapshot = await usersCollection.get();
    return selectVisibleDirectoryUsers(actor, snapshot.docs.map(mapUserDocument));
  }

  const ownerId = actorOwnerId(actor);
  const [ownedSnapshot, actorSnapshot, ownerSnapshot] = await Promise.all([
    ownerId
      ? usersCollection.where("ownerId", "==", ownerId).get()
      : Promise.resolve(null),
    actor.id ? usersCollection.doc(actor.id).get() : Promise.resolve(null),
    ownerId && ownerId !== actor.id
      ? usersCollection.doc(ownerId).get()
      : Promise.resolve(null),
  ]);

  const candidates = new Map<string, User>();
  for (const document of ownedSnapshot?.docs ?? []) {
    candidates.set(document.id, mapUserDocument(document));
  }
  for (const snapshot of [actorSnapshot, ownerSnapshot]) {
    if (snapshot?.exists) candidates.set(snapshot.id, mapUserDocument(snapshot));
  }

  return selectVisibleDirectoryUsers(actor, [...candidates.values()]);
}
