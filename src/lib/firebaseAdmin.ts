import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

function initFirebaseAdmin() {
  if (getApps().length) return admin;

  // Try to load service account from repository if present
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require('../../serviceAccountKey.json');
    const opts: any = { credential: admin.credential.cert(serviceAccount) };
    if (serviceAccount.project_id) opts.projectId = serviceAccount.project_id;
    admin.initializeApp(opts);
  } catch (err) {
    // Fallback to default credentials
    try {
      admin.initializeApp();
    } catch (e) {
      // If initialization fails, rethrow to surface error
      throw e;
    }
  }

  return admin;
}

const adminApp = initFirebaseAdmin();

export const auth = adminApp.auth();
export const firestore = adminApp.firestore();
export default adminApp;
