"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Search, CalendarDays, Tag, User } from "lucide-react";
import type { TaskboardCard, TaskboardColumn } from "@/types/taskboard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: TaskboardCard[];
  columns: TaskboardColumn[];
  onSelectCard: (card: TaskboardCard) => void;
};

export default function SearchCommand({
  open,
  onOpenChange,
  cards,
  columns,
  onSelectCard,
}: Props) {
  const [query, setQuery] = useState("");

  const columnMap = useMemo(
    () => new Map(columns.map((c) => [c.id, c.title])),
    [columns],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return cards.slice(0, 20);
    const q = query.toLowerCase();
    return cards
      .filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [cards, query]);

  const handleSelect = useCallback(
    (cardId: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (card) {
        onSelectCard(card);
        onOpenChange(false);
        setQuery("");
      }
    },
    [cards, onSelectCard, onOpenChange],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  const formatDate = (date: string | null | undefined) =>
    date ? new Date(date).toLocaleDateString() : "";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-[540px] bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="bg-transparent">
          <div className="flex items-center border-b border-white/10 px-4">
            <Search className="w-4 h-4 text-white/30 mr-3 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar tarjetas..."
              className="flex-1 bg-transparent text-sm text-white/90 py-4 placeholder:text-white/20 focus:outline-none"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto px-2 py-2">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-sm text-white/30">
                Sin resultados
              </div>
            )}
            {filtered.map((card) => (
              <Command.Item
                key={card.id}
                value={card.id}
                onSelect={handleSelect}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer
                  aria-selected:bg-white/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 font-medium truncate">{card.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                    {card.priority && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {card.priority}
                      </span>
                    )}
                    {card.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {formatDate(card.dueDate)}
                      </span>
                    )}
                    {card.assignees && card.assignees.length > 0 && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {card.assignees.length}
                      </span>
                    )}
                    <span className="text-white/20 truncate">
                      {columnMap.get(card.columnId) || ""}
                    </span>
                  </div>
                </div>
              </Command.Item>
            ))}
          </Command.List>
          <div className="border-t border-white/10 px-4 py-2 flex items-center gap-4 text-[11px] text-white/20">
            <span>
              <kbd className="px-1 py-0.5 bg-white/5 rounded text-white/40">↑↓</kbd> navegar
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white/5 rounded text-white/40">↵</kbd> seleccionar
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white/5 rounded text-white/40">esc</kbd> cerrar
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
