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
import type { TaskboardCard } from "@/types/taskboard";
import { buildBoardCardsPath } from "./firestore-paths";

const nowIso = () => new Date().toISOString();

export const TaskboardCardsService = {
  listenCards(
    workspaceId: string,
    boardId: string,
    callback: (cards: TaskboardCard[]) => void,
  ): Unsubscribe {
    const colRef = collection(db, buildBoardCardsPath(workspaceId, boardId));
    const q = query(colRef, orderBy("orderKey", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        const cards = snap.docs.map((docSnap) => {
          const data = docSnap.data() as TaskboardCard;
          return { ...data, id: docSnap.id };
        });
        callback(cards);
      },
      (error) => {
        console.error("Cards onSnapshot error:", error);
      },
    );
  },

  async createCard(
    workspaceId: string,
    boardId: string,
    payload: Pick<TaskboardCard, "title" | "columnId" | "orderKey"> &
      Partial<TaskboardCard>,
  ) {
    const colRef = collection(db, buildBoardCardsPath(workspaceId, boardId));
    const now = nowIso();
    const docRef = await addDoc(colRef, {
      boardId,
      columnId: payload.columnId,
      title: payload.title,
      description: payload.description || "",
      labels: payload.labels || [],
      priority: payload.priority || "medium",
      dueDate: payload.dueDate ?? null,
      assignees: payload.assignees || [],
      orderKey: payload.orderKey,
      checklistDoneCount: payload.checklistDoneCount || 0,
      checklistTotalCount: payload.checklistTotalCount || 0,
      commentsCount: payload.commentsCount || 0,
      attachmentsCount: payload.attachmentsCount || 0,
      createdAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateCard(
    workspaceId: string,
    boardId: string,
    cardId: string,
    updates: Partial<TaskboardCard>,
  ) {
    const docRef = doc(db, buildBoardCardsPath(workspaceId, boardId), cardId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: nowIso(),
      updatedAtServer: serverTimestamp(),
    });
  },

  async updateCardsOrder(
    workspaceId: string,
    boardId: string,
    updates: Array<{ id: string; orderKey: string; columnId?: string }>,
  ) {
    const batch = writeBatch(db);
    updates.forEach((item) => {
      const docRef = doc(
        db,
        buildBoardCardsPath(workspaceId, boardId),
        item.id,
      );
      batch.update(docRef, {
        orderKey: item.orderKey,
        ...(item.columnId ? { columnId: item.columnId } : {}),
        updatedAt: nowIso(),
        updatedAtServer: serverTimestamp(),
      });
    });
    await batch.commit();
  },
};
