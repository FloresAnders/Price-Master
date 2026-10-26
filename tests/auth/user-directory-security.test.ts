import { describe, expect, it } from "vitest";
import {
  sanitizeDirectoryUser,
  selectVisibleDirectoryUsers,
} from "@/lib/auth/user-directory-policy";
import type { User } from "@/types/firestore";

const users: User[] = [
  {
    id: "owner-a",
    name: "Admin A",
    email: "admin-a@example.com",
    password: "legacy-admin-password",
    role: "admin",
    ownerId: "owner-a",
    eliminate: false,
  },
  {
    id: "user-a",
    name: "Usuario A",
    email: "user-a@example.com",
    password: "$argon2id$user-a-hash",
    role: "user",
    ownerId: "owner-a",
  },
  {
    id: "user-b",
    name: "Usuario B",
    email: "user-b@example.com",
    password: "$argon2id$user-b-hash",
    role: "user",
    ownerId: "owner-b",
  },
];

describe("directorio seguro de usuarios", () => {
  it("elimina password sin modificar el documento original", () => {
    const original = users[0];
    const safe = sanitizeDirectoryUser(original);

    expect(safe).not.toHaveProperty("password");
    expect(original.password).toBe("legacy-admin-password");
  });

  it("limita admin y usuario a su owner y nunca devuelve password", () => {
    const adminVisible = selectVisibleDirectoryUsers(
      { id: "owner-a", role: "admin", ownerId: "owner-a", eliminate: false },
      users,
    );
    const userVisible = selectVisibleDirectoryUsers(
      { id: "user-a", role: "user", ownerId: "owner-a" },
      users,
    );

    expect(adminVisible.map((user) => user.id)).toEqual(["owner-a", "user-a"]);
    expect(userVisible.map((user) => user.id)).toEqual(["owner-a", "user-a"]);
    expect([...adminVisible, ...userVisible]).toSatisfy((visibleUsers: User[]) =>
      visibleUsers.every((user) => !("password" in user)),
    );
  });

  it("permite a superadmin listar todos pero sin credenciales", () => {
    const visible = selectVisibleDirectoryUsers(
      { id: "root", role: "superadmin" },
      users,
    );

    expect(visible).toHaveLength(3);
    expect(visible.every((user) => !("password" in user))).toBe(true);
  });
});
