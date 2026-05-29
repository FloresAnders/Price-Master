import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import type { TaskboardAttachment } from "@/types/taskboard";
import { buildCardAttachmentsPath } from "./firestore-paths";

const nowIso = () => new Date().toISOString();

export const TaskboardAttachmentsService = {
  async addAttachment(
    workspaceId: string,
    boardId: string,
    cardId: string,
    payload: Omit<TaskboardAttachment, "id">,
  ) {
    const colRef = collection(
      db,
      buildCardAttachmentsPath(workspaceId, boardId, cardId),
    );
    const now = nowIso();
    await addDoc(colRef, {
      ...payload,
      createdAt: payload.createdAt || now,
      updatedAtServer: serverTimestamp(),
    });
  },
};
