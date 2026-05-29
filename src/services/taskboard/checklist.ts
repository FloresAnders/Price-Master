import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { TaskboardChecklistItem } from "@/types/taskboard";
import { buildCardChecklistPath } from "./firestore-paths";

const nowIso = () => new Date().toISOString();

export const TaskboardChecklistService = {
  listenChecklist(
    workspaceId: string,
    boardId: string,
    cardId: string,
    callback: (items: TaskboardChecklistItem[]) => void,
  ): Unsubscribe {
    const colRef = collection(
      db,
      buildCardChecklistPath(workspaceId, boardId, cardId),
    );
    const q = query(colRef, orderBy("orderKey", "asc"));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((docSnap) => ({
        ...(docSnap.data() as TaskboardChecklistItem),
        id: docSnap.id,
      }));
      callback(items);
    });
  },

  async addItem(
    workspaceId: string,
    boardId: string,
    cardId: string,
    text: string,
    orderKey: string,
  ) {
    const colRef = collection(
      db,
      buildCardChecklistPath(workspaceId, boardId, cardId),
    );
    const now = nowIso();
    await addDoc(colRef, {
      text,
      done: false,
      orderKey,
      createdAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
  },

  async toggleItem(
    workspaceId: string,
    boardId: string,
    cardId: string,
    itemId: string,
    done: boolean,
  ) {
    const docRef = doc(
      db,
      buildCardChecklistPath(workspaceId, boardId, cardId),
      itemId,
    );
    await updateDoc(docRef, {
      done,
      updatedAt: nowIso(),
      updatedAtServer: serverTimestamp(),
    });
  },
};
