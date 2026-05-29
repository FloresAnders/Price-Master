"use client";

import { useEffect, useState } from "react";
import type {
  TaskboardCard,
  TaskboardColumn,
  TaskboardColumnWithCards,
} from "@/types/taskboard";
import { TaskboardColumnsService } from "@/services/taskboard/columns";
import { TaskboardCardsService } from "@/services/taskboard/cards";

type BoardState = {
  columns: TaskboardColumn[];
  cards: TaskboardCard[];
  grouped: TaskboardColumnWithCards[];
  loading: boolean;
  error: string | null;
};

export function useBoardRealtime(
  workspaceId: string | null,
  boardId: string | null,
) {
  const [state, setState] = useState<BoardState>({
    columns: [],
    cards: [],
    grouped: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!workspaceId || !boardId) {
      setState({
        columns: [],
        cards: [],
        grouped: [],
        loading: false,
        error: null,
      });
      return;
    }

    let columnsUnsub = () => {};
    let cardsUnsub = () => {};

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      columnsUnsub = TaskboardColumnsService.listenColumns(
        workspaceId,
        boardId,
        (columns) => {
          setState((prev) => {
            const sorted = columns;
            const grouped = buildGrouped(sorted, prev.cards);
            return {
              ...prev,
              columns: sorted,
              grouped,
              loading: false,
            };
          });
        },
      );

      cardsUnsub = TaskboardCardsService.listenCards(
        workspaceId,
        boardId,
        (cards) => {
          setState((prev) => {
            const grouped = buildGrouped(prev.columns, cards);
            return {
              ...prev,
              cards,
              grouped,
              loading: false,
            };
          });
        },
      );
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Error loading board",
        loading: false,
      }));
    }

    return () => {
      columnsUnsub();
      cardsUnsub();
    };
  }, [workspaceId, boardId]);

  return state;
}

function buildGrouped(
  columns: TaskboardColumn[],
  cards: TaskboardCard[],
): TaskboardColumnWithCards[] {
  const cardMap = new Map<string, TaskboardCard[]>();
  cards.forEach((card) => {
    const list = cardMap.get(card.columnId) || [];
    list.push(card);
    cardMap.set(card.columnId, list);
  });

  return columns.map((col) => ({
    ...col,
    cards: cardMap.get(col.id) || [],
  }));
}
