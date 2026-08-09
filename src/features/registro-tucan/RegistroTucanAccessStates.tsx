import { Lock } from "lucide-react";

export function RegistroTucanLoadingState() {
  return (
    <div className="mx-auto max-w-5xl py-10 text-center text-[var(--muted-foreground)]">
      Cargando...
    </div>
  );
}

export function RegistroTucanAccessDeniedState() {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center">
      <Lock className="mx-auto mb-4 h-10 w-10 text-[var(--muted-foreground)]" />
      <h2 className="text-xl font-semibold text-[var(--foreground)]">
        Acceso restringido
      </h2>
      <p className="mt-2 text-[var(--muted-foreground)]">
        No tienes permisos para acceder a Registro Tucan.
      </p>
    </div>
  );
}

export function RegistroTucanMissingEmpresaState() {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">
        Empresa requerida
      </h2>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Tu usuario no tiene empresa asignada.
      </p>
    </div>
  );
}
