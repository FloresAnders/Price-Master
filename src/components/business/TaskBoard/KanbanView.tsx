"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type {
  TaskboardCard,
  TaskboardColumn as TColumn,
  TaskboardColumnWithCards,
} from "@/types/taskboard";
import { useDnD } from "@/hooks/taskboard/useDnD";
import { useShortcuts } from "@/hooks/taskboard/useShortcuts";
import { TaskboardColumnsService } from "@/services/taskboard/columns";
import { TaskboardCardsService } from "@/services/taskboard/cards";
import { generateOrderKeyBetween } from "@/utils/orderKey";
import SortableColumn from "./SortableColumn";
import TaskCard from "./Card";
import CardDetailDrawer from "./CardDetailDrawer";

type Props = {
  workspaceId: string;
  boardId: string;
  columns: TColumn[];
  cards: TaskboardCard[];
  loading: boolean;
};

export default function KanbanView({
  workspaceId,
  boardId,
  columns: initialColumns,
  cards: initialCards,
  loading,
}: Props) {
  const [localColumns, setLocalColumns] = useState<TColumn[]>(initialColumns);
  const [localCards, setLocalCards] = useState<TaskboardCard[]>(initialCards);
  const [selectedCard, setSelectedCard] = useState<TaskboardCard | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  useEffect(() => {
    setLocalColumns(initialColumns);
  }, [initialColumns]);

  useEffect(() => {
    setLocalCards(initialCards);
  }, [initialCards]);

  const grouped = useMemo(() => {
    const cardMap = new Map<string, TaskboardCard[]>();
    localCards.forEach((card) => {
      const list = cardMap.get(card.columnId) || [];
      list.push(card);
      cardMap.set(card.columnId, list);
    });
    return localColumns.map((col) => ({
      ...col,
      cards: cardMap.get(col.id) || [],
    }));
  }, [localColumns, localCards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const { handleDragEnd } = useDnD({
    workspaceId,
    boardId,
    columns: localColumns,
    cards: localCards,
    setColumns: setLocalColumns,
    setCards: setLocalCards,
  });

  const handleAddColumn = useCallback(async () => {
    const name = prompt("Nombre de la nueva columna:");
    if (!name?.trim()) return;
      try {
        const orderKey = generateOrderKeyBetween(
          localColumns[localColumns.length - 1]?.orderKey,
        );
        await TaskboardColumnsService.createColumn(
          workspaceId,
          boardId,
          name.trim(),
          orderKey,
        );
      } catch (e) {
        console.error("Error creating column:", e);
      }
    }, [workspaceId, boardId, localColumns]);

  const handleAddCard = useCallback(
    async (columnId: string) => {
      const title = prompt("Título de la tarjeta:");
      if (!title?.trim()) return;
      const colCards = localCards
        .filter((c) => c.columnId === columnId)
        .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
      const orderKey = generateOrderKeyBetween(
        colCards[colCards.length - 1]?.orderKey,
      );
      try {
        await TaskboardCardsService.createCard(workspaceId, boardId, {
          title: title.trim(),
          columnId,
          orderKey,
        });
      } catch (e) {
        console.error("Error creating card:", e);
      }
    },
    [workspaceId, boardId, localCards],
  );

  const activeDragIdRef = useRef(activeDragId);
  activeDragIdRef.current = activeDragId;
  const handleDragEndRef = useRef(handleDragEnd);
  handleDragEndRef.current = handleDragEnd;

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      if (activeDragIdRef.current?.startsWith("column-")) {
        const filteredContainers = args.droppableContainers.filter(
          (c) => String(c.id).startsWith("column-"),
        );
        return closestCorners({
          ...args,
          droppableContainers: filteredContainers,
        });
      }
      if (activeDragIdRef.current) {
        const filteredContainers = args.droppableContainers.filter(
          (c) => !String(c.id).startsWith("column-"),
        );
        return closestCorners({
          ...args,
          droppableContainers: filteredContainers,
        });
      }
      return closestCorners(args);
    },
    [],
  );

  const stableOnDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    setHoveredCardId(null);
  }, []);

  const stableOnDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null;
    if (activeDragIdRef.current?.startsWith("column-")) {
      setHoveredCardId(null);
      return;
    }
    setHoveredCardId(overId && !overId.startsWith("column-") ? overId : null);
  }, []);

  const stableOnDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    setHoveredCardId(null);
    handleDragEndRef.current(event);
  }, []);

  const stableOnDragCancel = useCallback(() => {
    setActiveDragId(null);
    setHoveredCardId(null);
  }, []);

  const handleCardClick = useCallback((card: TaskboardCard) => {
    setSelectedCard(card);
    setDrawerOpen(true);
  }, []);

  const handleUpdateCard = useCallback(
    (cardId: string, updates: Partial<TaskboardCard>) => {
      TaskboardCardsService.updateCard(workspaceId, boardId, cardId, updates);
    },
    [workspaceId, boardId],
  );

  const activeCard = activeDragId && !activeDragId.startsWith("column-")
    ? localCards.find((c) => c.id === activeDragId)
    : null;

  const shortcuts = useMemo(
    () => ({
      "/": () => {
        document.querySelector<HTMLButtonElement>("[data-search-trigger]")?.click();
      },
      "n": () => {
        if (localColumns.length > 0) {
          handleAddCard(localColumns[0].id);
        }
      },
      "c": () => {
        handleAddColumn();
      },
    }),
    [localColumns, handleAddCard, handleAddColumn],
  );

  useShortcuts(shortcuts);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-[280px] sm:w-[300px] shrink-0 space-y-3">
            <div className="h-5 w-24 bg-white/5 rounded animate-pulse" />
            {[1, 2].map((j) => (
              <div key={j} className="h-24 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span className="font-mono">n</span> nueva tarjeta
          <span className="text-white/10">|</span>
          <span className="font-mono">c</span> nueva columna
          <span className="text-white/10">|</span>
          <span className="font-mono">/</span> buscar
        </div>
        <button
          onClick={handleAddColumn}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Columna
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={stableOnDragStart}
        onDragOver={stableOnDragOver}
        onDragEnd={stableOnDragEnd}
        onDragCancel={stableOnDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full min-h-[calc(100vh-280px)]">
          <SortableContext
            items={localColumns.map((c) => `column-${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {grouped.map((col) => (
              <SortableColumn
                key={col.id}
                column={col}
                cards={col.cards}
                onCardClick={handleCardClick}
                onAddCard={handleAddCard}
                hoveredCardId={hoveredCardId}
              />
            ))}
          </SortableContext>

          <div className="flex-shrink-0 w-10 flex items-start pt-9">
            <button
              onClick={handleAddColumn}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-dashed border-white/20 text-white/30 hover:text-white/60 hover:border-white/40 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="w-[280px] sm:w-[300px] rotate-3 opacity-90">
              <TaskCard card={activeCard} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CardDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        card={selectedCard}
        workspaceId={workspaceId}
        boardId={boardId}
        onUpdate={handleUpdateCard}
      />
    </>
  );
}
