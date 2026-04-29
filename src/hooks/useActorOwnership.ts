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
  const sessionSnapshot: SessionSnapshot | null =
    typeof window === "undefined" ? null : readActorSessionSnapshot();

  const ownerIds = useMemo(
    () => ensureOwnerIdArray(actor, sessionSnapshot),
    [actor, sessionSnapshot],
  );
  const primaryOwnerId = useMemo(
    () => resolveActorOwnerId(actor, sessionSnapshot),
    [actor, sessionSnapshot],
  );

  return {
    ownerIds,
    primaryOwnerId,
    session: sessionSnapshot,
  };
}
