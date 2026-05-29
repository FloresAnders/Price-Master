"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { TaskboardBoard, TaskboardMember, TaskboardWorkspace } from "@/types/taskboard";
import { TaskboardWorkspacesService } from "@/services/taskboard/workspaces";
import { TaskboardBoardsService } from "@/services/taskboard/boards";

type WorkspaceState = {
  workspace: TaskboardWorkspace | null;
  members: TaskboardMember[];
  boards: TaskboardBoard[];
  activeBoardId: string | null;
  loading: boolean;
  error: string | null;
};

export function useWorkspace() {
  const { user } = useAuth();
  const [state, setState] = useState<WorkspaceState>({
    workspace: null,
    members: [],
    boards: [],
    activeBoardId: null,
    loading: true,
    error: null,
  });

  const ownerId = useMemo(() => {
    const fallback = user?.id || "";
    return (user?.ownerId || fallback).trim();
  }, [user?.id, user?.ownerId]);

  const workspaceName = useMemo(() => {
    const candidate = user?.ownercompanie || user?.name || "Workspace";
    return candidate.trim() || "Workspace";
  }, [user?.ownercompanie, user?.name]);

  useEffect(() => {
    if (!ownerId) {
      setState((prev) => ({
        ...prev,
        workspace: null,
        members: [],
        boards: [],
        activeBoardId: null,
        loading: false,
        error: null,
      }));
      return;
    }

    let workspaceUnsub = () => {};
    let membersUnsub = () => {};
    let boardsUnsub = () => {};

    setState((prev) => ({ ...prev, loading: true, error: null }));

    TaskboardWorkspacesService.ensureWorkspace(ownerId, workspaceName)
      .then(async (workspaceId) => {
        await TaskboardWorkspacesService.ensureOwnerMember(
          workspaceId,
          user?.id || workspaceId,
          user?.role === "superadmin" ? "owner" : "admin",
        );

        workspaceUnsub = TaskboardWorkspacesService.listenWorkspace(
          workspaceId,
          (workspace) => {
            setState((prev) => ({
              ...prev,
              workspace,
              loading: false,
            }));
          },
        );

        membersUnsub = TaskboardWorkspacesService.listenMembers(
          workspaceId,
          (members) => {
            setState((prev) => ({ ...prev, members }));
          },
        );

        boardsUnsub = TaskboardBoardsService.listenBoards(
          workspaceId,
          (boards) => {
            setState((prev) => {
              const activeBoardId =
                prev.activeBoardId && boards.some((b) => b.id === prev.activeBoardId)
                  ? prev.activeBoardId
                  : boards[0]?.id || null;
              return { ...prev, boards, activeBoardId };
            });
          },
        );
      })
      .catch((error) => {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Error cargando workspace",
          loading: false,
        }));
      });

    return () => {
      workspaceUnsub();
      membersUnsub();
      boardsUnsub();
    };
  }, [ownerId, user?.id, user?.role, workspaceName]);

  return {
    ...state,
    ownerId,
    workspaceName,
    setActiveBoardId: (boardId: string) =>
      setState((prev) => ({ ...prev, activeBoardId: boardId })),
  };
}
