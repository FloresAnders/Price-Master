import { Timestamp } from 'firebase/firestore';

export type FirestoreEncodedValue =
  | { __pm_type: 'timestamp'; iso: string }
  | { __pm_type: 'date'; iso: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function encodeFirestoreValue(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;

  if (value instanceof Timestamp) {
    return { __pm_type: 'timestamp', iso: value.toDate().toISOString() } satisfies FirestoreEncodedValue;
  }

  if (value instanceof Date) {
    return { __pm_type: 'date', iso: value.toISOString() } satisfies FirestoreEncodedValue;
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeFirestoreValue(item)).filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    Object.entries(value).forEach(([k, v]) => {
      const encoded = encodeFirestoreValue(v);
      if (encoded !== undefined) out[k] = encoded;
    });
    return out;
  }

  return value;
}

export function decodeFirestoreValue(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => decodeFirestoreValue(item)).filter((item) => item !== undefined);
  }

  if (isPlainObject(value) && typeof value.__pm_type === 'string') {
    const type = value.__pm_type;
    if ((type === 'timestamp' || type === 'date') && typeof value.iso === 'string') {
      const date = new Date(value.iso);
      if (!Number.isNaN(date.getTime())) {
        // Store everything as Firestore Timestamp (Date also works but Timestamp is consistent)
        return Timestamp.fromDate(date);
      }
    }
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    Object.entries(value).forEach(([k, v]) => {
      const decoded = decodeFirestoreValue(v);
      if (decoded !== undefined) out[k] = decoded;
    });
    return out;
  }

  return value;
}

export function encodeFirestoreData<T>(data: T): T {
  return encodeFirestoreValue(data) as T;
}

export function decodeFirestoreData<T>(data: T): T {
  return decodeFirestoreValue(data) as T;
}
