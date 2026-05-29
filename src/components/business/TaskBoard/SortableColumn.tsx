"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskboardCard, TaskboardColumn as TColumn } from "@/types/taskboard";
import Column from "./Column";

type Props = {
  column: TColumn;
  cards: TaskboardCard[];
  onCardClick: (card: TaskboardCard) => void;
  onAddCard: (columnId: string) => void;
  hoveredCardId?: string | null;
};

export default function SortableColumn({ column, cards, onCardClick, onAddCard, hoveredCardId }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${column.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? "ring-2 ring-cyan-500/30 rounded-xl" : ""}
    >
      <Column
        column={column}
        cards={cards}
        onCardClick={onCardClick}
        onAddCard={onAddCard}
        hoveredCardId={hoveredCardId}
      />
    </div>
  );
}
