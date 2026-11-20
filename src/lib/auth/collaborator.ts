import type { User } from "@/types/firestore";
import { normalizeUserPermissions } from "@/utils/permissions";

export function resolveCollaboratorEffectiveUser(
  collaborator: User,
  parent: User | null,
): User {
  if (!parent || parent.isActive === false) {
    return {
      ...collaborator,
      isActive: false,
      permissions: normalizeUserPermissions({}, "user"),
    };
  }

  return {
    ...collaborator,
    role: "user",
    ownerId: parent.ownerId || parent.id || collaborator.ownerId || "",
    ownercompanie:
      collaborator.ownercompanie || parent.ownercompanie || "",
    eliminate: false,
    permissions: normalizeUserPermissions(
      parent.permissions,
      parent.role || "user",
    ),
  };
}
