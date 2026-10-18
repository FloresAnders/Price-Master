const DEFAULT_DATABASE_ALIASES = new Set(["default", "(default)"]);

export function normalizeFirestoreDatabaseId(
  value?: string,
): string | undefined {
  const databaseId = value?.trim();
  if (!databaseId) return undefined;

  return DEFAULT_DATABASE_ALIASES.has(databaseId.toLowerCase())
    ? undefined
    : databaseId;
}

export function resolveFirestoreDatabaseId({
  nodeEnv,
  explicitDatabaseId,
}: {
  nodeEnv?: string;
  explicitDatabaseId?: string;
}): string | undefined {
  if (explicitDatabaseId?.trim()) {
    return normalizeFirestoreDatabaseId(explicitDatabaseId);
  }

  return nodeEnv === "production" ? undefined : "restauracion";
}

export function toFirestoreDatabaseLabel(databaseId?: string): string {
  return normalizeFirestoreDatabaseId(databaseId) ?? "(default)";
}
