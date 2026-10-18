const DEFAULT_DATABASE_LABEL = "(default)";

/**
 * Production-maintenance scripts target `(default)` unless the operator
 * explicitly selects a named database.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveOperationalFirestoreDatabaseId(env = process.env) {
  const rawDatabaseId = String(
    env.FIRESTORE_DATABASE_ID ||
      env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID ||
      "",
  ).trim();

  if (!rawDatabaseId) return undefined;

  const normalized = rawDatabaseId.toLowerCase();
  return normalized === "default" || normalized === DEFAULT_DATABASE_LABEL
    ? undefined
    : rawDatabaseId;
}

/**
 * @param {{ firestore: () => unknown, app: () => { firestore: (databaseId: string) => unknown } }} admin
 * @param {Record<string, string | undefined>} [env]
 */
export function getOperationalFirestore(admin, env = process.env) {
  const databaseId = resolveOperationalFirestoreDatabaseId(env);

  return {
    db: databaseId
      ? admin.app().firestore(databaseId)
      : admin.firestore(),
    databaseId,
    databaseLabel: databaseId || DEFAULT_DATABASE_LABEL,
  };
}
