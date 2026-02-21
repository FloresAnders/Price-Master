"use client";

import React from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { RecetaEntry } from "@/types/firestore";

export function RecetasListItems(props: {
    recetas: RecetaEntry[];
    saving: boolean;
    deletingId: string | null;
    onEdit: (receta: RecetaEntry) => void;
    onRemove: (id: string, nombreLabel: string) => void;
}) {
    const { recetas, saving, deletingId, onEdit, onRemove } = props;

    return (
        <>
            {recetas.map((r) => (
                <li
                    key={r.id}
                    className="group flex flex-col sm:flex-row sm:items-stretch border border-[var(--input-border)] rounded-lg overflow-hidden bg-[var(--input-bg)] transition-colors duration-150 hover:bg-[var(--muted)] focus-within:ring-2 focus-within:ring-[var(--accent)]/40"
                >
                    <div className="flex-1 p-4 sm:p-5 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm sm:text-base font-semibold text-[var(--foreground)] truncate">
                                    {r.nombre}
                                </div>
                                {r.descripcion && (
                                    <div className="mt-2 text-xs text-[var(--muted-foreground)] opacity-70 break-words">
                                        {r.descripcion}
                                    </div>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-sm sm:text-base font-semibold text-[var(--foreground)] whitespace-nowrap">
                                    {Math.round((Number(r.margen) || 0) * 100)}%
                                </div>
                                <div className="mt-1 text-[10px] sm:text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                                    {r.productos?.length || 0} productos
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 px-2.5 py-2 sm:px-3 sm:py-3 border-t sm:border-t-0 sm:border-l border-[var(--input-border)] bg-black/10 transition-colors duration-150 group-hover:bg-black/20">
                        <button
                            type="button"
                            className="text-[var(--foreground)]/80 hover:text-[var(--foreground)] disabled:opacity-50 p-2.5 rounded-md hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 transition-colors"
                            onClick={() => onEdit(r)}
                            disabled={saving || deletingId !== null}
                            title="Editar receta"
                            aria-label="Editar receta"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            className="text-red-400 hover:text-red-300 disabled:opacity-50 p-2.5 rounded-md hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 transition-colors"
                            onClick={() => onRemove(r.id, r.nombre || r.id)}
                            disabled={saving || deletingId !== null}
                            title="Eliminar receta"
                            aria-label="Eliminar receta"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </li>
            ))}
        </>
    );
}
