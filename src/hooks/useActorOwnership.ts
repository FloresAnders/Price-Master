'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '../types/firestore';
import {
  readActorSessionSnapshot,
  ensureOwnerIdArray,
  resolveActorOwnerId,
  type SessionSnapshot,
  type ActorLike
} from '../utils/actorOwnership';

export function useActorOwnership(actor: Partial<User> | ActorLike) {
  const getInitialSnapshot = () => {
    if (typeof window === 'undefined') return null;
    return readActorSessionSnapshot();
  };

  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | null>(getInitialSnapshot);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSessionSnapshot(readActorSessionSnapshot());
  }, [actor?.eliminate, actor?.id, actor?.ownerId, actor?.role]);

  const ownerIds = useMemo(() => ensureOwnerIdArray(actor, sessionSnapshot), [actor, sessionSnapshot]);
  const primaryOwnerId = useMemo(() => resolveActorOwnerId(actor, sessionSnapshot), [actor, sessionSnapshot]);

  return {
    ownerIds,
    primaryOwnerId,
    session: sessionSnapshot
  };
}
