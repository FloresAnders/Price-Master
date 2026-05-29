"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, GripVertical } from "lucide-react";
import type { TaskboardCard, TaskboardColumn as TColumn } from "@/types/taskboard";
import TaskCard from "./Card";

type Props = {
  column: TColumn;
  cards: TaskboardCard[];
  onCardClick: (card: TaskboardCard) => void;
  onAddCard: (columnId: string) => void;
  hoveredCardId?: string | null;
};

export default function Column({ column, cards, onCardClick, onAddCard, hoveredCardId }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      className={`flex-shrink-0 w-[280px] sm:w-[300px] flex flex-col rounded-xl bg-[#0d1117]/40 border border-white/[0.06] transition-all duration-200 ${
        isOver
          ? "bg-cyan-500/8 ring-1 ring-cyan-500/25 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.06)]"
          : ""
      }`}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-white/20 cursor-grab active:cursor-grabbing shrink-0" />
          <h3 className="text-sm font-semibold text-white/70 truncate">{column.title}</h3>
          <span className="text-[11px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full shrink-0">
            {cards.length}
          </span>
        </div>
        <button
          onClick={() => onAddCard(column.id)}
          className="h-7 w-7 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-all shrink-0"
          title="Agregar tarjeta"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 space-y-3 min-h-[90px] rounded-lg px-1.5 pb-2"
      >
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <div key={card.id} className="relative">
              {hoveredCardId === card.id && (
                <div className="absolute -top-[6px] left-1 right-1 h-[3px] bg-cyan-400/60 rounded-full z-10 shadow-[0_0_8px_rgba(6,182,212,0.3)]" />
              )}
              <TaskCard card={card} onClick={onCardClick} />
            </div>
          ))}
        </SortableContext>

        <button
          onClick={() => onAddCard(column.id)}
          className="w-full flex items-center gap-1.5 px-2 py-2.5 rounded-lg text-xs text-white/25 hover:text-white/60 hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar tarjeta
        </button>

        {cards.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-white/20 border border-dashed border-white/10 rounded-xl">
            Arrastra tarjetas aquí
          </div>
        )}
      </div>
    </div>
  );
}
