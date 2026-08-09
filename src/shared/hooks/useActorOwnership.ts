"use client";

import { useMemo } from "react";
import type { User } from "../types/firestore";
import {
  readActorSessionSnapshot,
  ensureOwnerIdArray,
  resolveActorOwnerId,
  type SessionSnapshot,
  type ActorLike,
} from "../utils/actorOwnership";

export function useActorOwnership(actor: Partial<User> | ActorLike) {
  // Solo leemos el localStorage una vez al montar para evitar parseos y nuevos objetos en cada render
  const sessionSnapshot = useMemo(() => {
    return typeof window === "undefined" ? null : readActorSessionSnapshot();
  }, []);

  // Usamos strings primitivos para las dependencias, evitando que referencias nuevas de "actor" rompan la memoización
  const actorKey = actor ? `${actor.id}-${actor.ownerId}-${actor.eliminate}` : "null";
  const sessionKey = sessionSnapshot ? `${sessionSnapshot.id}-${sessionSnapshot.ownerId}-${sessionSnapshot.eliminate}` : "null";

  const ownerIds = useMemo(
    () => ensureOwnerIdArray(actor, sessionSnapshot),
    [actorKey, sessionKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  
  const primaryOwnerId = useMemo(
    () => resolveActorOwnerId(actor, sessionSnapshot),
    [actorKey, sessionKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    ownerIds,
    primaryOwnerId,
    session: sessionSnapshot,
  };
}
