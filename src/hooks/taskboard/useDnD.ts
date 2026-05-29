"use client";

import { useCallback } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { TaskboardColumn, TaskboardCard } from "@/types/taskboard";
import { generateOrderKeyBetween } from "@/utils/orderKey";
import { TaskboardColumnsService } from "@/services/taskboard/columns";
import { TaskboardCardsService } from "@/services/taskboard/cards";

type UseDnDProps = {
  workspaceId: string | null;
  boardId: string | null;
  columns: TaskboardColumn[];
  cards: TaskboardCard[];
  setColumns: (cols: TaskboardColumn[]) => void;
  setCards: (cards: TaskboardCard[]) => void;
};

export function useDnD({
  workspaceId,
  boardId,
  columns,
  cards,
  setColumns,
  setCards,
}: UseDnDProps) {
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !active.id || !over.id || active.id === over.id) return;

      const activeStr = String(active.id);
      const overStr = String(over.id);

      if (!workspaceId || !boardId) return;

      const isColumn = activeStr.startsWith("column-");

      if (isColumn) {
        const oldIndex = columns.findIndex((c) => c.id === activeStr.replace("column-", ""));
        const newIndex = columns.findIndex((c) => c.id === overStr.replace("column-", ""));
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(columns, oldIndex, newIndex);
        setColumns(reordered);

        const updates = reordered.map((col, idx) => ({
          id: col.id,
          orderKey: generateOrderKeyBetween(
            reordered[idx - 1]?.orderKey,
            reordered[idx + 1]?.orderKey,
          ),
        }));
        TaskboardColumnsService.updateColumnOrder(workspaceId, boardId, updates);
        return;
      }

      const activeCard = cards.find((c) => c.id === activeStr);
      const overCard = cards.find((c) => c.id === overStr);
      if (!activeCard) return;

      const activeColId = activeCard.columnId;
      let targetColId = activeColId;

      const overColumn = columns.find((c) => c.id === overStr);
      if (overColumn) {
        targetColId = overColumn.id;
        const colCards = cards
          .filter((c) => c.columnId === targetColId)
          .sort((a, b) => a.orderKey.localeCompare(b.orderKey));

        const newOrder = [activeCard, ...colCards.filter((c) => c.id !== activeStr)];
        const updates = newOrder.map((c, i) => ({
          id: c.id,
          orderKey: generateOrderKeyBetween(
            newOrder[i - 1]?.orderKey,
            newOrder[i + 1]?.orderKey,
          ),
          columnId: targetColId,
        }));
        setCards(
          cards.map((c) => {
            const upd = updates.find((u) => u.id === c.id);
            return upd
              ? { ...c, orderKey: upd.orderKey, columnId: upd.columnId || c.columnId }
              : c;
          }),
        );
        TaskboardCardsService.updateCardsOrder(workspaceId, boardId, updates);
        return;
      }

      if (!overCard) return;
      if (activeColId === overCard.columnId) {
        const colCards = cards
          .filter((c) => c.columnId === activeColId)
          .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
        const oldIdx = colCards.findIndex((c) => c.id === activeStr);
        const newIdx = colCards.findIndex((c) => c.id === overStr);
        if (oldIdx === -1 || newIdx === -1) return;

        const reordered = arrayMove(colCards, oldIdx, newIdx);
        const updates = reordered.map((c, i) => ({
          id: c.id,
          orderKey: generateOrderKeyBetween(
            reordered[i - 1]?.orderKey,
            reordered[i + 1]?.orderKey,
          ),
          columnId: activeColId,
        }));
        setCards(
          cards.map((c) => {
            const upd = updates.find((u) => u.id === c.id);
            return upd
              ? { ...c, orderKey: upd.orderKey, columnId: upd.columnId || c.columnId }
              : c;
          }),
        );
        TaskboardCardsService.updateCardsOrder(workspaceId, boardId, updates);
        return;
      }

      targetColId = overCard.columnId;
      const activeCardUpdated = { ...activeCard, columnId: targetColId };

      const sourceCards = cards
        .filter((c) => c.columnId === activeColId && c.id !== activeStr);

      const targetCards = cards
        .filter((c) => c.columnId === targetColId)
        .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
      const overIdx = targetCards.findIndex((c) => c.id === overStr);
      const insertAt = overIdx >= 0 ? overIdx : targetCards.length;
      targetCards.splice(insertAt, 0, activeCardUpdated);

      setCards(
        cards.map((c) => (c.id === activeStr ? activeCardUpdated : c)),
      );

      const sourceUpdates = sourceCards.map((c, i, arr) => ({
        id: c.id,
        orderKey: generateOrderKeyBetween(arr[i - 1]?.orderKey, arr[i + 1]?.orderKey),
        columnId: c.columnId,
      }));
      const targetUpdates = targetCards.map((c, i, arr) => ({
        id: c.id,
        orderKey: generateOrderKeyBetween(arr[i - 1]?.orderKey, arr[i + 1]?.orderKey),
        columnId: targetColId,
      }));

      TaskboardCardsService.updateCardsOrder(workspaceId, boardId, [
        ...sourceUpdates,
        ...targetUpdates,
      ]);
    },
    [workspaceId, boardId, columns, cards, setColumns, setCards],
  );

  return { handleDragEnd };
}
