type FirestoreUpdateTime = {
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
};

export function serializeFirestoreUpdateTime(
  value: FirestoreUpdateTime | null | undefined,
): string | null {
  if (!value) return null;
  const seconds = Number(value.seconds ?? value._seconds);
  const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds);
  if (!Number.isFinite(seconds) || !Number.isFinite(nanoseconds)) return null;
  return `${Math.trunc(seconds)}.${String(Math.trunc(nanoseconds)).padStart(9, "0")}`;
}
