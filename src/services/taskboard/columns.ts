import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { TaskboardColumn } from "@/types/taskboard";
import { buildBoardColumnsPath } from "./firestore-paths";

const nowIso = () => new Date().toISOString();

export const TaskboardColumnsService = {
  listenColumns(
    workspaceId: string,
    boardId: string,
    callback: (columns: TaskboardColumn[]) => void,
  ): Unsubscribe {
    const colRef = collection(db, buildBoardColumnsPath(workspaceId, boardId));
    const q = query(colRef, orderBy("orderKey", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        const columns = snap.docs.map((docSnap) => {
          const data = docSnap.data() as TaskboardColumn;
          return { ...data, id: docSnap.id };
        });
        callback(columns);
      },
      (error) => {
        console.error("Columns onSnapshot error:", error);
      },
    );
  },

  async createColumn(
    workspaceId: string,
    boardId: string,
    title: string,
    orderKey: string,
  ) {
    const colRef = collection(db, buildBoardColumnsPath(workspaceId, boardId));
    const now = nowIso();
    const docRef = await addDoc(colRef, {
      boardId,
      title,
      orderKey,
      createdAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateColumn(
    workspaceId: string,
    boardId: string,
    columnId: string,
    updates: Partial<TaskboardColumn>,
  ) {
    const docRef = doc(
      db,
      buildBoardColumnsPath(workspaceId, boardId),
      columnId,
    );
    await updateDoc(docRef, {
      ...updates,
      updatedAt: nowIso(),
      updatedAtServer: serverTimestamp(),
    });
  },

  async updateColumnOrder(
    workspaceId: string,
    boardId: string,
    updates: Array<{ id: string; orderKey: string }>,
  ) {
    const batch = writeBatch(db);
    updates.forEach((item) => {
      const docRef = doc(
        db,
        buildBoardColumnsPath(workspaceId, boardId),
        item.id,
      );
      batch.update(docRef, {
        orderKey: item.orderKey,
        updatedAt: nowIso(),
        updatedAtServer: serverTimestamp(),
      });
    });
    await batch.commit();
  },
};
