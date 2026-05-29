"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Trash2,
  Plus,
  User,
  Clock,
  Send,
} from "lucide-react";
import type {
  TaskboardCard,
  TaskboardChecklistItem,
  TaskboardComment,
  TaskboardPriority,
} from "@/types/taskboard";
import { TaskboardChecklistService } from "@/services/taskboard/checklist";
import { TaskboardCommentsService } from "@/services/taskboard/comments";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: TaskboardCard | null;
  workspaceId: string;
  boardId: string;
  onUpdate: (cardId: string, updates: Partial<TaskboardCard>) => void;
  isMobile?: boolean;
};

const PRIORITY_COLORS: Record<TaskboardPriority, string> = {
  low: "bg-slate-500/20 text-slate-400",
  medium: "bg-blue-500/20 text-blue-400",
  high: "bg-orange-500/20 text-orange-400",
  urgent: "bg-red-500/20 text-red-400",
};

export default function CardDetailDrawer({
  open,
  onOpenChange,
  card,
  workspaceId,
  boardId,
  onUpdate,
  isMobile = false,
}: Props) {
  const [title, setTitle] = useState(card?.title || "");
  const [description, setDescription] = useState(card?.description || "");
  const [checklist, setChecklist] = useState<TaskboardChecklistItem[]>([]);
  const [comments, setComments] = useState<TaskboardComment[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || "");
    }
  }, [card]);

  useEffect(() => {
    if (!card || !open) return;
    const unsub =
      TaskboardChecklistService.listenChecklist(workspaceId, boardId, card.id, setChecklist);
    return unsub;
  }, [card?.id, workspaceId, boardId, open]);

  useEffect(() => {
    if (!card || !open) return;
    const unsub = TaskboardCommentsService.listenComments(
      workspaceId,
      boardId,
      card.id,
      setComments,
    );
    return unsub;
  }, [card?.id, workspaceId, boardId, open]);

  const handleSaveTitle = useCallback(() => {
    if (card && title.trim() && title !== card.title) {
      onUpdate(card.id, { title: title.trim() });
    }
  }, [card, title, onUpdate]);

  const handleSaveDescription = useCallback(() => {
    if (card && description !== (card.description || "")) {
      onUpdate(card.id, { description });
    }
  }, [card, description, onUpdate]);

  const handleAddComment = useCallback(async () => {
    if (!card || !newComment.trim()) return;
    try {
      await TaskboardCommentsService.addComment(
        workspaceId,
        boardId,
        card.id,
        newComment.trim(),
        "current-user",
      );
      setNewComment("");
      onUpdate(card.id, {
        commentsCount: (card.commentsCount || 0) + 1,
      });
    } catch {}
  }, [card, newComment, workspaceId, boardId, onUpdate]);

  const handleAddChecklistItem = useCallback(async () => {
    if (!card) return;
    const text = prompt("Nuevo item:");
    if (!text?.trim()) return;
    try {
      await TaskboardChecklistService.addItem(
        workspaceId,
        boardId,
        card.id,
        text.trim(),
        `item-${Date.now()}`,
      );
      onUpdate(card.id, {
        checklistTotalCount: (card.checklistTotalCount || 0) + 1,
      });
    } catch {}
  }, [card, workspaceId, boardId, onUpdate]);

  const handleToggleChecklist = useCallback(
    async (itemId: string, done: boolean) => {
      if (!card) return;
      try {
        await TaskboardChecklistService.toggleItem(
          workspaceId,
          boardId,
          card.id,
          itemId,
          done,
        );
        const delta = done ? 1 : -1;
        onUpdate(card.id, {
          checklistDoneCount: (card.checklistDoneCount || 0) + delta,
        });
      } catch {}
    },
    [card, workspaceId, boardId, onUpdate],
  );

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  const content = card ? (
    <ScrollArea className="h-full pr-2">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/40 font-medium mb-1 block">Título</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            className="text-base font-semibold border-white/10 bg-white/5"
          />
        </div>

        <div>
          <label className="text-xs text-white/40 font-medium mb-1 block">Descripción</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            placeholder="Añadir descripción..."
            rows={3}
            className="border-white/10 bg-white/5 resize-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {card.labels?.map((label) => (
            <Badge
              key={label.id}
              className="text-xs px-2 py-0.5 font-normal"
              style={{ backgroundColor: label.color + "30", color: label.color }}
            >
              {label.name}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm text-white/50">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {card.priority && (
              <Badge className={`text-xs px-2 py-0.5 ${PRIORITY_COLORS[card.priority]}`}>
                {card.priority}
              </Badge>
            )}
          </div>
          {card.dueDate && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{new Date(card.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {card.assignees && card.assignees.length > 0 && (
          <div>
            <label className="text-xs text-white/40 font-medium mb-2 block">Responsables</label>
            <div className="flex gap-2">
              {card.assignees.map((assignee) => (
                <Avatar key={assignee} className="w-7 h-7">
                  <AvatarFallback className="text-[10px] bg-cyan-500/20 text-cyan-400">
                    {getInitials(assignee)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        )}

        <Separator className="bg-white/10" />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/40 font-medium flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              Checklist ({checklist.filter((i) => i.done).length}/{checklist.length})
            </label>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/30 hover:text-white/60"
              onClick={handleAddChecklistItem}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-1">
            {checklist.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 py-1 cursor-pointer hover:bg-white/5 rounded px-1 transition-colors"
              >
                <Checkbox
                  checked={item.done}
                  onCheckedChange={(checked) =>
                    handleToggleChecklist(item.id, !!checked)
                  }
                  className="border-white/30"
                />
                <span
                  className={`text-sm ${
                    item.done ? "line-through text-white/30" : "text-white/80"
                  }`}
                >
                  {item.text}
                </span>
              </label>
            ))}
          </div>
        </div>

        <Separator className="bg-white/10" />

        <div>
          <label className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Comentarios ({comments.length})
          </label>
          <div className="space-y-3 mb-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2 text-sm">
                <Avatar className="w-6 h-6 shrink-0">
                  <AvatarFallback className="text-[9px] bg-cyan-500/20 text-cyan-400">
                    {getInitials(comment.authorId)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white/70 text-xs">{comment.authorId}</p>
                  <p className="text-white/90">{comment.text}</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {comment.createdAt
                      ? new Date(comment.createdAt).toLocaleString()
                      : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario..."
              className="border-white/10 bg-white/5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-white/40 hover:text-white/70"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {card.attachmentsCount ? (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Paperclip className="w-3 h-3" />
            {card.attachmentsCount} archivo(s)
          </div>
        ) : null}
      </div>
    </ScrollArea>
  ) : null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-[#0d1117] border-t border-white/10 max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-white/90 text-lg">Detalle de Tarjeta</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-[#0d1117] border border-white/10 text-white max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white/90 flex items-center gap-2">
            <span className="text-white/40">#</span> Detalle de Tarjeta
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
