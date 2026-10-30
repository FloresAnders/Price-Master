import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { admin, getDbByDatabaseId as selectFirestoreDatabase } from './firebase.js';
import {
  syncUserStatus as syncUserStatusCore,
} from './user-status-core.js';

export const syncUserStatus = async ({
  databaseId,
  userId,
  getDbByDatabaseId = selectFirestoreDatabase,
  serverTimestamp = admin.firestore.FieldValue.serverTimestamp,
}) => {
  return syncUserStatusCore({
    databaseId,
    userId,
    getDbByDatabaseId,
    serverTimestamp,
  });
};

const createUserStatusTrigger = (databaseId) =>
  onDocumentWritten(
    { document: 'users/{userId}', database: databaseId, retry: true },
    (event) =>
      syncUserStatus({
        databaseId,
        userId: event.params.userId,
      }),
  );

export const onUserStatusWrite = createUserStatusTrigger('(default)');
export const onUserStatusWriteRestauracion = createUserStatusTrigger('restauracion');
