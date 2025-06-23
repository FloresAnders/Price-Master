import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where, orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';

export class FirestoreService {
  /**
 * Get all documents from a collection
 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getAll(collectionName: string): Promise<any[]> {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }
  /**
   * Get a single document by ID
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getById(collectionName: string, id: string): Promise<any | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error getting document ${id} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Add a new document to a collection
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async add(collectionName: string, data: any): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, collectionName), data);
      return docRef.id;
    } catch (error) {
      console.error(`Error adding document to ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update a document by ID
   */  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async update(collectionName: string, id: string, data: any): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error(`Error updating document ${id} in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document by ID
   */
  static async delete(collectionName: string, id: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document ${id} from ${collectionName}:`, error);
      throw error;
    }
  }  /**
   * Query documents with conditions
   */
  static async query(
    collectionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions: Array<{ field: string; operator: any; value: any }> = [],
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'asc',
    limitCount?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    try {
      // eslint-disable-next-line prefer-const
      let q = collection(db, collectionName);

      // Apply where conditions
      const constraints = [];
      conditions.forEach(condition => {
        constraints.push(where(condition.field, condition.operator, condition.value));
      });

      // Apply order by
      if (orderByField) {
        constraints.push(orderBy(orderByField, orderDirection));
      }

      // Apply limit
      if (limitCount) {
        constraints.push(limit(limitCount));
      }

      const queryRef = query(q, ...constraints);
      const querySnapshot = await getDocs(queryRef);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Check if a document exists
   */
  static async exists(collectionName: string, id: string): Promise<boolean> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error(`Error checking if document ${id} exists in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get documents count in a collection
   */
  static async count(collectionName: string): Promise<number> {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      return snapshot.size;
    } catch (error) {
      console.error(`Error counting documents in ${collectionName}:`, error);
      throw error;
    }
  }
}
