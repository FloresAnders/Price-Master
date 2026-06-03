export function buildLegacyPhysicalCountStorageKey(
  accountKey: string,
  company: string,
): string | null {
  if (accountKey !== "FondoGeneral") return null;
  const normalizedCompany = (company || "").trim();
  if (normalizedCompany.length === 0) return null;
  return `fondogeneral-lastClosing:${normalizedCompany}:${accountKey}`;
}

export function buildPhysicalCountStorageKey(
  accountKey: string,
  company: string,
): string | null {
  if (accountKey !== "FondoGeneral") return null;
  const normalizedCompany = (company || "").trim();
  if (normalizedCompany.length === 0) return null;
  return `fondogeneral-lastClosing:${normalizedCompany}`;
}

export function cleanupPhysicalCountLegacyKeys(
  accountKey: string,
  company: string,
): void {
  if (typeof window === "undefined") return;
  if (accountKey !== "FondoGeneral") return;
  const normalizedCompany = (company || "").trim();
  if (normalizedCompany.length === 0) return;

  const dateScopedPrefix = `fondogeneral-lastClosing:${normalizedCompany}:FondoGeneral:`;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(dateScopedPrefix)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }

  try {
    const legacyKey = buildLegacyPhysicalCountStorageKey(accountKey, company);
    if (legacyKey) localStorage.removeItem(legacyKey);
  } catch {
    // ignore
  }
}

export function shouldPromptPhysicalCount(
  accountKey: string,
  company: string,
): boolean {
  if (accountKey !== "FondoGeneral") return false;
  if (typeof window === "undefined") return false;

  const newKey = buildPhysicalCountStorageKey(accountKey, company);
  if (!newKey) return false;

  const normalizeBoolean = (raw: string | null): boolean | null => {
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw === null) return null;
    return null;
  };

  const tryMigrateLegacyValue = (raw: string | null): boolean => {
    const asBool = normalizeBoolean(raw);
    if (asBool === true) return true;
    if (asBool === false || raw === null) return false;

    try {
      const parsed = JSON.parse(raw) as any;
      return Boolean(parsed);
    } catch {
      return false;
    }
  };

  try {
    const rawNew = localStorage.getItem(newKey);
    const boolNew = normalizeBoolean(rawNew);
    if (boolNew !== null) return boolNew;

    if (tryMigrateLegacyValue(rawNew)) {
      localStorage.setItem(newKey, "true");
      return true;
    }

    const legacyKey = buildLegacyPhysicalCountStorageKey(accountKey, company);
    const rawLegacy = legacyKey ? localStorage.getItem(legacyKey) : null;
    const legacyPending = tryMigrateLegacyValue(rawLegacy);

    const normalizedCompany = (company || "").trim();
    const dateScopedPrefix = `fondogeneral-lastClosing:${normalizedCompany}:FondoGeneral:`;
    let dateScopedPending = false;
    if (normalizedCompany.length > 0) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(dateScopedPrefix)) continue;
        const v = localStorage.getItem(k);
        if (normalizeBoolean(v) === true || tryMigrateLegacyValue(v)) {
          dateScopedPending = true;
          break;
        }
      }
    }

    const pending = legacyPending || dateScopedPending;
    if (pending) {
      localStorage.setItem(newKey, "true");
    }

    cleanupPhysicalCountLegacyKeys(accountKey, company);

    return pending;
  } catch {
    return false;
  }
}
