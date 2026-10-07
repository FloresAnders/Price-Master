import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

const COLLECTION_NAME = "sinpeNotificationPreferences";

export async function writeSinpeNotificationPreference(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await getAdminDb().collection(COLLECTION_NAME).doc(userId).set(
    {
      enabled,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
}
