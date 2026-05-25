"use client";

import React from "react";
import Image from "next/image";
import { Pencil, Trash2 } from "lucide-react";

import type { ProductEntry, RecetaEntry } from "@/types/firestore";

const formatNumber = (
  value: number,
  maxDecimals = 2,
  minDecimals = 0,
): string => {
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

const roundUpTo25 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.ceil(value / 25) * 25;
};

export function RecetasListItems(props: {
  recetas: RecetaEntry[];
  productosById: Record<string, ProductEntry>;
  saving: boolean;
  deletingId: string | null;
  onEdit: (receta: RecetaEntry) => void;
  onRemove: (id: string, nombreLabel: string) => void;
}) {
  const { recetas, productosById, saving, deletingId, onEdit, onRemove } =
    props;
  const [collapsedById, setCollapsedById] = React.useState<
    Record<string, boolean>
  >({});
  const [imagePreview, setImagePreview] = React.useState<{
    url: string;
    alt: string;
  } | null>(null);

  const closeImagePreview = React.useCallback(() => {
    setImagePreview(null);
  }, []);

  React.useEffect(() => {
    if (!imagePreview) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeImagePreview();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [imagePreview, closeImagePreview]);

  return (
    <>
      {recetas.map((r) =>
        (() => {
          const margen = Number(r.margen) || 0;
          const ivaRate = Number(r.iva) || 0;
          const isProductsCollapsed = collapsedById[r.id] ?? true;
          const ingredientes = (
            Array.isArray(r.productos) ? r.productos : []
          ).map((item) => {
            const productId = String(item.productId || "").trim();
            const gramos = Number(item.gramos) || 0;
            const product = productId ? productosById[productId] : undefined;
            const precioXGramo = Number(product?.precioxgramo) || 0;
            const costo =
              gramos > 0 && precioXGramo > 0 ? gramos * precioXGramo : 0;
            return {
              productId,
              gramos,
              product,
              precioXGramo,
              costo,
            };
          });

          const costoTotal = ingredientes.reduce(
            (sum, i) => sum + (Number(i.costo) || 0),
            0,
          );
          const ivaMonto = costoTotal * ivaRate;
          const totalConIva = costoTotal + ivaMonto;
          const precioFinal = totalConIva * (1 + margen);
          const precioConMargen = formatNumber(
            roundCurrency(costoTotal * (1 + margen)),
            2,
          );
          const precioVentaSugerido = roundUpTo25(precioFinal);
          const productosCount = r.productos?.length || 0;
          const margenLabel = `${Math.round(margen * 100)}%`;
          const ivaLabel = `${Math.round(ivaRate * 100)}%`;
          const costoLabel = `₡ ${formatNumber(roundCurrency(costoTotal), 2)}`;
          const precioLabel = `₡ ${formatNumber(roundCurrency(precioFinal), 2)}`;
          const precioVentaSugeridoLabel = `₡ ${formatNumber(
            roundCurrency(precioVentaSugerido),
            2,
          )}`;

          return (
            <li
              key={r.id}
              className="group border border-[var(--input-border)] rounded-lg overflow-hidden bg-[var(--card-bg)] transition-all duration-200 hover:bg-[var(--hover-bg)] hover:border-[var(--foreground)]/20 hover:shadow-md focus-within:ring-2 focus-within:ring-cyan-500/40"
            >
              <div className="p-5 sm:p-6 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-base sm:text-lg font-semibold text-[var(--foreground)] truncate transition-colors duration-150 group-hover:text-[var(--foreground)]">
                      {r.nombre}
                    </div>

                    {r.descripcion && (
                      <div className="mt-1.5 text-xs sm:text-sm text-[var(--muted-foreground)]/80 break-words leading-snug">
                        {r.descripcion}
                      </div>
                    )}

                    <div className="mt-2 flex flex-col gap-y-1 text-sm text-[var(--muted-foreground)]">
                      <span className="whitespace-nowrap transition-colors duration-150 hover:text-[var(--foreground)]">
                        {productosCount} productos
                      </span>
                      <span className="whitespace-nowrap font-semibold text-[var(--foreground)]/60 transition-colors duration-150 hover:text-[var(--foreground)]">
                        Costo: <span className="font-normal">{costoLabel}</span>
                      </span>
                      <span className="whitespace-nowrap font-semibold text-[var(--foreground)]/60 transition-colors duration-150 hover:text-[var(--foreground)]">
                        Precio + Utilidad:{" "}
                        <span className="font-normal">{precioConMargen}</span>
                      </span>
                      <span className="whitespace-nowrap font-semibold text-[var(--foreground)]/60 transition-colors duration-150 hover:text-[var(--foreground)]">
                        Precio + Utilidad + IVA:{" "}
                        <span className="font-normal">{precioLabel}</span>
                      </span>
                      <span className="whitespace-nowrap font-extrabold text-xl text-[var(--foreground)]/80 transition-all duration-150 hover:text-[var(--foreground)] hover:scale-[1.01] inline-block">
                        Costo Venta Sugerido:{" "}
                        <span className="font-extrabold">
                          {precioVentaSugeridoLabel}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-start gap-3">
                    {r.imageUrl && (
                      <button
                        type="button"
                        className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-[var(--input-border)] bg-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-all duration-200 hover:scale-[1.04] hover:shadow-lg hover:border-[var(--foreground)]/30"
                        onClick={() =>
                          setImagePreview({
                            url: r.imageUrl as string,
                            alt: String(r.nombre || "Imagen"),
                          })
                        }
                        aria-label="Ver imagen"
                        title="Ver imagen"
                      >
                        <Image
                          src={r.imageUrl as string}
                          alt={String(r.nombre || "Imagen")}
                          fill
                          sizes="(max-width: 640px) 96px, 112px"
                          quality={50}
                          className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      </button>
                    )}

                    <div className="flex flex-col gap-1 items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Margen
                        </span>
                        <div className="inline-flex items-center rounded-full bg-[var(--badge-bg)] text-[var(--badge-text)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-[var(--input-border)]/60 transition-all duration-150 hover:ring-[var(--foreground)]/30 hover:bg-[var(--muted)]">
                          {margenLabel}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          IVA
                        </span>
                        <div className="inline-flex items-center rounded-full bg-[var(--badge-bg)] text-[var(--badge-text)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-[var(--input-border)]/60 transition-all duration-150 hover:ring-[var(--foreground)]/30 hover:bg-[var(--muted)]">
                          {ivaLabel}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 rounded-lg bg-[var(--muted)] p-1 ring-1 ring-[var(--input-border)]/60 transition-all duration-150 group-hover:ring-[var(--foreground)]/20">
                      <button
                        type="button"
                        className="opacity-60 hover:opacity-100 disabled:opacity-40 p-2.5 rounded-md hover:bg-[var(--hover-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-all duration-150 hover:scale-[1.12]"
                        onClick={() => onEdit(r)}
                        disabled={saving || deletingId !== null}
                        title="Editar receta"
                        aria-label="Editar receta"
                      >
                        <Pencil className="w-4 h-4 text-[var(--foreground)]" />
                      </button>
                      <button
                        type="button"
                        className="opacity-60 hover:opacity-100 disabled:opacity-40 p-2.5 rounded-md hover:bg-[var(--hover-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-all duration-150 hover:scale-[1.12]"
                        onClick={() => onRemove(r.id, r.nombre || r.id)}
                        disabled={saving || deletingId !== null}
                        title="Eliminar receta"
                        aria-label="Eliminar receta"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {ingredientes.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] sm:text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                        Productos
                      </div>
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--hover-bg)] hover:shadow-sm transition-all duration-150"
                        onClick={() =>
                          setCollapsedById((prev) => ({
                            ...prev,
                            [r.id]: !(prev[r.id] ?? true),
                          }))
                        }
                      >
                        {isProductsCollapsed ? "Mostrar" : "Minimizar"}
                      </button>
                    </div>

                    {!isProductsCollapsed && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ingredientes.map((i, idx) => {
                          const displayName = String(
                            i.product?.nombre || i.productId || "Producto",
                          );
                          const gramosLabel =
                            i.gramos > 0
                              ? `${formatNumber(i.gramos, 0)} g`
                              : "";
                          const unitLabel =
                            i.precioXGramo > 0
                              ? `₡ ${formatNumber(i.precioXGramo, 2, 2)}/g`
                              : "";
                          const meta = [gramosLabel, unitLabel]
                            .filter(Boolean)
                            .join(" • ");
                          const costoItemLabel =
                            i.costo > 0
                              ? `₡ ${formatNumber(roundCurrency(i.costo), 2)}`
                              : "—";

                          return (
                            <div
                              key={`${i.productId || "row"}-${idx}`}
                              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--input-border)] bg-[var(--muted)] px-3.5 py-2.5 transition-all duration-150 hover:bg-[var(--hover-bg)] hover:border-[var(--foreground)]/20 hover:shadow-sm"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-[var(--foreground)]/90 truncate">
                                  {displayName}
                                </div>
                                {meta && (
                                  <div className="mt-0.5 text-xs text-[var(--muted-foreground)] truncate">
                                    {meta}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">
                                {costoItemLabel}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })(),
      )}

      {imagePreview && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 dark:bg-black/80 p-4"
          onClick={closeImagePreview}
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de imagen"
        >
          <div
            className="relative bg-[var(--card-bg)] text-[var(--foreground)] rounded-lg shadow-2xl border border-[var(--input-border)] overflow-hidden max-w-[95vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeImagePreview}
              className="absolute z-10 top-3 right-3 text-xs px-3 py-1.5 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--hover-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
            >
              Salir
            </button>

            <div className="relative z-0 w-[95vw] h-[90vh]">
              <Image
                src={imagePreview.url}
                alt={imagePreview.alt}
                fill
                sizes="95vw"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
