"use client";

import { useEffect } from "react";

type DeleteEmpresaModalProps = {
  open: boolean;
  empresaNombre: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteEmpresaModal({
  open,
  empresaNombre,
  loading = false,
  onClose,
  onConfirm,
}: DeleteEmpresaModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 px-3">
      <div
        className="w-full max-w-md rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-[var(--foreground)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-red-500">Eliminar empresa</h2>
        <p className="mt-2 text-sm opacity-90">
          Vas a eliminar <span className="font-semibold">{empresaNombre}</span>. Esta acción no se puede deshacer.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-[var(--input-border)] px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirmar eliminación
          </button>
        </div>
      </div>
    </div>
  );
}