"use client";

import { Building2, Loader2, Wrench, X } from "lucide-react";
import { useState } from "react";
import type { MaintenanceBlock } from "@/services/maintenance";
import { applyFirebaseCustomTokenAuth } from "@/lib/firebase/auth-bridge";

export default function MaintenanceScreen({
  block,
}: {
  block: MaintenanceBlock;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const companyLabel =
    block.target.companyName || block.target.companyLocation || "Esta empresa";

  const submitBypass = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Código inválido.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/maintenance/bypass", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json().catch(() => null)) as {
        firebaseToken?: string;
      } | null;
      if (!response.ok) throw new Error("invalid_code");
      if (data?.firebaseToken) {
        await applyFirebaseCustomTokenAuth(data.firebaseToken);
      }
      window.location.reload();
    } catch {
      setError("Código inválido.");
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#020713] px-5 py-12 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.2),_transparent_48%)]" />
      <section className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/80 p-7 text-center shadow-2xl shadow-blue-950/40 backdrop-blur sm:p-10">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
          {block.scope === "company" ? (
            <Building2 className="h-10 w-10 text-blue-300" aria-hidden="true" />
          ) : (
            <Wrench className="h-10 w-10 text-blue-300" aria-hidden="true" />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setDialogOpen(true);
            setError("");
          }}
          className="mb-3 appearance-none border-0 bg-transparent p-0 text-xs font-semibold uppercase tracking-[0.3em] text-blue-300"
        >
          TIME-MASTER
        </button>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {block.scope === "company"
            ? `${companyLabel} está en mantenimiento`
            : "Sistema en mantenimiento"}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-300 sm:text-lg">
          {block.target.message}
        </p>
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          El acceso se restaurará automáticamente
        </div>
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="maintenance-access-title"
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-6 text-left shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-slate-500 transition-colors hover:text-slate-200"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2
              id="maintenance-access-title"
              className="pr-8 text-lg font-semibold text-white"
            >
              Acceso de mantenimiento
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Ingresa el código de tu aplicación autenticadora.
            </p>
            <form onSubmit={submitBypass} className="mt-5 space-y-4">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                Código de 6 dígitos
                <input
                  autoFocus
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-12 rounded-xl border border-white/10 bg-slate-900 px-4 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-400">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Entrar
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
