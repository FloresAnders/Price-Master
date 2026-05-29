import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import type { TaskboardActivity } from "@/types/taskboard";
import { buildCardActivityPath } from "./firestore-paths";

const nowIso = () => new Date().toISOString();

export const TaskboardActivityService = {
  async addActivity(
    workspaceId: string,
    boardId: string,
    cardId: string,
    activity: Omit<TaskboardActivity, "id">,
  ) {
    const colRef = collection(
      db,
      buildCardActivityPath(workspaceId, boardId, cardId),
    );
    const now = nowIso();
    await addDoc(colRef, {
      ...activity,
      createdAt: activity.createdAt || now,
      updatedAtServer: serverTimestamp(),
    });
  },
};
