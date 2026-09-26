import { getAdminDb } from "@/lib/firebase-admin";
import type { Empresas, User } from "@/types/firestore";
import { normalizeUserPermissions } from "@/utils/permissions";

const normalizeKey = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export async function getSinpeEmpresa(empresaId: string) {
  const normalizedId = String(empresaId || "").trim();
  if (!normalizedId) return null;
  const snapshot = await getAdminDb().collection("empresas").doc(normalizedId).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() } as Empresas;
}

export function canAccessSinpeEmpresa(
  user: Omit<User, "password">,
  empresa: Empresas,
) {
  if (user.role === "superadmin") return true;

  if (user.role === "admin") {
    const allowedOwners = new Set<string>();
    const ownerId = normalizeKey(user.ownerId);
    const userId = normalizeKey(user.id);
    if (ownerId) allowedOwners.add(ownerId);
    if (user.eliminate === false && userId) allowedOwners.add(userId);
    return allowedOwners.has(normalizeKey(empresa.ownerId));
  }

  if (user.role !== "user") return false;
  const assigned = normalizeKey(user.ownercompanie);
  if (!assigned) return false;
  return [empresa.id, empresa.name, empresa.ubicacion]
    .map(normalizeKey)
    .filter(Boolean)
    .includes(assigned);
}

export function canUseSinpeReports(user: Omit<User, "password">) {
  return normalizeUserPermissions(
    user.permissions,
    user.role || "user",
  ).reportessinpe === true;
}

