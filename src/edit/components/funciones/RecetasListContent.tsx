"use client";

import React from "react";

import { RecetasListItems, type FuncionListItem } from "./RecetasListItems";

export function RecetasListContent(props: {
  isLoading: boolean;
  filteredCount: number;
  searchTerm: string;
  items: FuncionListItem[];
  onEdit: (item: FuncionListItem) => void;
  onRemove: (id: string, nombreLabel: string) => void;
  disabled?: boolean;
}) {
  const { isLoading, filteredCount, searchTerm, items, onEdit, onRemove, disabled = false } = props;

  if (isLoading) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <li
            key={idx}
            className="animate-pulse flex flex-col border border-[var(--input-border)] rounded-lg overflow-hidden bg-[var(--input-bg)]"
          >
            <div className="flex-1 p-4 sm:p-5 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-1/2 rounded bg-black/20" />
                  <div className="mt-3 h-3 w-3/4 rounded bg-black/15" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-1.5 sm:space-y-2">
      {filteredCount === 0 && (
        <li className="border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] p-6 text-center">
          <div className="text-sm font-semibold text-[var(--foreground)]">
            {searchTerm ? "Sin resultados" : "Aún no hay funciones"}
          </div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            {searchTerm
              ? "Prueba con otro nombre."
              : "Agrega tu primera función para empezar."}
          </div>
        </li>
      )}

      <RecetasListItems items={items} onEdit={onEdit} onRemove={onRemove} disabled={disabled} />
    </ul>
  );
}
