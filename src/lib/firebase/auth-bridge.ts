"use client";

import app from "@/config/firebase";
import {
  getAuth,
  signInWithCustomToken,
  signOut,
  type Auth,
} from "firebase/auth";

/**
 * Bridges the custom server session (`timemaster_auth` cookie) into Firebase
 * Authentication on the main app, so `request.auth` is populated and the
 * Firestore rules (`isSignedIn()`) apply.
 *
 * The SINPE realtime client uses its own isolated Firebase app; this helper
 * deliberately operates on the default app that owns the Firestore instance.
 */

let pendingSignIn: Promise<boolean> | null = null;

function mainAuth(): Auth {
  return getAuth(app);
}

export async function ensureFirebaseCustomTokenAuth(
  expectedUserId: string,
): Promise<boolean> {
  if (typeof window === "undefined" || !expectedUserId) return false;

  const auth = mainAuth();

  if (auth.currentUser?.uid === expectedUserId) return true;
  if (pendingSignIn) return pendingSignIn;

  pendingSignIn = (async () => {
    try {
      // Never keep a Firebase session for a different account than the server.
      if (auth.currentUser && auth.currentUser.uid !== expectedUserId) {
        await signOut(auth);
      }

      const response = await fetch("/api/auth/firebase-token", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return false;

      const data = (await response.json().catch(() => null)) as {
        token?: string;
      } | null;
      if (!data?.token) return false;

      await signInWithCustomToken(auth, data.token);
      return true;
    } catch (error) {
      console.warn("No se pudo establecer la sesión de Firebase", error);
      return false;
    } finally {
      pendingSignIn = null;
    }
  })();

  return pendingSignIn;
}

export async function clearFirebaseCustomTokenAuth(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await signOut(mainAuth());
  } catch {
    // Best effort: the server cookie remains the authority.
  }
}
