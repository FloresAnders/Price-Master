import { getAuth } from "firebase-admin/auth";
import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function readFirebaseServiceAccountFromEnv(
  env: Record<string, string | undefined> = process.env,
): ServiceAccount {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is required for Firebase Admin.",
    );
  }

  try {
    const parsed = JSON.parse(raw);
    const projectId = parsed.project_id || parsed.projectId;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    const rawPrivateKey = parsed.private_key || parsed.privateKey;
    const privateKey =
      typeof rawPrivateKey === "string"
        ? rawPrivateKey.replace(/\\n/g, "\n")
        : undefined;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY must contain project_id, client_email, and private_key.",
      );
    }

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON.");
    }
    throw error;
  }
}

export function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccount = readFirebaseServiceAccountFromEnv();
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  const rawDatabaseId = (
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID ||
    ""
  ).trim();
  return rawDatabaseId
    ? getFirestore(getAdminApp(), rawDatabaseId)
    : getFirestore(getAdminApp());
}
