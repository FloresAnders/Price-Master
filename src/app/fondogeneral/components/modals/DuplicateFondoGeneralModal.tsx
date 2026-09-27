"use client";

import React from "react";
import { ArrowLeft, CircleX, Shuffle } from "lucide-react";

type DuplicateFondoGeneralModalProps = {
  open: boolean;
  hasAlternativeAccounts: boolean;
  onBack: () => void;
  onChooseRandomAccount: () => void;
};

export default function DuplicateFondoGeneralModal({
  open,
  hasAlternativeAccounts,
  onBack,
  onChooseRandomAccount,
}: DuplicateFondoGeneralModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-fondo-general-title"
      aria-describedby="duplicate-fondo-general-description"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-center text-[var(--foreground)] shadow-2xl sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400 text-red-400">
          <CircleX className="h-9 w-9" aria-hidden="true" />
        </div>

        <h2
          id="duplicate-fondo-general-title"
          className="mt-6 text-xl font-semibold sm:text-2xl"
        >
          Fondo General duplicado
        </h2>
        <p
          id="duplicate-fondo-general-description"
          className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]"
        >
          Ya tienes Fondo General abierto en otra pestaña de este navegador.
          Para evitar movimientos simultáneos, solo puede estar activo en una
          pestaña.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--input-border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Atrás
          </button>
          <button
            type="button"
            onClick={onChooseRandomAccount}
            disabled={!hasAlternativeAccounts}
            title={
              hasAlternativeAccounts
                ? "Ir a otra cuenta disponible"
                : "No hay otras cuentas disponibles"
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card-bg)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            Ok!
          </button>
        </div>
      </div>
    </div>
  );
}
