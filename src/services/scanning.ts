import {
    collection,
    doc,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    Timestamp,
    DocumentData
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ScanResult } from '../types/firestore';

export type { ScanResult } from '../types/firestore';

export class ScanningService {
    private static readonly COLLECTION_NAME = 'scans';

    /**
     * Add a new scan result
     */
    static async addScan(scan: Omit<ScanResult, 'id' | 'timestamp'>): Promise<string> {
        try {
            const scanWithTimestamp = {
                ...scan,
                timestamp: new Date(),
                processed: false
            };

            const docRef = await addDoc(collection(db, this.COLLECTION_NAME), scanWithTimestamp);
            return docRef.id;
        } catch (error) {
            console.error('Error adding scan:', error);
            throw error;
        }
    }

    /**
     * Get all scan results
     */
    static async getAllScans(): Promise<ScanResult[]> {
        try {
            const q = query(
                collection(db, this.COLLECTION_NAME),
                orderBy('timestamp', 'desc'),
                limit(100)
            );
            const querySnapshot = await getDocs(q);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            } as ScanResult));
        } catch (error) {
            console.error('Error getting scans:', error);
            throw error;
        }
    }

    /**
     * Get unprocessed scans for a specific session
     */
    static async getUnprocessedScans(sessionId?: string): Promise<ScanResult[]> {
        try {
            let q = query(
                collection(db, this.COLLECTION_NAME),
                where('processed', '==', false),
                orderBy('timestamp', 'desc')
            );

            if (sessionId) {
                q = query(
                    collection(db, this.COLLECTION_NAME),
                    where('processed', '==', false),
                    where('sessionId', '==', sessionId),
                    orderBy('timestamp', 'desc')
                );
            }

            const querySnapshot = await getDocs(q);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            } as ScanResult));
        } catch (error) {
            console.error('Error getting unprocessed scans:', error);
            throw error;
        }
    }

    /**
     * Mark a scan as processed
     */
    static async markAsProcessed(scanId: string): Promise<void> {
        try {
            const docRef = doc(db, this.COLLECTION_NAME, scanId);
            await updateDoc(docRef, {
                processed: true,
                processedAt: new Date()
            });
        } catch (error) {
            console.error('Error marking scan as processed:', error);
            throw error;
        }
    }

    /**
     * Delete a scan
     */
    static async deleteScan(scanId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, this.COLLECTION_NAME, scanId));
        } catch (error) {
            console.error('Error deleting scan:', error);
            throw error;
        }
    }

    /**
     * Clear all processed scans older than specified days
     */
    static async cleanupOldScans(daysOld: number = 7): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const q = query(
                collection(db, this.COLLECTION_NAME),
                where('processed', '==', true),
                where('timestamp', '<', cutoffDate)
            );

            const querySnapshot = await getDocs(q);

            const deletePromises = querySnapshot.docs.map(doc =>
                deleteDoc(doc.ref)
            );

            await Promise.all(deletePromises);
            return querySnapshot.docs.length;
        } catch (error) {
            console.error('Error cleaning up old scans:', error);
            throw error;
        }
    }

    /**
     * Listen to real-time changes in scans
     */
    static subscribeToScans(
        callback: (scans: ScanResult[]) => void,
        onError?: (error: Error) => void,
        sessionId?: string
    ): () => void {
        try {
            let q = query(
                collection(db, this.COLLECTION_NAME),
                where('processed', '==', false),
                orderBy('timestamp', 'desc'),
                limit(50)
            );

            if (sessionId) {
                q = query(
                    collection(db, this.COLLECTION_NAME),
                    where('processed', '==', false),
                    where('sessionId', '==', sessionId),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
            }

            const unsubscribe = onSnapshot(
                q,
                (querySnapshot) => {
                    const scans: ScanResult[] = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        timestamp: doc.data().timestamp?.toDate() || new Date()
                    } as ScanResult));

                    callback(scans);
                },
                (error) => {
                    console.error('Error in scan subscription:', error);
                    if (onError) {
                        onError(error as Error);
                    }
                }
            );

            return unsubscribe;
        } catch (error) {
            console.error('Error setting up scan subscription:', error);
            throw error;
        }
    }

    /**
     * Generate a unique session ID for grouping scans
     */
    static generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
