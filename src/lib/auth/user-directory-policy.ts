import type { User } from "@/types/firestore";

export type DirectoryActor = Pick<
  User,
  "id" | "role" | "ownerId" | "eliminate"
>;

export function sanitizeDirectoryUser(user: User): Omit<User, "password"> {
  const safeUser = { ...user };
  delete safeUser.password;
  return safeUser;
}

const resolveActorOwnerId = (actor: DirectoryActor): string => {
  if (actor.role === "admin" && actor.eliminate === false) {
    return String(actor.id || actor.ownerId || "").trim();
  }
  return String(actor.ownerId || actor.id || "").trim();
};

export function selectVisibleDirectoryUsers(
  actor: DirectoryActor,
  users: User[],
): Array<Omit<User, "password">> {
  const visible =
    actor.role === "superadmin"
      ? users
      : users.filter((user) => {
          const ownerId = resolveActorOwnerId(actor);
          if (!ownerId) return user.id === actor.id;
          return (
            user.id === actor.id ||
            user.id === ownerId ||
            String(user.ownerId || "").trim() === ownerId
          );
        });

  return visible.map(sanitizeDirectoryUser);
}
