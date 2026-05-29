import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { TaskboardComment } from "@/types/taskboard";
import { buildCardCommentsPath } from "./firestore-paths";

const nowIso = () => new Date().toISOString();

export const TaskboardCommentsService = {
  listenComments(
    workspaceId: string,
    boardId: string,
    cardId: string,
    callback: (comments: TaskboardComment[]) => void,
  ): Unsubscribe {
    const colRef = collection(
      db,
      buildCardCommentsPath(workspaceId, boardId, cardId),
    );
    const q = query(colRef, orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      const comments = snap.docs.map((docSnap) => ({
        ...(docSnap.data() as TaskboardComment),
        id: docSnap.id,
      }));
      callback(comments);
    });
  },

  async addComment(
    workspaceId: string,
    boardId: string,
    cardId: string,
    text: string,
    authorId: string,
  ) {
    const colRef = collection(
      db,
      buildCardCommentsPath(workspaceId, boardId, cardId),
    );
    const now = nowIso();
    await addDoc(colRef, {
      text,
      authorId,
      createdAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
  },
};
