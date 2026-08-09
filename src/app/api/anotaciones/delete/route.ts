import { NextResponse } from "next/server";
import { getAdminDb } from "@/shared/lib/firebase-admin";
import {
  hashPasswordServer,
  verifyPasswordServer,
} from "@/shared/lib/auth/password.server";
import { readUserIdFromSessionCookie } from "@/shared/lib/auth/session-cookie.server";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

type UserRecord = {
  password?: string;
  isActive?: boolean;
  role?: "admin" | "user" | "superadmin";
  ownerId?: string;
  ownercompanie?: string;
  permissions?: { anotaciones?: boolean };
};

type NoteRecord = {
  empresa?: string;
  empresaId?: string;
  ownerId?: string;
};

const normalizeEmpresaDocId = (empresa: string): string => {
  const base = String(empresa || "").trim();
  if (!base) return "GLOBAL";
  return base
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "-")
    .slice(0, 200);
};

function rateLimitKey(request: Request, userId: string) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `${ip}:${userId}`;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function clearRateLimit(key: string) {
  attempts.delete(key);
}

function hasAnotacionesPermission(user: UserRecord) {
  return (
    user.role === "admin" ||
    user.role === "superadmin" ||
    user.permissions?.anotaciones === true
  );
}

function canAccessNote(user: UserRecord, note: NoteRecord) {
  if (user.role === "superadmin") return true;
  if (user.role === "admin") {
    return Boolean(note.ownerId && note.ownerId === user.ownerId);
  }
  return Boolean(note.empresa && note.empresa === user.ownercompanie);
}

async function verifyUserPassword(
  userId: string,
  password: string,
  user: UserRecord,
) {
  const storedPassword = user.password || "";
  if (!storedPassword) return false;

  if (storedPassword.startsWith("$argon2")) {
    return verifyPasswordServer(password, storedPassword);
  }

  const ok = storedPassword === password;
  if (ok) {
    await getAdminDb()
      .collection("users")
      .doc(userId)
      .update({ password: await hashPasswordServer(password) })
      .catch((err) => {
        console.warn("Failed to upgrade legacy password hash for user", userId, err);
      });
  }
  return ok;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      password?: unknown;
      empresa?: unknown;
      noteId?: unknown;
    };
    const userId = readUserIdFromSessionCookie(request.headers.get("cookie"));
    const password = typeof body.password === "string" ? body.password : "";
    const empresa = typeof body.empresa === "string" ? body.empresa.trim() : "";
    const noteId = typeof body.noteId === "string" ? body.noteId.trim() : "";

    if (!userId || !password || !empresa || !noteId) {
      return NextResponse.json(
        { ok: false },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const key = rateLimitKey(request, userId);
    if (isRateLimited(key)) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { ok: false },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const user = userSnap.data() as UserRecord;
    const passwordOk = await verifyUserPassword(userId, password, user);
    if (!user.isActive || !passwordOk || !hasAnotacionesPermission(user)) {
      return NextResponse.json(
        { ok: false },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const empresaId = normalizeEmpresaDocId(empresa);
    const noteRef = db
      .collection("anotaciones")
      .doc(empresaId)
      .collection("movements")
      .doc(noteId);
    const noteSnap = await noteRef.get();
    if (!noteSnap.exists) {
      return NextResponse.json(
        { ok: false },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const note = noteSnap.data() as NoteRecord;
    if (note.empresaId !== empresaId || !canAccessNote(user, note)) {
      return NextResponse.json(
        { ok: false },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    await noteRef.delete();
    clearRateLimit(key);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error deleting anotacion:", error);
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
