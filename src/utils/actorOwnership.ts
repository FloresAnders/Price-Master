import type { User } from '../types/firestore';

export type ActorLike = Pick<User, 'id' | 'ownerId' | 'role' | 'eliminate'> | null | undefined;

export interface SessionSnapshot {
  id?: string;
  ownerId?: string;
  eliminate?: boolean;
  role?: string;
}

const SESSION_KEY = 'pricemaster_session';

const normalizeId = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return String(value);
};

const coerceBoolean = (value: unknown): boolean | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const coerceRole = (value: unknown): User['role'] | undefined => {
  if (typeof value !== 'string') return undefined;
  const role = value.trim();
  if (role === 'admin' || role === 'user' || role === 'superadmin') return role;
  return undefined;
};

export const readActorSessionSnapshot = (): SessionSnapshot | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return null;

    const id = normalizeId(parsed.id);
    const ownerId = normalizeId(parsed.ownerId);
    const eliminate = coerceBoolean(parsed.eliminate);
    const role = coerceRole(parsed.role);

    const snapshot: SessionSnapshot = {};
    if (id) snapshot.id = id;
    if (ownerId) snapshot.ownerId = ownerId;
    if (eliminate !== undefined) snapshot.eliminate = eliminate;
    if (role) snapshot.role = role;

    return Object.keys(snapshot).length > 0 ? snapshot : null;
  } catch (error) {
    console.warn('Failed to parse stored session snapshot:', error);
    return null;
  }
};

const addOwnerId = (set: Set<string>, value: unknown) => {
  const normalized = normalizeId(value);
  if (normalized) set.add(normalized);
};

export const buildActorOwnerIdSet = (
  actor: ActorLike,
  session?: SessionSnapshot | null
): Set<string> => {
  const ownerIds = new Set<string>();

  if (actor) {
    addOwnerId(ownerIds, actor.ownerId);
    if (actor.eliminate === false) addOwnerId(ownerIds, actor.id);
  }

  if (session) {
    addOwnerId(ownerIds, session.ownerId);
    if (session.eliminate === false) addOwnerId(ownerIds, session.id);
  }

  return ownerIds;
};

export const resolveActorOwnerId = (
  actor: ActorLike,
  session?: SessionSnapshot | null
): string => {
  const orderedCandidates: Array<unknown> = [
    actor?.ownerId,
    session?.ownerId,
    actor?.eliminate === false ? actor?.id : undefined,
    session?.eliminate === false ? session?.id : undefined
  ];

  for (const candidate of orderedCandidates) {
    const normalized = normalizeId(candidate);
    if (normalized) return normalized;
  }

  return '';
};

export const actorOwnsResource = (
  actor: ActorLike,
  resourceOwnerId: unknown,
  session?: SessionSnapshot | null
): boolean => {
  const normalized = normalizeId(resourceOwnerId);
  if (!normalized) return false;
  const ownerIds = buildActorOwnerIdSet(actor, session);
  return ownerIds.has(normalized);
};

export const ensureOwnerIdArray = (
  actor: ActorLike,
  session?: SessionSnapshot | null
): string[] => Array.from(buildActorOwnerIdSet(actor, session));
