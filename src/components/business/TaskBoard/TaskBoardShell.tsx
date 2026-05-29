"use client";

import { useCallback, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layout,
  Calendar,
  Clock,
  Plus,
  Settings,
  Search,
  Columns3,
} from "lucide-react";
import type {
  TaskboardBoard,
  TaskboardCard,
  TaskboardColumn,
} from "@/types/taskboard";
import { TaskboardBoardsService } from "@/services/taskboard/boards";

type Props = {
  boards: TaskboardBoard[];
  activeBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  workspaceId: string;
  children: React.ReactNode;
  cards: TaskboardCard[];
  columns: TaskboardColumn[];
  onSearchOpen: () => void;
};

const VIEW_OPTIONS = [
  { id: "kanban", icon: Columns3, label: "Kanban" },
  { id: "calendar", icon: Calendar, label: "Calendario" },
  { id: "timeline", icon: Clock, label: "Timeline" },
] as const;

export default function TaskBoardShell({
  boards,
  activeBoardId,
  onSelectBoard,
  workspaceId,
  children,
  cards,
  columns,
  onSearchOpen,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [creating, setCreating] = useState(false);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || null;
  const activeView = (activeBoard?.view as "kanban" | "calendar" | "timeline") || "kanban";

  const handleCreateBoard = useCallback(async () => {
    const name = prompt("Nombre del nuevo tablero:");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      await TaskboardBoardsService.createBoard(workspaceId, {
        name: name.trim(),
      });
    } catch {}
    setCreating(false);
  }, [workspaceId]);

  const handleChangeView = useCallback(
    (view: string) => {
      if (activeBoardId) {
        TaskboardBoardsService.updateBoard(workspaceId, activeBoardId, {
          view: view as TaskboardBoard["view"],
        });
      }
    },
    [workspaceId, activeBoardId],
  );

  const displayCards = cards.length;

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0">
      {sidebarOpen && (
        <aside className="w-56 shrink-0 border-r border-white/10 flex flex-col bg-[#0a0f18]">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Tableros
              </h2>
              <button
                onClick={handleCreateBoard}
                disabled={creating}
                className="h-6 w-6 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => onSelectBoard(board.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  board.id === activeBoardId
                    ? "bg-cyan-500/15 text-cyan-300 font-medium"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                <Layout className="w-4 h-4 shrink-0" />
                <span className="truncate">{board.name}</span>
              </button>
            ))}
          </nav>

          <div className="p-3 border-t border-white/10">
            <div className="flex items-center justify-between text-[11px] text-white/25">
              <span>{boards.length} tablero(s)</span>
              <span>{displayCards} tarjeta(s)</span>
            </div>
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {activeBoard && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <h1 className="text-sm font-semibold text-white/80">
                  {activeBoard.name}
                </h1>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleChangeView(opt.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                    activeView === opt.id
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <opt.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={onSearchOpen}
              data-search-trigger
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/5 border border-white/10 transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="px-1 py-0.5 bg-white/5 rounded text-[10px] text-white/20 hidden sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
