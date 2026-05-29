"use client";

import { useCallback, useMemo, useState } from "react";
import type { TaskboardCard } from "@/types/taskboard";
import { useWorkspace } from "@/hooks/taskboard/useWorkspace";
import { useBoardRealtime } from "@/hooks/taskboard/useBoardRealtime";
import { TaskboardBoardsService } from "@/services/taskboard/boards";
import TaskBoardShell from "./TaskBoardShell";
import KanbanView from "./KanbanView";
import CalendarView from "./CalendarView";
import TimelineView from "./TimelineView";
import SearchCommand from "./SearchCommand";
import EmptyState from "./EmptyState";

export default function TaskBoard() {
  const {
    workspace,
    boards,
    activeBoardId,
    setActiveBoardId,
    ownerId,
    loading: wsLoading,
    error: wsError,
  } = useWorkspace();

  const boardData = useBoardRealtime(
    workspace?.id || ownerId || null,
    activeBoardId,
  );

  const [searchOpen, setSearchOpen] = useState(false);

  const handleCreateBoard = useCallback(async () => {
    const name = prompt("Nombre del nuevo tablero:");
    if (!name?.trim()) return;
    const wsId = workspace?.id || ownerId;
    if (!wsId) return;
    try {
      const boardId = await TaskboardBoardsService.createBoard(wsId, {
        name: name.trim(),
      });
      setActiveBoardId(boardId);
    } catch {}
  }, [workspace?.id, ownerId, setActiveBoardId]);

  const handleSelectBoard = useCallback(
    (boardId: string) => {
      setActiveBoardId(boardId);
    },
    [setActiveBoardId],
  );

  const handleSelectCard = useCallback(
    (card: TaskboardCard) => {
      const columnEl = document.querySelector(
        `[data-card-id="${card.id}"]`,
      );
      if (columnEl) {
        columnEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setSearchOpen(false);
    },
    [],
  );

  if (wsLoading && !workspace) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-sm text-white/40">Cargando workspace...</p>
        </div>
      </div>
    );
  }

  if (wsError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-2">Error al cargar</p>
          <p className="text-xs text-white/30">{wsError}</p>
        </div>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <EmptyState onCreateBoard={handleCreateBoard} />
      </div>
    );
  }

  const wsId = workspace?.id || ownerId || "";

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const activeView: "kanban" | "calendar" | "timeline" =
    (activeBoard?.view as "kanban" | "calendar" | "timeline") || "kanban";

  return (
    <>
      <TaskBoardShell
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={handleSelectBoard}
        workspaceId={wsId}
        cards={boardData.cards}
        columns={boardData.columns}
        onSearchOpen={() => setSearchOpen(true)}
      >
        {activeView === "kanban" && (
          <KanbanView
            workspaceId={wsId}
            boardId={activeBoardId || ""}
            columns={boardData.columns}
            cards={boardData.cards}
            loading={boardData.loading}
          />
        )}
        {activeView === "calendar" && <CalendarView />}
        {activeView === "timeline" && <TimelineView />}
      </TaskBoardShell>

      <SearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        cards={boardData.cards}
        columns={boardData.columns}
        onSelectCard={handleSelectCard}
      />
    </>
  );
}
