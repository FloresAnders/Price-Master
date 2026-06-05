"use client";

import { useCallback, useEffect, useState } from "react";

type AddEmpresaModalProps = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (nombre: string) => void;
};

export default function AddEmpresaModal({
  open,
  loading = false,
  onClose,
  onConfirm,
}: AddEmpresaModalProps) {
  const [nombre, setNombre] = useState("");

  const handleClose = useCallback(() => {
    setNombre("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  const canConfirm = nombre.trim().length > 0 && !loading;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 px-3">
      <div
        className="w-full max-w-md rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-[var(--foreground)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Agregar empresa</h2>
        <p className="mt-1 text-sm opacity-80">
          Escribe el nombre de la empresa y confirma para guardarla en local.
        </p>

        <label htmlFor="empresa-nombre" className="mt-4 block text-sm font-medium">
          Nombre
        </label>
        <input
          id="empresa-nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          placeholder="Ej: Mi Empresa"
          className="mt-2 w-full rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-md border border-[var(--input-border)] px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(nombre)}
            disabled={!canConfirm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}