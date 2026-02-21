"use client";

import React from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { ProductEntry, RecetaEntry } from "@/types/firestore";

const formatNumber = (value: number, maxDecimals = 2, minDecimals = 0): string => {
    if (!Number.isFinite(value)) return "0";
    return new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
    }).format(value);
};

const roundCurrency = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
};

export function RecetasListItems(props: {
    recetas: RecetaEntry[];
    productosById: Record<string, ProductEntry>;
    saving: boolean;
    deletingId: string | null;
    onEdit: (receta: RecetaEntry) => void;
    onRemove: (id: string, nombreLabel: string) => void;
}) {
    const { recetas, productosById, saving, deletingId, onEdit, onRemove } = props;

    return (
        <>
            {recetas.map((r) => (
                (() => {
                    const margen = Number(r.margen) || 0;
                    const ingredientes = (Array.isArray(r.productos) ? r.productos : []).map((item) => {
                        const productId = String(item.productId || "").trim();
                        const gramos = Number(item.gramos) || 0;
                        const product = productId ? productosById[productId] : undefined;
                        const precioXGramo = Number(product?.precioxgramo) || 0;
                        const costo = gramos > 0 && precioXGramo > 0 ? gramos * precioXGramo : 0;
                        return {
                            productId,
                            gramos,
                            product,
                            precioXGramo,
                            costo,
                        };
                    });

                    const costoTotal = ingredientes.reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
                    const precioFinal = costoTotal * (1 + margen);

                    return (
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
                                <div className="mt-2 text-[10px] sm:text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                                    Costo: <span className="text-[var(--foreground)]">₡ {formatNumber(roundCurrency(costoTotal), 2)}</span>
                                </div>
                                <div className="mt-1 text-[10px] sm:text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">
                                    Precio: ₡ {formatNumber(roundCurrency(precioFinal), 2)}
                                </div>
                            </div>
                        </div>

                        {ingredientes.length > 0 && (
                            <div className="mt-3 sm:mt-4">
                                <div className="text-[10px] sm:text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                                    Productos
                                </div>

                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                                    {ingredientes.map((i, idx) => {
                                        const displayName = String(i.product?.nombre || i.productId || "Producto");
                                        const gramosLabel = i.gramos > 0 ? `${formatNumber(i.gramos, 0)} g` : "";
                                        const unitLabel = i.precioXGramo > 0 ? `₡ ${formatNumber(i.precioXGramo, 2, 2)}/g` : "";
                                        const meta = [gramosLabel, unitLabel].filter(Boolean).join(" • ");
                                        const costoLabel = i.costo > 0 ? `₡ ${formatNumber(roundCurrency(i.costo), 2)}` : "—";

                                        return (
                                            <div
                                                key={`${i.productId || "row"}-${idx}`}
                                                className="flex items-center justify-between gap-2 rounded-md border border-[var(--input-border)] bg-black/10 px-2 py-1.5"
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-xs text-[var(--foreground)]/90 truncate">
                                                        {displayName}
                                                    </div>
                                                    {meta && (
                                                        <div className="mt-0.5 text-[10px] text-[var(--muted-foreground)] truncate">
                                                            {meta}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="shrink-0 text-[10px] sm:text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">
                                                    {costoLabel}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
                    );
                })()
            ))}
        </>
    );
}
