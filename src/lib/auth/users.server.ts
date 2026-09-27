import { getAdminDb } from "@/lib/firebase-admin";
import type { User } from "@/types/firestore";

/**
 * Acceso a `users` SOLO para el servidor (Route Handlers), via Firebase Admin.
 *
 * Existe porque la ruta de login corre en el servidor y NO tiene sesion de
 * Firebase todavia: con las reglas endurecidas, el SDK cliente fallaria para
 * estas lecturas/escrituras. Replica el comportamiento de `UsersService`
 * (mismas consultas y normalizacion) sin exponer el SDK cliente al servidor.
 */

function normalizeUsername(name: string): string {
  return name.trim().normalize("NFKC").toLocaleLowerCase();
}

function mapDocToUser(doc: { id: string; data: () => Record<string, unknown> }): User {
  return { id: doc.id, ...(doc.data() as object) } as User;
}

/**
 * Equivalente server-side de `UsersService.findActiveUserByUsername`.
 * 1) Busca por `nameNormalized`; 2) si no hay, hace el fallback legacy por
 * variantes de `name` (tal como el original).
 */
export async function findActiveUserByUsernameServer(
  username: string,
): Promise<User | null> {
  const trimmed = username.trim().normalize("NFKC");
  const normalized = normalizeUsername(trimmed);
  if (!normalized) return null;

  const db = getAdminDb();

  const normalizedMatches = await db
    .collection("users")
    .where("nameNormalized", "==", normalized)
    .limit(5)
    .get();

  const normalizedMatch = normalizedMatches.docs
    .map(mapDocToUser)
    .find((candidate) => candidate.isActive !== false);
  if (normalizedMatch) return normalizedMatch;

  const titleCase = trimmed.replace(/\p{L}+/gu, (part) =>
    `${part.slice(0, 1).toLocaleUpperCase()}${part.slice(1).toLocaleLowerCase()}`,
  );
  const legacyNames = [
    trimmed,
    trimmed.toLocaleLowerCase(),
    trimmed.toLocaleUpperCase(),
    titleCase,
  ].filter((value, index, values) => value && values.indexOf(value) === index);

  const legacyMatches = await db
    .collection("users")
    .where("name", "in", legacyNames)
    .limit(10)
    .get();

  const legacyMatch = legacyMatches.docs
    .map(mapDocToUser)
    .find(
      (candidate) =>
        candidate.isActive !== false &&
        normalizeUsername(candidate.name || "") === normalized,
    );
  if (!legacyMatch) return null;

  return legacyMatch;
}

/**
 * Equivalente server-side de `UsersService.updateUser` limitado al caso que
 * usa la ruta de login: guardar el hash de contraseña. `newHash` ya viene de
 * `hashPasswordServer` (prefijo `$argon2`), por lo que no se re-hashea.
 */
export async function updateUserPasswordHashServer(
  userId: string,
  newHash: string,
): Promise<void> {
  if (!userId || !newHash.startsWith("$argon2")) {
    throw new Error("updateUserPasswordHashServer: hash invalido");
  }
  await getAdminDb()
    .collection("users")
    .doc(userId)
    .set(
      { password: newHash, updatedAt: new Date() },
      { merge: true },
    );
}

/**
 * Equivalente server-side de `UsersService.backfillUsernameLookup`.
 */
export async function backfillUsernameLookupServer(
  userId: string,
  username: string,
): Promise<void> {
  const nameNormalized = normalizeUsername(username);
  if (!userId || !nameNormalized) return;

  await getAdminDb()
    .collection("users")
    .doc(userId)
    .set({ nameNormalized, updatedAt: new Date() }, { merge: true });
}
