import type { MovementStorage } from "@/services/movimientos-fondos";

export function acceptLedgerSnapshot<T>(
  ref: { current: MovementStorage<T> | null },
  next: MovementStorage<T>,
  expectedCompany: string,
): boolean {
  if (next.company.trim() !== expectedCompany.trim()) return false;
  const current = ref.current;
  if (current?.company.trim() === expectedCompany.trim()) {
    const currentRevision = current.state.revision ?? 0;
    const nextRevision = next.state.revision ?? 0;
    if (nextRevision < currentRevision) return false;
    if (nextRevision === currentRevision &&
      next.state.updatedAt < current.state.updatedAt) return false;
  }
  ref.current = next;
  return true;
}

export function writeLedgerLocalCacheIfCurrent<T>(
  cache: Pick<Storage, "getItem" | "setItem">,
  docKey: string,
  next: MovementStorage<T>,
  expectedCompany: string,
): boolean {
  const raw = cache.getItem(docKey);
  let current: MovementStorage<T> | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MovementStorage<T>;
      if (parsed?.state?.balancesByAccount && typeof parsed.company === "string") current = parsed;
    } catch {
      // A malformed cache does not outrank a confirmed Firestore result.
    }
  }
  const ref = { current };
  if (!acceptLedgerSnapshot(ref, next, expectedCompany)) return false;
  cache.setItem(docKey, JSON.stringify(next));
  return true;
}
