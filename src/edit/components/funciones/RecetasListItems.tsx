"use client";

import React from "react";
import { Pencil, Trash2 } from "lucide-react";

export type FuncionListItem = {
  id: string;
  docId: string;
  nombre: string;
  descripcion?: string;
  reminderTimeCr?: string;
  createdAt?: string;
};

export function RecetasListItems(props: {
  items: FuncionListItem[];
  onEdit: (item: FuncionListItem) => void;
  onRemove: (id: string, nombreLabel: string) => void;
  disabled?: boolean;
}) {
  const { items, onEdit, onRemove, disabled = false } = props;

  return (
    <>
      {items.map((item) => (
        <li
          key={item.id}
          className="group border border-[var(--input-border)] rounded-lg overflow-hidden bg-[var(--input-bg)] transition-colors duration-150 hover:bg-[var(--muted)] focus-within:ring-2 focus-within:ring-[var(--accent)]/40"
        >
          <div className="p-5 sm:p-6 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base sm:text-lg font-semibold text-[var(--foreground)] truncate">
                  {item.nombre}
                </div>
                {item.descripcion && (
                  <div className="mt-1.5 text-xs sm:text-sm text-[var(--muted-foreground)]/80 break-words leading-snug">
                    {item.descripcion}
                  </div>
                )}
                {item.createdAt && (
                  <div className="mt-1.5 text-xs text-[var(--muted-foreground)] truncate">
                    {item.createdAt}
                  </div>
                )}
              </div>

              <div className="shrink-0 flex flex-col items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 p-1 ring-1 ring-black/10 dark:ring-white/10">
                <button
                  type="button"
                  className="opacity-70 hover:opacity-100 disabled:opacity-40 p-2.5 rounded-md hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 transition-all duration-150 transform-gpu hover:scale-[1.08]"
                  onClick={() => onEdit(item)}
                  disabled={disabled}
                  title="Editar"
                  aria-label="Editar"
                >
                  <Pencil className="w-4 h-4 text-[var(--foreground)]" />
                </button>
                <button
                  type="button"
                  className="opacity-70 hover:opacity-100 disabled:opacity-40 p-2.5 rounded-md hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 transition-all duration-150 transform-gpu hover:scale-[1.08]"
                  onClick={() => onRemove(item.id, item.nombre || item.id)}
                  disabled={disabled}
                  title="Eliminar"
                  aria-label="Eliminar"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        </li>
      ))}
    </>
  );
}
