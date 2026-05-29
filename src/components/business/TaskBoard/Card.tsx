"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MessageSquare, Paperclip, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { TaskboardCard, TaskboardPriority } from "@/types/taskboard";

type Props = {
  card: TaskboardCard;
  onClick: (card: TaskboardCard) => void;
};

const PRIORITY_BORDER: Record<TaskboardPriority, string> = {
  low: "border-l-slate-500",
  medium: "border-l-blue-500",
  high: "border-l-orange-500",
  urgent: "border-l-red-500",
};

const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

export default function TaskCard({ card, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(card)}
      className={`group bg-[#111827] border border-white/10 rounded-xl p-3 cursor-pointer
        hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.08)]
        transition-all duration-200 active:scale-[0.98]
        border-l-2 ${card.priority ? PRIORITY_BORDER[card.priority] : "border-l-transparent"}`}
    >
      <div className="space-y-2">
        <p className="text-sm font-medium text-white/90 leading-snug line-clamp-2">
          {card.title}
        </p>

        {card.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.labels.slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: label.color + "25", color: label.color }}
              >
                {label.name}
              </span>
            ))}
            {card.labels.length > 3 && (
              <span className="text-[10px] text-white/30">+{card.labels.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            {card.dueDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {new Date(card.dueDate).toLocaleDateString()}
              </span>
            )}
            {card.checklistTotalCount ? (
              <span className="flex items-center gap-1">
                <CheckSquare className="w-3 h-3" />
                {card.checklistDoneCount}/{card.checklistTotalCount}
              </span>
            ) : null}
            {card.commentsCount ? (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {card.commentsCount}
              </span>
            ) : null}
            {card.attachmentsCount ? (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {card.attachmentsCount}
              </span>
            ) : null}
          </div>

          {card.assignees && card.assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {card.assignees.slice(0, 3).map((assignee) => (
                <Avatar key={assignee} className="w-5 h-5 border border-[#0d1117]">
                  <AvatarFallback className="text-[7px] bg-cyan-500/30 text-cyan-300">
                    {getInitials(assignee)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {card.assignees.length > 3 && (
                <span className="w-5 h-5 rounded-full bg-white/10 border border-[#0d1117] flex items-center justify-center text-[9px] text-white/50">
                  +{card.assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
