"use client";

import { Layers } from "lucide-react";
import { FondoSection } from "./FondoSection";

export function OtraSection({ id }: { id?: string }) {
  return (
    <div id={id} className="mt-10">
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
        <Layers className="w-5 h-5" /> Reportes
      </h2>
      <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded">
        <p className="text-[var(--muted-foreground)]">
          Acciones adicionales proximamente.
        </p>
      </div>
    </div>
  );
}

export function FondoIngresoSection({ id }: { id?: string }) {
  return <FondoSection id={id} mode="ingreso" />;
}

export function FondoEgresoSection({ id }: { id?: string }) {
  return <FondoSection id={id} mode="egreso" />;
}

export function FondoGeneralSection({ id }: { id?: string }) {
  return <FondoSection id={id} mode="all" />;
}
