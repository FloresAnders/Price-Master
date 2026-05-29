import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { TaskboardBoard } from "@/types/taskboard";
import { buildWorkspaceBoardsPath } from "./firestore-paths";

const nowIso = () => new Date().toISOString();

export const TaskboardBoardsService = {
  listenBoards(
    workspaceId: string,
    callback: (boards: TaskboardBoard[]) => void,
  ): Unsubscribe {
    const colRef = collection(db, buildWorkspaceBoardsPath(workspaceId));
    const q = query(colRef, orderBy("updatedAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const boards = snap.docs.map((docSnap) => {
          const data = docSnap.data() as TaskboardBoard;
          return { ...data, id: docSnap.id };
        });
        callback(boards);
      },
      (error) => {
        console.error("Boards onSnapshot error:", error);
      },
    );
  },

  async createBoard(
    workspaceId: string,
    payload: Pick<TaskboardBoard, "name" | "description">,
  ) {
    const colRef = collection(db, buildWorkspaceBoardsPath(workspaceId));
    const now = nowIso();
    const docRef = await addDoc(colRef, {
      workspaceId,
      name: payload.name,
      description: payload.description || "",
      view: "kanban",
      createdAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
    return docRef.id;
  },

  async ensureDefaultBoard(workspaceId: string) {
    const defaultId = "default";
    const docRef = doc(db, buildWorkspaceBoardsPath(workspaceId), defaultId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return defaultId;
    const now = nowIso();
    await setDoc(docRef, {
      id: defaultId,
      workspaceId,
      name: "Tablero Principal",
      description: "Flujo central del equipo",
      view: "kanban",
      createdAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
    return defaultId;
  },

  async updateBoard(
    workspaceId: string,
    boardId: string,
    updates: Partial<TaskboardBoard>,
  ) {
    const docRef = doc(db, buildWorkspaceBoardsPath(workspaceId), boardId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: nowIso(),
      updatedAtServer: serverTimestamp(),
    });
  },
};
