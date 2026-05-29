import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { TaskboardMember, TaskboardWorkspace } from "@/types/taskboard";
import {
  buildWorkspaceDocPath,
  buildWorkspaceMembersPath,
} from "./firestore-paths";

const serializeTimestamp = () => new Date().toISOString();

export const TaskboardWorkspacesService = {
  async ensureWorkspace(ownerId: string, name: string) {
    const workspaceId = ownerId.trim();
    const docRef = doc(db, buildWorkspaceDocPath(workspaceId));
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      const now = serializeTimestamp();
      await setDoc(
        docRef,
        {
          id: workspaceId,
          ownerId: workspaceId,
          name,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    return workspaceId;
  },

  listenWorkspace(
    workspaceId: string,
    callback: (workspace: TaskboardWorkspace | null) => void,
  ): Unsubscribe {
    const docRef = doc(db, buildWorkspaceDocPath(workspaceId));
    return onSnapshot(docRef, (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const data = snap.data() as TaskboardWorkspace;
      callback({ ...data, id: snap.id });
    });
  },

  listenMembers(
    workspaceId: string,
    callback: (members: TaskboardMember[]) => void,
  ): Unsubscribe {
    const colRef = collection(db, buildWorkspaceMembersPath(workspaceId));
    return onSnapshot(colRef, (snap) => {
      const data = snap.docs.map((docSnap) => ({
        ...(docSnap.data() as TaskboardMember),
        id: docSnap.id,
      }));
      callback(data);
    });
  },

  async ensureOwnerMember(
    workspaceId: string,
    userId: string,
    role: TaskboardMember["role"] = "owner",
  ) {
    const memberRef = doc(
      db,
      buildWorkspaceMembersPath(workspaceId),
      userId,
    );
    await setDoc(
      memberRef,
      {
        id: userId,
        role,
        status: "active",
        joinedAt: serializeTimestamp(),
        updatedAt: serializeTimestamp(),
        updatedAtServer: serverTimestamp(),
      },
      { merge: true },
    );
  },
};
