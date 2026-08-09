import admin from 'firebase-admin';
import { getAdminApp, getAdminAuth, getAdminDb } from './firebase-admin';

getAdminApp();

export const auth = getAdminAuth();
export const firestore = getAdminDb();
export default admin;
