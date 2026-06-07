import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { CLOSING_GUARD_LOCK_DURATION_MS } from "../../constants";
import type { ClosingGuardKind } from "../helpers";

export function buildClosingGuardDocId(normalizedCompany: string, kind: ClosingGuardKind) {
  const companyPart = encodeURIComponent(
    normalizedCompany.trim().toLowerCase(),
  );
  return `${companyPart}__${kind}`;
}

export async function acquireClosingGuard(
  normalizedCompany: string,
  kind: ClosingGuardKind,
  user: { email?: string | null; id?: string | null } | null,
  serverNowMs?: number,
): Promise<
  | { ok: true; token: string; docId: string }
  | {
      ok: false;
      remainingSec: number;
      lockedKind?: ClosingGuardKind;
      lockedBy?: string;
    }
> {
  const docId = buildClosingGuardDocId(normalizedCompany, kind);
  const lockRef = doc(db, "closingGuards", docId);
  const token = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(lockRef);
      const nowMs = serverNowMs ?? Date.now();
      const current = snap.exists() ? (snap.data() as any) : null;
      const lockedUntilMs = Number(current?.lockedUntilMs || 0);
      const lockedKind = (current?.kind as ClosingGuardKind | undefined) ?? undefined;
      const lockedBy = typeof current?.by === "string" ? current.by : undefined;
      const lockedToken = typeof current?.token === "string" ? current.token : undefined;

      if (lockedUntilMs > nowMs && lockedToken && lockedToken.length > 0) {
        const remainingSec = Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000));
        return { ok: false as const, remainingSec, lockedKind, lockedBy };
      }

      tx.set(
        lockRef,
        {
          token,
          kind,
          lockedUntilMs: nowMs + CLOSING_GUARD_LOCK_DURATION_MS,
          by: (user?.email || user?.id || "").toString(),
          startedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: true as const };
    });

    if (!result.ok) return result;
    return { ok: true, token, docId };
  } catch (err) {
    console.error("[CLOSING-GUARD] Error acquiring closing guard:", err);
    return { ok: true, token, docId };
  }
}

export async function touchClosingGuard(
  normalizedCompany: string,
  kind: ClosingGuardKind,
  user: { email?: string | null; id?: string | null } | null,
  serverNowMs?: number,
): Promise<void> {
  const docId = buildClosingGuardDocId(normalizedCompany, kind);
  const lockRef = doc(db, "closingGuards", docId);
  const token = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    await runTransaction(db, async (tx) => {
      const nowMs = serverNowMs ?? Date.now();
      tx.set(
        lockRef,
        {
          token,
          kind,
          lockedUntilMs: nowMs + CLOSING_GUARD_LOCK_DURATION_MS,
          by: (user?.email || user?.id || "").toString(),
          startedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  } catch (err) {
    console.error("[CLOSING-GUARD] Error touching closing guard:", err);
  }
}

export async function releaseClosingGuard(
  normalizedCompany: string,
  guard: { token: string; docId: string },
) {
  const lockRef = doc(db, "closingGuards", guard.docId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(lockRef);
      if (!snap.exists()) return;
      const current = snap.data() as any;
      if (current?.token !== guard.token) return;
      tx.set(
        lockRef,
        {
          token: "",
          lockedUntilMs: 0,
          releasedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  } catch (err) {
    console.error("[CLOSING-GUARD] Error releasing closing guard:", err);
  }
}

export async function forceClearClosingGuards(
  normalizedCompany: string,
  _context: string,
  user: { email?: string | null; id?: string | null } | null,
) {
  try {
    const fgDocId = buildClosingGuardDocId(normalizedCompany, "FONDO_GENERAL");
    const fvDocId = buildClosingGuardDocId(normalizedCompany, "FONDO_VENTAS");
    const fgRef = doc(db, "closingGuards", fgDocId);
    const fvRef = doc(db, "closingGuards", fvDocId);
    const by = (user?.email || user?.id || "").toString();

    await runTransaction(db, async (tx) => {
      tx.set(
        fgRef,
        {
          kind: "FONDO_GENERAL",
          token: "",
          lockedUntilMs: 0,
          clearedBy: by,
          clearedAt: serverTimestamp(),
          context: _context,
        },
        { merge: true },
      );
      tx.set(
        fvRef,
        {
          kind: "FONDO_VENTAS",
          token: "",
          lockedUntilMs: 0,
          clearedBy: by,
          clearedAt: serverTimestamp(),
          context: _context,
        },
        { merge: true },
      );
    });
  } catch (err) {
    console.error("[CLOSING-GUARD] Error force-clearing closing guards:", err);
  }
}
