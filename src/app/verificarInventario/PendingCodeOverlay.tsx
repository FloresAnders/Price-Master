"use client";

import { useEffect, useId, useRef } from "react";

type PendingCodeOverlayProps = {
  codigo: string | null;
  nombre: string;
  error: string | null;
  onNombreChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function PendingCodeOverlay({
  codigo,
  nombre,
  error,
  onNombreChange,
  onCancel,
  onSave,
}: PendingCodeOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!codigo) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    inputRef.current?.focus();

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [codigo]);

  if (!codigo) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 shadow-2xl"
      >
        <h3 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
          Guardar en pendientes
        </h3>
        <p className="mt-2 text-sm opacity-70">{codigo}</p>
        <p id={descriptionId} className="mt-2 text-sm opacity-70">
          No encontramos este código. Escribe el nombre para guardarlo como pendiente.
        </p>

        <label
          htmlFor="pending-product-name"
          className="mt-4 block text-sm font-medium text-[var(--foreground)]"
        >
          Nombre del producto
        </label>
        <input
          ref={inputRef}
          id="pending-product-name"
          value={nombre}
          onChange={(event) => onNombreChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSave();
            }
          }}
          className="mt-2 w-full rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
          placeholder="Nombre para identificar el producto"
        />

        {error ? (
          <div role="alert" className="mt-2 text-sm text-red-500">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-black/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
