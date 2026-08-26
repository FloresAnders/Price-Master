"use client";

import { useId, type ReactNode } from "react";

export type ScanNoticeState = {
  variant: "found" | "added" | "duplicate";
  codigo: string;
  codigoProducto?: string;
  codigoBarras?: string;
  descripcion: string;
  precioVenta?: string;
};

type ScanNoticeOverlayProps = {
  scanNotice: ScanNoticeState | null;
  children?: ReactNode;
};

export default function ScanNoticeOverlay({
  scanNotice,
  children,
}: ScanNoticeOverlayProps) {
  const titleId = useId();

  if (!scanNotice) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div
        role={children ? "dialog" : "status"}
        aria-modal={children ? "true" : undefined}
        aria-labelledby={children ? titleId : undefined}
        aria-live={children ? undefined : "polite"}
        aria-atomic={children ? undefined : "true"}
        className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-slate-950 p-6 text-white shadow-2xl"
      >
        <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">
          {scanNotice.variant === "found"
            ? "Código encontrado"
            : scanNotice.variant === "duplicate"
              ? "Ya escaneado"
              : "Agregado"}
        </p>
        <h3 id={titleId} className="mt-2 text-xl font-semibold">
          {scanNotice.variant === "found"
            ? scanNotice.descripcion
            : scanNotice.variant === "duplicate"
              ? "Ya escaneado"
              : "Agregado"}
        </h3>
        {scanNotice.precioVenta && scanNotice.variant === "found" ? (
          <p className="mt-3 text-lg font-semibold text-emerald-200">
            Precio de venta: {scanNotice.precioVenta}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-slate-300">
          Código: {scanNotice.codigoProducto || scanNotice.codigo}
        </p>
        {scanNotice.variant === "added" ? (
          <p className="mt-2 text-sm text-emerald-200">
            Código agregado a la lista. Escanea otro código o cierra el escáner.
          </p>
        ) : null}
        {scanNotice.variant === "duplicate" ? (
          <p className="mt-2 text-sm text-amber-200">
            Este código ya fue escaneado. Escanea otro código.
          </p>
        ) : null}
        {scanNotice.codigoBarras ? (
          <p className="mt-1 text-sm text-slate-300">
            Código de barras: {scanNotice.codigoBarras}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
