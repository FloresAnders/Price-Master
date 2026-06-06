import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { stripUndefinedDeep } from "@/utils/firestore-utils";

export class FirestoreService {
  static async getAll(
    collectionName: string,
    limitCount?: number,
  ): Promise<any[]> {
    try {
      const colRef = collection(db, collectionName);
      const querySnapshot =
        typeof limitCount === "number" && Number.isFinite(limitCount)
          ? await getDocs(
              query(colRef, limit(Math.max(1, Math.trunc(limitCount)))),
            )
          : await getDocs(colRef);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }

  static async getById(
    collectionName: string,
    id: string,
  ): Promise<any | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error(
        `Error getting document ${id} from ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  static async add(collectionName: string, data: any): Promise<string> {
    try {
      const safeData = stripUndefinedDeep(data);
      const docRef = await addDoc(
        collection(db, collectionName),
        safeData as any,
      );
      return docRef.id;
    } catch (error) {
      console.error(`Error adding document to ${collectionName}:`, error);
      throw error;
    }
  }

  static async addWithId(
    collectionName: string,
    id: string,
    data: any,
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      const safeData = stripUndefinedDeep(data);
      await setDoc(docRef, safeData as any);
    } catch (error) {
      console.error(`Error adding document ${id} to ${collectionName}:`, error);
      throw error;
    }
  }

  static async update(
    collectionName: string,
    id: string,
    data: any,
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      const safeData = stripUndefinedDeep(data);
      await updateDoc(docRef, safeData as any);
    } catch (error) {
      console.error(
        `Error updating document ${id} in ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  static async delete(collectionName: string, id: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(
        `Error deleting document ${id} from ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  static async query(
    collectionName: string,
    conditions: Array<{ field: string; operator: any; value: any }> = [],
    orderByField?: string,
    orderDirection: "asc" | "desc" = "asc",
    limitCount?: number,
  ): Promise<any[]> {
    try {
      const constraints: any[] = [];

      conditions.forEach((condition) => {
        constraints.push(
          where(condition.field, condition.operator, condition.value),
        );
      });

      if (orderByField) {
        constraints.push(orderBy(orderByField, orderDirection));
      }

      if (limitCount) {
        constraints.push(limit(limitCount));
      }

      const queryRef = query(collection(db, collectionName), ...constraints);
      const querySnapshot = await getDocs(queryRef);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  }

  static async exists(collectionName: string, id: string): Promise<boolean> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error(
        `Error checking if document ${id} exists in ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  static async count(collectionName: string): Promise<number> {
    try {
      const snapshot = await getCountFromServer(collection(db, collectionName));
      return snapshot.data().count;
    } catch (error) {
      console.error(`Error counting documents in ${collectionName}:`, error);
      throw error;
    }
  }
}
