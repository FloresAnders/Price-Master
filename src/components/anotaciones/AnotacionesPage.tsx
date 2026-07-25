"use client";

import { NotebookPen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultPermissions } from "@/utils/permissions";

export default function AnotacionesPage() {
  const { user } = useAuth();
  const permissions = user
    ? user.permissions || getDefaultPermissions(user.role || "user")
    : null;

  if (!permissions?.anotaciones) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center">
        <NotebookPen className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Sin permisos
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          No tienes permisos para acceder a Anotaciones.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[45vh] max-w-2xl items-center justify-center">
      <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center shadow">
        <NotebookPen className="mx-auto mb-4 h-14 w-14 text-indigo-300" />
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          Anotaciones
        </h1>
        <p className="mt-3 text-lg text-[var(--muted-foreground)]">
          En mantenimiento
        </p>
      </div>
    </div>
  );
}
