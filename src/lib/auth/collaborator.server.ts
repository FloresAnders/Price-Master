import "server-only";

import { getAdminDb } from "@/lib/firebase-admin";
import type { User } from "@/types/firestore";
import { normalizeUserPermissions } from "@/utils/permissions";
import { resolveCollaboratorEffectiveUser } from "./collaborator";

export function getCollaboratorInheritedFields(
  user: User,
): { inheritedFromUserId: string; inheritedFromUserName: string } | null {
  if (user.accountType !== "collaborator") return null;
  const inheritedFromUserId = String(user.inheritedFromUserId || "").trim();
  if (!inheritedFromUserId) return null;
  return {
    inheritedFromUserId,
    inheritedFromUserName: String(user.fullName || user.name || "").trim(),
  };
}

export async function resolveEffectiveUserServer(user: User): Promise<User> {
  if (user.accountType !== "collaborator") return user;

  const inheritedFromUserId = String(
    user.inheritedFromUserId || "",
  ).trim();
  if (!inheritedFromUserId) {
    return {
      ...user,
      isActive: false,
      permissions: normalizeUserPermissions({}, "user"),
    };
  }

  const parentSnapshot = await getAdminDb()
    .collection("users")
    .doc(inheritedFromUserId)
    .get();
  if (!parentSnapshot.exists) return resolveCollaboratorEffectiveUser(user, null);
  const parent = {
    id: parentSnapshot.id,
    ...parentSnapshot.data(),
  } as User;
  return resolveCollaboratorEffectiveUser(user, parent);
}
