import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  (process.env.FUNCTIONS_EMULATOR === 'true' ? '(default)' : 'restauracion');

if (!admin.apps.length) {
  admin.initializeApp();
}

export const createFirestoreDatabaseSelector = (getFirestoreInstance) =>
  (databaseId) => {
    const normalizedDatabaseId = String(databaseId || '').trim() || '(default)';
    return normalizedDatabaseId === '(default)'
      ? getFirestoreInstance()
      : getFirestoreInstance(normalizedDatabaseId);
  };

const selectFirestoreDatabase = createFirestoreDatabaseSelector(getFirestore);

export const getDb = () => selectFirestoreDatabase(FIRESTORE_DATABASE_ID);

export const getDbByDatabaseId = selectFirestoreDatabase;

export { admin };
