import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function parseServiceAccount() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccount = parseServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId:
        serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
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
